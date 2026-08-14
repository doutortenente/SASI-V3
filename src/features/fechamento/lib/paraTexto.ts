/**
 * Ponte entre o BANCO e o TEXTO do Fechamento — funções puras, sem consulta.
 *
 * O motor de texto (`lib/formatters/fechamento.ts`) recebe insumos já no
 * formato dele (`InsumosEvolucao`/`InsumosPassagem`); os serviços entregam o
 * formato do banco (`EvolucaoCorrente`, `InsumosDoFechamento`). Este arquivo
 * faz SÓ a tradução entre os dois — não redige linha clínica nenhuma: campo
 * sem fonte vira `null` e o motor omite a linha (doutrina de ausência do
 * próprio motor).
 *
 * Mora em `lib/` da feature (mesmo padrão de `features/captura/lib/plantao.ts`):
 * é lógica pura compartilhada pelo Server Component da passagem e pela ilha
 * client da ficha, com teste ao lado.
 */
import {calcularDebitoUrinario} from '@/lib/clinical/unidades';
import {calcularSofa, type InfusaoParaSofa, type ResultadoSofa} from '@/lib/clinical/sofa';
import {num, unidadeSegura} from '@/lib/formatters/clinico';
import type {
    AtbAtivoParaPassagem,
    AtbCursoParaNota,
    DispositivoParaNota,
    InsumosEvolucao,
    InsumosPassagem,
    JanelaProntaParaNota,
    PendenciaParaTexto,
    PacienteParaTexto,
} from '@/lib/formatters/fechamento';
import type {
    Gravidade,
    InfusaoOuTexto,
    Json,
    Pendencia,
    ProblemaAtivo,
    Risco,
    SistemaHemato,
    SistemaHemo,
    SistemaInfecto,
    SistemaNeuro,
    SistemaRenal,
    SistemaResp,
    SistemaTgi,
} from '@/types';

import type {JanelaRender} from '@/features/captura/types';
import type {TipoDeDispositivo} from '@/features/devices/services/dispositivos';
import type {PacienteParaFicha} from '@/features/fechamento/services/pacientes';
import type {
    AtbAtivo,
    AtbRegistro,
    EvolucaoCorrente,
    InsumosDoFechamento,
    TurnoDaNota,
} from '@/features/fechamento/types';

// ---------------------------------------------------------------------------
// Edição da ficha — ida e volta entre o jsonb do banco e os campos da tela
// ---------------------------------------------------------------------------

/**
 * Um sistema do jsonb vira o mapa campo→texto que os inputs consomem. Valor
 * ausente vira '' (campo vazio na tela, não "null" literal digitável); valor
 * numérico vira o texto dele. Só os campos pedidos entram — chave desconhecida
 * do jsonb não ganha input fantasma.
 */
export function sistemaParaEdicao(
    sistema: Record<string, unknown> | null | undefined,
    campos: readonly string[],
): Record<string, string> {
    const edicao: Record<string, string> = {};
    for (const campo of campos) {
        const v = sistema?.[campo];
        edicao[campo] = typeof v === 'string' || typeof v === 'number' ? String(v) : '';
    }
    return edicao;
}

/**
 * O caminho de volta: campo vazio ('' após trim) É OMITIDO do jsonb — nunca
 * vira 0 nem string vazia gravada. Zero é um valor medido; vazio é ausência,
 * e ausência no banco é a chave não existir (o motor de texto então omite a
 * linha, e a tela mostra travessão).
 */
export function sistemaLimpo<T extends Record<string, unknown>>(sistema: T | null | undefined): T {
    const limpo: Record<string, unknown> = {};
    if (sistema) {
        for (const [chave, valor] of Object.entries(sistema)) {
            if (valor === null || valor === undefined) continue;
            if (typeof valor === 'string') {
                const t = valor.trim();
                if (t !== '') limpo[chave] = t;
                continue;
            }
            limpo[chave] = valor;
        }
    }
    return limpo as T;
}

/** Linhas digitadas viram lista limpa: trim em cada uma, vazia sai fora. */
export function linhasPreenchidas(linhas: string[]): string[] {
    return linhas.map((l) => l.trim()).filter((l) => l !== '');
}

/**
 * Uma infusão do banco vira a LINHA EDITÁVEL da tela. Texto puro (a forma do
 * banco vivo) passa como está, só com a unidade normalizada (µ → mcg, o
 * incidente das mil vezes); objeto rico vira "droga + vazão/dose".
 *
 * Diferente de `rotuloInfusao` (que é linguagem de TELA e usa travessão), aqui
 * dose ausente é simplesmente OMITIDA: travessão dentro de um campo de texto
 * editável viraria texto gravado na nota.
 */
export function linhaDeInfusao(inf: InfusaoOuTexto): string {
    if (typeof inf === 'string') {
        const texto = inf.trim();
        return texto === '' ? '' : unidadeSegura(texto);
    }
    const partes: string[] = [inf.droga];
    if (inf.vazao_mcg_h != null) partes.push(`${num(inf.vazao_mcg_h)} mcg/h`);
    else if (inf.vazao_mg_h != null) partes.push(`${num(inf.vazao_mg_h, 1)} mg/h`);
    else if (inf.vazao_ml_h != null) partes.push(`${num(inf.vazao_ml_h, 1)} mL/h`);
    else if (inf.dose != null && String(inf.dose).trim() !== '') {
        const unidade = inf.unidade ? ` ${unidadeSegura(inf.unidade)}` : '';
        partes.push(`${String(inf.dose).trim()}${unidade}`);
    }
    return partes.join(' ').trim();
}

// ---------------------------------------------------------------------------
// SOFA derivado da ficha — via `calcularSofa`, com a honestidade preservada
// ---------------------------------------------------------------------------

/** O que a ficha tem para oferecer ao SOFA. Tudo opcional: falta vira `null`. */
export interface FonteParaSofa {
    hemo?: SistemaHemo | null;
    hemato?: SistemaHemato | null;
    renal?: SistemaRenal | null;
    dvas?: InfusaoOuTexto[] | null;
}

export interface SofaDerivado {
    /** `null` quando NENHUM componente foi apurável — o motor então escreve "SOFA não calculado". */
    resultado: ResultadoSofa | null;
    /** Limitações do cálculo que a tela mostra junto (aviso amarelo, nunca correção). */
    avisos: string[];
}

/**
 * O SOFA que a ficha consegue apurar AGORA, por `calcularSofa` (a casa única
 * do escore). A ficha por sistemas só carrega parte da entrada — plaquetas,
 * PAM mínima, creatinina, diurese e as DVAs em forma de objeto. PaO2/FiO2,
 * bilirrubina e Glasgow não têm campo na ficha: os componentes saem `null`,
 * o total sai `null` e o motor imprime "SOFA parcial N" com a transparência
 * X/6 — nunca um total que parece medido.
 *
 * DVA em TEXTO LIVRE (a forma do banco vivo) não vira objeto por regex —
 * "Noradrenalina suspensa" não tem dose, e adivinhar seria inventar dado
 * (regra de `rotuloInfusao`). O cardiovascular pode então subestimar, e o
 * aviso diz isso na tela em vez de fingir precisão.
 */
export function sofaDaFicha(fonte: FonteParaSofa, pesoKg: number | null, agora?: Date): SofaDerivado {
    const infusoes = fonte.dvas ?? [];
    const objetos: InfusaoParaSofa[] = [];
    let temTextoLivre = false;
    for (const inf of infusoes) {
        if (typeof inf === 'string') {
            if (inf.trim() !== '') temTextoLivre = true;
            continue;
        }
        objetos.push({droga: inf.droga, vazaoMlH: inf.vazao_ml_h ?? null});
    }

    const avisos: string[] = [];
    if (temTextoLivre) {
        avisos.push(
            'DVA registrada como texto livre não entra no cálculo do SOFA cardiovascular — ' +
                'o componente pode sair menor que o real. Conferir contra a linha de drogas vasoativas.',
        );
    }

    const temDiurese = fonte.renal?.diurese_6_18h_ml != null;
    const resultado = calcularSofa(
        {
            plaquetas: fonte.hemato?.plaq ?? null,
            pamMinima: fonte.hemo?.pam_min ?? null,
            dvas: objetos,
            pesoKg,
            creatinina: fonte.renal?.cr ?? null,
            // O campo da ficha é, por definição do esquema canônico, a diurese
            // da janela 06h–18h — 12 horas. `calcularDebitoUrinario` faz a
            // conta de 24h e carrega o aviso de extrapolação na ressalva.
            diureseMl: fonte.renal?.diurese_6_18h_ml ?? null,
            horasDeColeta: temDiurese ? 12 : null,
        },
        agora ?? new Date(),
    );

    // Zero componente apurado não é "SOFA parcial 0" (que se lê como escore
    // baixo medido) — é escore NÃO CALCULADO, e o motor tem frase própria.
    if (resultado.apurados === 0) return {resultado: null, avisos};
    return {resultado, avisos};
}

// ---------------------------------------------------------------------------
// Traduções banco → motor de texto
// ---------------------------------------------------------------------------

/**
 * Rótulo humano de cada tipo de dispositivo do enum do banco. É NOME de
 * dispositivo (estrutura do vocabulário, como os nomes dos sistemas do SOFA),
 * não dado clínico — rotular não inventa nada.
 */
const ROTULO_DISPOSITIVO: Readonly<Record<TipoDeDispositivo, string>> = {
    iot: 'IOT',
    traqueo: 'TQT',
    cvc: 'CVC',
    picc: 'PICC',
    arterial: 'PAI',
    svd: 'SVD',
    sne: 'SNE',
    sng: 'SNG',
    dreno: 'Dreno',
    gtt: 'GTT',
    trr: 'Cateter de TRR',
    marca_passo: 'Marca-passo',
    outro: 'Outro dispositivo',
};

export function rotuloDispositivo(tipo: TipoDeDispositivo): string {
    return ROTULO_DISPOSITIVO[tipo];
}

/** `vw_dispositivos_ativos` → seção Dispositivos (dias vêm do banco, nunca daqui). */
export function dispositivosParaNota(
    dispositivos: InsumosDoFechamento['dispositivos'],
): DispositivoParaNota[] {
    return dispositivos.map((d) => ({
        rotulo: rotuloDispositivo(d.tipo),
        sitio: d.sitio,
        diasEmUso: d.dias_em_uso,
    }));
}

/** `vw_janelas_24h_render` → linhas prontas do motor (o `render` vem do banco). */
export function janelasParaNota(janelas: JanelaRender[]): JanelaProntaParaNota[] {
    return janelas.map((j) => ({
        tipo: j.tipo,
        render: j.render,
        valor_max: j.valor_max,
        valor_min: j.valor_min,
    }));
}

/** Só as ABERTAS viram texto: pendência concluída no checklist da passagem mentiria. */
export function pendenciasAbertasParaTexto(pendencias: Pendencia[]): PendenciaParaTexto[] {
    return pendencias.filter((p) => !p.concluida).map((p) => ({tarefa: p.tarefa, prioridade: p.prioridade}));
}

/**
 * Histórico COMPLETO de `atbs` → cursos da evolução. O D[n] do curso aberto
 * vem de `vw_dias_atb_ativo` (cruzado pelo id) — decisão de 10-ago: a contagem
 * de dias é do banco, nunca conta local.
 */
export function atbsParaNota(historico: AtbRegistro[], ativos: AtbAtivo[]): AtbCursoParaNota[] {
    const diasPorId = new Map(ativos.map((a) => [a.atb_id, a.dias_terapia]));
    return historico.map((r) => ({
        droga: r.droga,
        dose: r.dose,
        via: r.via,
        frequencia: r.frequencia,
        foco: r.foco,
        dataInicioISO: r.data_inicio,
        dataFimISO: r.data_fim,
        diasTerapia: r.data_fim == null ? (diasPorId.get(r.id) ?? null) : null,
    }));
}

/** Só os ATIVOS entram na passagem (regra do Formato A), com D-X do banco. */
export function atbsAtivosParaPassagem(ativos: AtbAtivo[]): AtbAtivoParaPassagem[] {
    return ativos.map((a) => ({
        droga: a.droga,
        diasTerapia: a.dias_terapia,
        foco: a.foco,
    }));
}

// ---------------------------------------------------------------------------
// A ficha congelada da admissão (pacientes.patient_summary)
// ---------------------------------------------------------------------------

export interface ResumoDaAdmissao {
    admissao: {dataISO: string; texto: string} | null;
    antecedentes: string | null;
    medicamentosDomiciliares: string[] | null;
}

function textoOuNull(v: Json | undefined): string | null {
    return typeof v === 'string' && v.trim() !== '' ? v : null;
}

/**
 * Extrai da ficha congelada só o que a nota usa, com guarda campo a campo —
 * jsonb sem contrato imposto pelo banco pode vir em qualquer forma, e campo
 * ilegível vira `null` (a seção é omitida), nunca frase inventada. A seção
 * Admissão só existe com DATA E TEXTO juntos: "Admissão ():" com parêntese
 * vazio é meia-informação que suja a nota.
 */
export function resumoDaAdmissao(summary: Json | null): ResumoDaAdmissao {
    if (typeof summary !== 'object' || summary === null || Array.isArray(summary)) {
        return {admissao: null, antecedentes: null, medicamentosDomiciliares: null};
    }
    const s = summary as {[k: string]: Json | undefined};
    const dataISO = textoOuNull(s.data_admissao);
    const motivo = textoOuNull(s.motivo_admissao);
    const meds = Array.isArray(s.medicamentos_domiciliares)
        ? s.medicamentos_domiciliares.filter((m): m is string => typeof m === 'string' && m.trim() !== '')
        : [];
    return {
        admissao: dataISO !== null && motivo !== null ? {dataISO, texto: motivo} : null,
        antecedentes: textoOuNull(s.antecedentes),
        medicamentosDomiciliares: meds.length > 0 ? meds : null,
    };
}

// ---------------------------------------------------------------------------
// Montagem dos insumos dos DOIS formatos
// ---------------------------------------------------------------------------

function pacienteParaTexto(p: PacienteParaFicha): PacienteParaTexto {
    return {
        nome: p.nome,
        idade: p.idade,
        peso: p.peso,
        uti: p.uti,
        leito: p.leito,
        hd: p.hd,
        alergias: p.alergias,
    };
}

/**
 * A ficha COMO ESTÁ NA TELA (já limpa: sistemas por `sistemaLimpo`, listas por
 * `linhasPreenchidas`). É o mesmo objeto que vai para `save_ficha` — preview e
 * gravação leem a MESMA fonte, para o texto copiado nunca divergir do salvo.
 */
export interface FichaParaTexto {
    neuro: SistemaNeuro;
    resp: SistemaResp;
    hemo: SistemaHemo;
    tgi: SistemaTgi;
    renal: SistemaRenal;
    hemato: SistemaHemato;
    infecto: SistemaInfecto;
    dvas: InfusaoOuTexto[];
    sedativos: InfusaoOuTexto[];
    impressao: string[];
    conduta: string[];
    intercorrencias: string[];
    problemasAtivos: ProblemaAtivo[];
    riscos: Risco[];
}

export interface EntradaEvolucaoParaTexto {
    paciente: PacienteParaFicha;
    /** `vw_dashboard_uti.dias_internacao` — derivado no banco. */
    diasInternacao: number | null;
    /** `vw_dashboard_uti.delta_sofa_24h`. */
    deltaSofa24h: number | null;
    /** Dia do plantão (YYYY-MM-DD), de `derivarRelogiosDaNota` no servidor. */
    dataPlantaoISO: string;
    turno: TurnoDaNota;
    ficha: FichaParaTexto;
    insumos: InsumosDoFechamento;
    /** Pendências ABERTAS ao vivo (fonte única `pendencias`, via hooks). */
    pendenciasAbertas: Pendencia[];
    /** De `sofaDaFicha` — `null` quando nada foi apurável. */
    sofa: ResultadoSofa | null;
    /** `evolucoes.autor_nome` da nota carregada. Sem autor, sem assinatura. */
    autorNome: string | null;
}

/**
 * Tudo que `montarEvolucao` precisa, a partir do banco + da ficha em edição.
 *
 * Campos sem fonte hoje (gasometria composta, P/F apurado, culturas, laudos de
 * imagem, nutrição, profilaxias) vão como `null` DE PROPÓSITO — o motor omite
 * a linha, e a linha volta quando a ingestão passar a alimentar a fonte.
 * Preenchê-los aqui com frase genérica é o que a regra da casa proíbe.
 */
export function insumosDaEvolucao(e: EntradaEvolucaoParaTexto): InsumosEvolucao {
    const admissao = resumoDaAdmissao(e.paciente.patient_summary);
    const problemas = e.ficha.problemasAtivos.map((p) => p.texto.trim()).filter((t) => t !== '');
    const hd = e.paciente.hd?.trim() ?? '';
    return {
        paciente: pacienteParaTexto(e.paciente),
        // Sem problemas ativos estruturados, a HD do cabeçalho (que TEM fonte:
        // é a hipótese registrada em `pacientes.hd`) vira o item único.
        problemas: problemas.length > 0 ? problemas : hd !== '' ? [hd] : [],
        admissao: admissao.admissao,
        diasInternacao: e.diasInternacao,
        dataPlantaoISO: e.dataPlantaoISO,
        turno: e.turno,
        intercorrencias: e.ficha.intercorrencias,
        antecedentes: admissao.antecedentes,
        medicamentosDomiciliares: admissao.medicamentosDomiciliares,
        dispositivos: dispositivosParaNota(e.insumos.dispositivos),
        dvas: e.ficha.dvas,
        sedativos: e.ficha.sedativos,
        atbs: atbsParaNota(e.insumos.atbHistoricoCompleto, e.insumos.atbAtivos),
        nutricao: null,
        sistemas: {
            neuro: e.ficha.neuro,
            resp: e.ficha.resp,
            hemo: e.ficha.hemo,
            tgi: e.ficha.tgi,
            renal: e.ficha.renal,
            hemato: e.ficha.hemato,
            infecto: e.ficha.infecto,
            gaso: null,
        },
        janelas: janelasParaNota(e.insumos.janelas),
        bh24h: e.insumos.bh?.bh_24h ?? null,
        pf: null,
        culturas: null,
        imagens: null,
        sofa: e.sofa,
        deltaSofa24h: e.deltaSofa24h,
        qSofa: null,
        impressao: e.ficha.impressao,
        conduta: e.ficha.conduta,
        profilaxias: null,
        pendencias: pendenciasAbertasParaTexto(e.pendenciasAbertas),
        autorNome: e.autorNome,
    };
}

export interface EntradaPassagemParaTexto {
    paciente: PacienteParaFicha;
    diasInternacao: number | null;
    deltaSofa24h: number | null;
    /** Gravidade CORRENTE do paciente (`vw_dashboard_uti.gravidade`). */
    gravidade: Gravidade | null;
    dataPlantaoISO: string;
    turno: TurnoDaNota;
    /** A nota corrente — a passagem relata o que a última nota registrou. */
    evolucao: EvolucaoCorrente | null;
    insumos: InsumosDoFechamento;
    /** Relógio do chamador (servidor), para `calculadoEm` do SOFA. */
    agora?: Date;
}

/**
 * Tudo que `montarPassagem` precisa para UM paciente (Formato A). A ordem da
 * lista (mais grave primeiro) é decisão do CHAMADOR — este arquivo não ordena.
 *
 * Ausências seguem a mesma doutrina da evolução: FiO2/PF/culturas sem fonte
 * apurada = `null` = fragmento omitido; paciente sem nota nenhuma sai com
 * sistemas "não avaliado" — verdade, não enfeite.
 */
export function insumosDaPassagem(e: EntradaPassagemParaTexto): InsumosPassagem {
    const sofa = sofaDaFicha(
        {
            hemo: e.evolucao?.hemo ?? null,
            hemato: e.evolucao?.hemato ?? null,
            renal: e.evolucao?.renal ?? null,
            dvas: e.evolucao?.dvas ?? [],
        },
        e.paciente.peso,
        e.agora,
    );
    // DU em mL/kg/h: conta exata sobre a janela registrada (volume/peso/horas),
    // sem extrapolação — `calcularDebitoUrinario` só extrapola o total de 24h.
    const temDiurese = e.evolucao?.renal?.diurese_6_18h_ml != null;
    const du = calcularDebitoUrinario(
        e.evolucao?.renal?.diurese_6_18h_ml ?? null,
        e.paciente.peso,
        temDiurese ? 12 : null,
    );
    return {
        paciente: pacienteParaTexto(e.paciente),
        diasInternacao: e.diasInternacao,
        dataPlantaoISO: e.dataPlantaoISO,
        turno: e.turno,
        gravidade: e.gravidade,
        sofa: sofa.resultado,
        deltaSofa24h: e.deltaSofa24h,
        qSofa: null,
        sistemas: {
            neuro: e.evolucao?.neuro ?? null,
            resp: e.evolucao?.resp ?? null,
            hemo: e.evolucao?.hemo ?? null,
            tgi: e.evolucao?.tgi ?? null,
            renal: e.evolucao?.renal ?? null,
            hemato: e.evolucao?.hemato ?? null,
            infecto: e.evolucao?.infecto ?? null,
            gaso: null,
        },
        janelas: janelasParaNota(e.insumos.janelas),
        dvas: e.evolucao?.dvas ?? [],
        sedativos: e.evolucao?.sedativos ?? [],
        atbsAtivos: atbsAtivosParaPassagem(e.insumos.atbAtivos),
        culturasAtivas: null,
        bh24h: e.insumos.bh?.bh_24h ?? null,
        duMlKgH: du.mlPorKgPorHora,
        fio2: null,
        pf: null,
        alertas: e.insumos.alertasAbertos.map((a) => a.mensagem),
        pendencias: pendenciasAbertasParaTexto(e.insumos.pendencias),
        // SE PIORAR só com FONTE: os riscos registrados na nota. Sem risco
        // registrado a seção NÃO EXISTE — plano de resgate não se inventa.
        sePiorar: sePiorarDosRiscos(e.evolucao?.riscos ?? []),
    };
}

function sePiorarDosRiscos(riscos: Risco[]): string[] | null {
    const linhas = riscos.map((r) => r.texto.trim()).filter((t) => t !== '');
    return linhas.length > 0 ? linhas : null;
}

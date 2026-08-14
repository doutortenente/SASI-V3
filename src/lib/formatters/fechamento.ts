/**
 * Fechamento (Tela 3) — montagem determinística da EVOLUÇÃO e da PASSAGEM.
 *
 * A especificação do texto NÃO é deste arquivo — é da skill `sasi-ingest-export`:
 *   - Evolução:  references/04-export-evolucao-template.md (TEMPLATE-BASE v2, IMUTÁVEL)
 *   - Passagem:  references/05-export-passagem-turno.md (Formato A, individual)
 *   - Estilo:    references/00-estilo-texto-clinico.md
 * Divergência do esqueleto é "bug clínico-legal" (palavras do próprio template).
 * Este arquivo é o TERCEIRO renderizador do mesmo formato, nunca um formato rival
 * (decisão 1 de docs/ARQUITETURA.md) — por isso os testes travam a ordem das seções.
 *
 * Funções PURAS: entrada = insumos já lidos do banco pelos serviços, saída = string.
 * Nada aqui consulta o banco, nada aqui usa relógio — determinismo é o que permite
 * testar o esqueleto caractere a caractere.
 *
 * AUSÊNCIA EM TEXTO (doutrina da skill, diferente da tela):
 *   - sistema inteiro sem dado  -> "não avaliado"
 *   - campo isolado sem dado    -> a LINHA É OMITIDA (nunca frase inventada,
 *     nunca travessão — travessão é linguagem de TELA, ver `clinico.ts`)
 *   - linha de conduta sem fonte NÃO EXISTE (proibido genérico de preenchimento)
 *
 * A única seta que sobrevive é "->" entre valores da MESMA variável em série
 * ("Cr 1,7 -> 2,0") — notação do operador, que entra pronta nos insumos.
 * Os glifos de seta de subida/descida não existem nem nos comentários daqui;
 * a regex que prova a ausência deles mora só no teste.
 */
import {numeroDoLeito, rotuloInfusao} from '@/lib/formatters/clinico';

import type {ResultadoSofa} from '@/lib/clinical/sofa';
import type {
    Gravidade,
    InfusaoOuTexto,
    SistemaHemato,
    SistemaHemo,
    SistemaInfecto,
    SistemaNeuro,
    SistemaRenal,
    SistemaResp,
    SistemaTgi,
} from '@/types';

// ---------------------------------------------------------------------------
// Tipos dos insumos (estruturais, mínimos — o serviço da tela mapeia até aqui)
// ---------------------------------------------------------------------------

/**
 * Uma janela de vital com o `render` PRONTO de `vw_janelas_24h_render`.
 * O texto da faixa ("PAM 90-56 (4/12 <65)") é montado NO BANCO, casa única —
 * este formatter EXIBE a linha, nunca a remonta a partir de máx/mín (remontar
 * criaria um segundo formato que diverge da nota — docs/MAPA-BANCO-TELAS.md).
 * Tipo estrutural de propósito: compatível com `JanelaRender` de
 * `features/captura/types` sem fazer `lib/` depender de `features/`.
 */
export interface JanelaProntaParaNota {
    tipo: string | null;
    render: string | null;
    valor_max: number | null;
    valor_min: number | null;
}

/** Pendência como o texto a consome: o RENDER do array, nunca redigida de novo. */
export interface PendenciaParaTexto {
    tarefa: string;
    /** 1 = tempo-sensível. Ordena o checklist; nunca é inventada aqui. */
    prioridade: 1 | 2 | 3;
}

/** Dispositivo ativo — dias de uso vêm de `vw_dispositivos_ativos.dias_em_uso`. */
export interface DispositivoParaNota {
    /** Rótulo legível ("CVC", "IOT", "SVD") — o serviço traduz o enum do banco. */
    rotulo: string;
    sitio?: string | null;
    /** Derivado no banco — NUNCA calculado nem digitado aqui. */
    diasEmUso?: number | null;
}

/**
 * Um curso de antibiótico do HISTÓRICO COMPLETO (`atbs`): aberto ou fechado.
 * `diasTerapia` só existe para curso aberto e vem de
 * `vw_dias_atb_ativo.dias_terapia` — decisão de 10-ago: a contagem é do banco,
 * este arquivo nunca a calcula.
 */
export interface AtbCursoParaNota {
    droga: string;
    dose?: string | null;
    via?: string | null;
    frequencia?: string | null;
    foco?: string | null;
    /** ISO (YYYY-MM-DD...). Presente quando o curso FECHOU. */
    dataFimISO?: string | null;
    dataInicioISO?: string | null;
    /** D[n] do curso aberto, de `vw_dias_atb_ativo`. Fechado ou desconhecido = null. */
    diasTerapia?: number | null;
}

/** ATB ATIVO para a passagem (só ativos entram lá — regra do arquivo 05). */
export interface AtbAtivoParaPassagem {
    droga: string;
    /** `vw_dias_atb_ativo.dias_terapia` — nunca calculado aqui. */
    diasTerapia: number | null;
    foco?: string | null;
}

/**
 * Os campos DESCRITIVOS dos sistemas da evolução (jsonb de `evolucoes`).
 * Os máx/mín numéricos que esses jsonb carregam são IGNORADOS de propósito:
 * vital na nota entra pela linha pronta de `vw_janelas_24h_render`.
 */
export interface SistemasDaNota {
    neuro?: SistemaNeuro | null;
    resp?: SistemaResp | null;
    hemo?: SistemaHemo | null;
    tgi?: SistemaTgi | null;
    renal?: SistemaRenal | null;
    hemato?: SistemaHemato | null;
    infecto?: SistemaInfecto | null;
    /** Linha da gasometria já composta a montante, com fonte. Sem fonte = ausente. */
    gaso?: string | null;
}

export interface PacienteParaTexto {
    nome: string;
    idade: number | null;
    peso: number | null;
    /** "UTI2" */
    uti: string;
    /** Formato canônico UTI#-L## */
    leito: string;
    hd?: string | null;
    alergias?: string | null;
}

export interface InsumosEvolucao {
    paciente: PacienteParaTexto;
    /** HD / problemas ativos, já com qualificador de disfunção (texto da fonte). */
    problemas: string[];
    /** Congelado da admissão original — NÃO atualiza (doutrina do template). */
    admissao?: {dataISO: string; texto: string} | null;
    /** DH — dias de internação, derivado no banco (`vw_dashboard_uti`). */
    diasInternacao: number | null;
    /** `evolucoes.data_plantao` (YYYY-MM-DD). */
    dataPlantaoISO: string;
    /** `evolucoes.turno`. */
    turno: 'diurna' | 'noturna';
    /** `evolucoes.intercorrencias` (text[], coluna de 13-ago). Vazio = linha omitida. */
    intercorrencias: string[];
    antecedentes?: string | null;
    medicamentosDomiciliares?: string[] | null;
    dispositivos: DispositivoParaNota[];
    dvas: InfusaoOuTexto[];
    sedativos: InfusaoOuTexto[];
    /** Histórico COMPLETO — cursos abertos E fechados (regra da evolução). */
    atbs: AtbCursoParaNota[];
    nutricao?: {npt?: string | null; tne?: string | null} | null;
    sistemas: SistemasDaNota;
    /** Linhas prontas de `vw_janelas_24h_render`. */
    janelas: JanelaProntaParaNota[];
    /** `vw_bh_acumulado.bh_24h`. */
    bh24h?: number | null;
    /** Relação P/F já apurada a montante (com fonte). */
    pf?: string | number | null;
    /** Culturas + status, texto com fonte. */
    culturas?: string | null;
    /** Laudos de imagem: "modalidade + data: resumo" — só o que muda conduta. */
    imagens?: string[] | null;
    /** Resultado de `calcularSofa` — traz `apurados` e `faltando` (transparência). */
    sofa: ResultadoSofa | null;
    deltaSofa24h?: number | null;
    qSofa?: number | null;
    impressao: string[];
    /** 1:1 com a impressão, meta numérica — conteúdo vem da fonte, nunca daqui. */
    conduta: string[];
    /** Última linha do plano. Sem fonte = omitida (nunca "sempre revisar" genérico). */
    profilaxias?: string | null;
    pendencias: PendenciaParaTexto[];
    /** `evolucoes.autor_nome`. Sem autor, a linha de assinatura é omitida. */
    autorNome?: string | null;
}

export interface InsumosPassagem {
    paciente: PacienteParaTexto;
    diasInternacao: number | null;
    dataPlantaoISO: string;
    turno: 'diurna' | 'noturna';
    gravidade: Gravidade | null;
    sofa: ResultadoSofa | null;
    deltaSofa24h?: number | null;
    qSofa?: number | null;
    sistemas: SistemasDaNota;
    janelas: JanelaProntaParaNota[];
    dvas: InfusaoOuTexto[];
    sedativos: InfusaoOuTexto[];
    /** SÓ ativos, com D-X de `vw_dias_atb_ativo` (regra do arquivo 05). */
    atbsAtivos: AtbAtivoParaPassagem[];
    culturasAtivas?: string | null;
    bh24h?: number | null;
    /** Diurese em mL/kg/h já apurada a montante. */
    duMlKgH?: string | number | null;
    fio2?: string | number | null;
    pf?: string | number | null;
    /** Mensagens de alerta abertas. O corte "máximo 3" é aplicado AQUI. */
    alertas: string[];
    pendencias: PendenciaParaTexto[];
    /**
     * Plano de resgate, linha a linha, COM FONTE (riscos/conduta da evolução).
     * Vazio ou ausente = a seção SE PIORAR é OMITIDA inteira — nunca inventada.
     */
    sePiorar?: string[] | null;
}

// ---------------------------------------------------------------------------
// Miúdos de composição (ausência = fragmento some, nunca vira frase)
// ---------------------------------------------------------------------------

/**
 * Número/texto para SAÍDA DE TEXTO com vírgula decimal. `null`/vazio devolve
 * null (o fragmento é omitido) — nunca travessão, que é linguagem de tela.
 */
function numTexto(v: string | number | null | undefined): string | null {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') {
        if (!Number.isFinite(v)) return null;
        return v.toLocaleString('pt-BR', {maximumFractionDigits: 2});
    }
    const s = v.trim();
    return s === '' ? null : s;
}

/** Junta fragmentos existentes com o separador; nenhum fragmento = null. */
function juntar(partes: Array<string | null | undefined>, separador = ', '): string | null {
    const vivas = partes.filter((p): p is string => typeof p === 'string' && p.trim() !== '');
    return vivas.length > 0 ? vivas.join(separador) : null;
}

/** Prefixo + valor quando o valor existe ("FC 132"); senão o fragmento some. */
function rotulado(rotulo: string, v: string | number | null | undefined, sufixo = ''): string | null {
    const t = numTexto(v);
    return t === null ? null : `${rotulo} ${t}${sufixo}`;
}

/** "YYYY-MM-DD..." -> "DD/MM/AAAA". Data ilegível devolve null (fragmento some). */
function dataBR(iso: string | null | undefined): string | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

/** "YYYY-MM-DD..." -> "DD/MM/AA" (formato do campo Admissão do template). */
function dataBRCurta(iso: string | null | undefined): string | null {
    const m = /^\d{2}(\d{2})-(\d{2})-(\d{2})/.exec(iso ?? '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

/** Delta numérico com sinal explícito: +2 / 0 / -1. Nunca seta (doutrina §3). */
function deltaTexto(delta: number | null | undefined): string | null {
    if (delta === null || delta === undefined || !Number.isFinite(delta)) return null;
    return delta > 0 ? `+${numTexto(delta) ?? ''}` : (numTexto(delta) ?? null);
}

/** "UTI2-L07" -> "07" (o template escreve "{UTI} Leito {N}"). */
function digitosDoLeito(leito: string): string {
    return numeroDoLeito(leito).replace(/^L/, '');
}

/**
 * Faixas de ABSURDO fisiológico do template (04-export-evolucao-template.md,
 * "Flags de absurdo") — a fonte da constante é o próprio arquivo da skill.
 * Flag NÃO bloqueia nem corrige: "corrigir SpO2 145% para 95% é iatrogenia
 * computacional" (docs/ARQUITETURA.md). Só cobre o que ESTE arquivo compõe a
 * partir de número cru (pior valor da passagem); linha pronta do banco passa
 * como veio.
 */
const FAIXA_ABSURDO: Readonly<Record<string, {min: number; max: number}>> = {
    pam: {min: 30, max: 200},
    fc: {min: 20, max: 250},
    spo2: {min: 50, max: 100},
};

function comFlagAbsurdo(tipo: string, valor: number, sufixo = ''): string {
    const faixa = FAIXA_ABSURDO[tipo];
    const texto = `${numTexto(valor) ?? String(valor)}${sufixo}`;
    if (faixa && (valor < faixa.min || valor > faixa.max)) return `${texto} (revisar)`;
    return texto;
}

// ---------------------------------------------------------------------------
// Helpers públicos (reusados pelos dois formatos e pelos testes)
// ---------------------------------------------------------------------------

/**
 * A linha PRONTA de um tipo de vital ("PAM 90-56 (4/12 <65)") — primeira
 * ocorrência do tipo (o serviço já entrega a mais recente primeiro). Sem
 * janela do tipo, devolve null e o fragmento é omitido.
 */
export function linhaVital(janelas: JanelaProntaParaNota[], tipo: string): string | null {
    const j = janelas.find((x) => x.tipo === tipo);
    return numTexto(j?.render ?? null);
}

/**
 * DVAs/sedativos em LINHA ÚNICA, sem seta: "Nora 8 mL/h em desmame · Vaso 2 mL/h".
 * Cada item passa por `rotuloInfusao` (casa única de `clinico.ts`), que trata as
 * DUAS formas do banco vivo — texto puro ("Tridil 12 ml/h") e objeto rico.
 * Filtrar só objeto já descartou 100% das drogas duas vezes (defeito real).
 */
export function linhaDva(infusoes: InfusaoOuTexto[] | null | undefined): string | null {
    if (!infusoes || infusoes.length === 0) return null;
    const rotulos = infusoes.map((i) => rotuloInfusao(i)).filter((r) => r.trim() !== '');
    return juntar(rotulos, ' · ');
}

/** "Meropenem D-3" — o D-X vem de `vw_dias_atb_ativo.dias_terapia`, nunca de conta local. */
export function linhaAtbAtivo(atb: AtbAtivoParaPassagem): string {
    const dias = atb.diasTerapia === null || atb.diasTerapia === undefined ? null : `D-${atb.diasTerapia}`;
    return juntar([atb.droga, dias, atb.foco ? `(${atb.foco})` : null], ' ') ?? atb.droga;
}

/**
 * A linha de SOFA com a transparência OBRIGATÓRIA:
 * "componentes capturados: X/6 · faltando: [...]".
 *
 * Total incompleto NUNCA vira número que parece medido — sai "SOFA parcial N".
 * Sem resultado nenhum (`sofa` null), a linha diz 0/6 com os 6 sistemas na
 * lista de faltantes: os NOMES dos sistemas são estrutura do escore, não dado
 * clínico — listá-los não inventa nada.
 */
export function linhaSofa(
    sofa: ResultadoSofa | null,
    deltaSofa24h?: number | null,
    qSofa?: number | null,
): string {
    const partes: string[] = [];

    if (sofa === null) {
        partes.push('SOFA não calculado');
    } else if (sofa.total !== null) {
        const c = sofa.componentes;
        const tupla = [c.resp, c.coag, c.hepatico, c.cardio, c.neuro, c.renal]
            .map((x) => String(x.pontos ?? '?'))
            .join(', ');
        partes.push(`SOFA ${sofa.total} (${tupla})`);
    } else {
        partes.push(`SOFA parcial ${sofa.parcial}`);
    }

    const delta = deltaTexto(deltaSofa24h);
    if (delta !== null) partes.push(`ΔSOFA 24h: ${delta}`);
    const q = rotulado('qSOFA', qSofa);
    if (q !== null) partes.push(q);

    const apurados = sofa?.apurados ?? 0;
    const faltando =
        sofa === null
            ? ['Respiratório', 'Coagulação', 'Hepático', 'Cardiovascular', 'Neurológico', 'Renal']
            : sofa.faltando;
    partes.push(
        `componentes capturados: ${apurados}/6 · faltando: ${faltando.length > 0 ? faltando.join('; ') : 'nenhum'}`,
    );
    if (sofa && sofa.suprimidos.length > 0) partes.push(`suprimidos: ${sofa.suprimidos.join('; ')}`);

    return `${partes.join('. ')}.`;
}

/**
 * O checklist de pendências: RENDER do array (fonte única — regra nº 7 do
 * SKILL.md), uma linha por item, ordenado por prioridade (1 = tempo-sensível
 * primeiro). A tarefa NUNCA é redigida de novo aqui.
 */
export function checklistPendencias(pendencias: PendenciaParaTexto[], marcador = '☐ '): string[] {
    return [...pendencias].sort((a, b) => a.prioridade - b.prioridade).map((p) => `${marcador}${p.tarefa}`);
}

// ---------------------------------------------------------------------------
// Pedaços da evolução
// ---------------------------------------------------------------------------

/** `Rotulo: conteúdo.` — sistema sem NENHUM dado sai "não avaliado" (doutrina). */
function linhaSistema(rotulo: string, conteudo: string | null): string {
    return `${rotulo}: ${conteudo ?? 'não avaliado'}.`;
}

/** Um curso de ATB do histórico: nome + dose + via + intervalo + D[n]/período + foco. */
function textoCursoAtb(a: AtbCursoParaNota): string {
    const aberto = a.dataFimISO === null || a.dataFimISO === undefined;
    const janelaDatas = juntar([dataBR(a.dataInicioISO), dataBR(a.dataFimISO)], ' a ');
    const periodo = aberto
        ? a.diasTerapia != null
            ? `D${a.diasTerapia}`
            : null
        : janelaDatas !== null
          ? `(${janelaDatas})`
          : '(encerrado)';
    const corpo =
        juntar([a.droga, numTexto(a.dose), numTexto(a.via), numTexto(a.frequencia), periodo], ' ') ?? a.droga;
    return a.foco ? `${corpo} — foco ${a.foco}` : corpo;
}

/** Cabeçalho: {NOME}, {IDADE}a{, PESO kg} — {UTI} Leito {N} — DH {N}º DIA — {DATA} {TURNO} */
function cabecalhoEvolucao(i: InsumosEvolucao): string {
    const p = i.paciente;
    const identidade = juntar([
        p.nome,
        p.idade != null ? `${p.idade}a` : null,
        p.peso != null ? `${numTexto(p.peso)} kg` : null,
    ]);
    const blocos = [
        identidade,
        `${p.uti} Leito ${digitosDoLeito(p.leito)}`,
        i.diasInternacao != null ? `DH ${i.diasInternacao}º DIA` : null,
        juntar([dataBR(i.dataPlantaoISO), i.turno], ' '),
    ];
    return juntar(blocos, ' — ') ?? p.nome;
}

// ---------------------------------------------------------------------------
// EVOLUÇÃO — TEMPLATE-BASE v2, seção por seção, na ordem EXATA do arquivo 04
// ---------------------------------------------------------------------------

export function montarEvolucao(insumos: InsumosEvolucao): string {
    const i = insumos;
    const s = i.sistemas;
    const linhas: string[] = [];
    const escreve = (l: string | null | undefined): void => {
        if (l !== null && l !== undefined) linhas.push(l);
    };

    // 1. Cabeçalho + HD / Problemas ativos (numerados, com qualificador na fonte)
    escreve(cabecalhoEvolucao(i));
    if (i.problemas.length > 0) {
        escreve('HD / Problemas ativos:');
        i.problemas.forEach((p, n) => escreve(`${n + 1}. ${p}`));
    }
    // Destaque de alergia do cabeçalho: com agente vira alerta; "nega" literal
    // fica como negativa; SEM FONTE a linha é omitida (nunca "nega" inventado).
    const alergias = numTexto(i.paciente.alergias);
    if (alergias !== null) {
        escreve(/^nega/i.test(alergias) ? 'Alergias: nega.' : `⚠️ ALERGIA: ${alergias}`);
    }

    // 2. Admissão — CONGELADO da admissão original, não atualiza (template).
    if (i.admissao) {
        escreve('');
        escreve(
            `Admissão (${dataBRCurta(i.admissao.dataISO) ?? dataBR(i.admissao.dataISO) ?? ''}): ${i.admissao.texto}`,
        );
    }

    // 3. Intercorrências 24h — vem do array `evolucoes.intercorrencias`.
    //    Vazio = linha omitida: "sem intercorrências" seria afirmação sem fonte.
    if (i.intercorrencias.length > 0) {
        escreve('');
        escreve(`Intercorrências 24h: ${i.intercorrencias.join('; ')}.`.replace(/\.\.$/, '.'));
    }

    // 4. Antecedentes / medicamentos / ALERGIAS — campo isolado ausente = linha omitida.
    const antecedentes = numTexto(i.antecedentes);
    if (antecedentes !== null) {
        escreve('');
        escreve(`Antecedentes: ${antecedentes}`);
    }
    if (i.medicamentosDomiciliares && i.medicamentosDomiciliares.length > 0) {
        escreve('');
        escreve(`Medicamentos de uso domiciliar: ${i.medicamentosDomiciliares.join(', ')}.`);
    }
    if (alergias !== null) {
        escreve('');
        escreve(`ALERGIAS: ${/^nega/i.test(alergias) ? 'NEGA.' : alergias}`);
    }

    // 5. Dispositivos — dias de uso derivados no banco, nunca digitados.
    if (i.dispositivos.length > 0) {
        escreve('');
        escreve('Dispositivos:');
        escreve(
            i.dispositivos
                .map((d) => {
                    const detalhe = juntar([
                        numTexto(d.sitio),
                        d.diasEmUso != null ? `D${d.diasEmUso}` : null,
                    ]);
                    return detalhe ? `${d.rotulo} - ${detalhe}.` : `${d.rotulo}.`;
                })
                .join(' '),
        );
    }

    // 6. Uso — cada linha só existe com fonte. Array vazio NÃO vira "Não":
    //    afirmar "sem droga vasoativa" sem registro seria dado clínico inventado.
    const usoDva = linhaDva(i.dvas);
    const usoSedacao = linhaDva(i.sedativos);
    const usoAtb = i.atbs.length > 0 ? i.atbs.map(textoCursoAtb).join('; ') : null;
    const usoNutricao = juntar([rotulado('NPT:', i.nutricao?.npt), rotulado('TNE:', i.nutricao?.tne)], '. ');
    if (usoDva !== null || usoSedacao !== null || usoAtb !== null || usoNutricao !== null) {
        escreve('');
        escreve('Uso:');
        escreve(usoDva !== null ? `Drogas Vasoativas: ${usoDva}.` : null);
        escreve(usoSedacao !== null ? `Sedação: ${usoSedacao}.` : null);
        escreve(usoAtb !== null ? `Antibióticos: ${usoAtb}.` : null);
        escreve(usoNutricao !== null ? `${usoNutricao}.` : null);
    }

    // 7. Exame físico por sistemas — os VITAIS entram pela linha PRONTA de
    //    `vw_janelas_24h_render` (Máx–Mín montado no banco, SpO2 incluso);
    //    remontar aqui criaria um segundo formato. Sistema sem nada = "não avaliado".
    escreve('');
    escreve('Exame físico por sistemas:');
    escreve(
        linhaSistema('Neurológico', juntar([numTexto(s.neuro?.descricao), rotulado('RASS', s.neuro?.rass)])),
    );
    escreve(
        linhaSistema(
            'Cardiovascular',
            juntar([
                linhaVital(i.janelas, 'pa_sys'),
                linhaVital(i.janelas, 'pa_dia'),
                linhaVital(i.janelas, 'pam'),
                linhaVital(i.janelas, 'fc'),
                numTexto(s.hemo?.ritmo),
                numTexto(s.hemo?.obs),
                linhaDva(i.dvas),
            ]),
        ),
    );
    escreve(
        linhaSistema(
            'Respiratório',
            juntar([
                numTexto(s.resp?.suporte),
                linhaVital(i.janelas, 'fr'),
                linhaVital(i.janelas, 'spo2'),
                rotulado('P/F', i.pf),
                numTexto(s.resp?.obs),
            ]),
        ),
    );
    escreve(linhaSistema('TGI', juntar([numTexto(s.tgi?.dieta), numTexto(s.tgi?.obs)])));
    escreve(
        linhaSistema(
            'Renal',
            juntar([
                linhaVital(i.janelas, 'diurese_24h'),
                i.bh24h != null ? `BH ${i.bh24h > 0 ? '+' : ''}${numTexto(i.bh24h)} mL` : null,
                rotulado('Cr', s.renal?.cr),
                rotulado('Ur', s.renal?.ur),
                numTexto(s.renal?.descricao),
                numTexto(s.renal?.obs),
            ]),
        ),
    );
    escreve(
        linhaSistema(
            'Hematológico',
            juntar([
                rotulado('Hb', s.hemato?.hb, ' g/dL'),
                rotulado('Ht', s.hemato?.ht, '%'),
                rotulado('Plaq', s.hemato?.plaq, '×10³/µL'),
                numTexto(s.hemato?.obs),
            ]),
        ),
    );
    escreve(
        linhaSistema(
            'Infeccioso',
            juntar([
                i.atbs
                    .filter((a) => a.dataFimISO == null)
                    .map(linhaAtbAtivo2)
                    .join(' · ') || null,
                rotulado('Tmax', s.infecto?.tmax),
                rotulado('Leuco', s.infecto?.leuco),
                numTexto(s.infecto?.obs),
                numTexto(i.culturas),
            ]),
        ),
    );
    const gaso = numTexto(s.gaso);
    if (gaso !== null) escreve(`Metabólico/Gaso: ${gaso}.`);

    // 8. Exames de imagem relevantes — só o que muda conduta; sem laudo, sem seção.
    if (i.imagens && i.imagens.length > 0) {
        escreve('');
        escreve('Exames de imagem relevantes:');
        i.imagens.forEach((img) => escreve(`- ${img}`));
    }

    // 9. Scores — SOFA SEMPRE com a transparência X/6 (regra inegociável).
    escreve('');
    escreve('Scores:');
    escreve(linhaSofa(i.sofa, i.deltaSofa24h, i.qSofa));

    // 10. Impressão numerada — tendência em PALAVRA vem da fonte, nunca vetor.
    if (i.impressao.length > 0) {
        escreve('');
        escreve('Impressão:');
        i.impressao.forEach((t, n) => escreve(`${n + 1}. ${t}`));
    }

    // 11. Conduta 1:1 com a impressão — linha sem fonte NÃO EXISTE, então
    //     lista vazia não gera seção nem frase de preenchimento.
    if (i.conduta.length > 0 || numTexto(i.profilaxias) !== null || i.pendencias.length > 0) {
        escreve('');
        escreve('Conduta estruturada por Sistemas:');
        i.conduta.forEach((t, n) => escreve(`${n + 1}. ${t}`));
        const profilaxias = numTexto(i.profilaxias);
        escreve(profilaxias !== null ? `Profilaxias: ${profilaxias}.` : null);
        // As tarefas acionáveis SAEM do array `pendencias` (fonte única) — render, não redação.
        if (i.pendencias.length > 0) {
            escreve('Pendências:');
            checklistPendencias(i.pendencias, '- ').forEach((l) => escreve(l));
        }
    }

    // 12. Rodapé fixo do template.
    escreve('');
    escreve('—');
    const autor = numTexto(i.autorNome);
    escreve(autor !== null ? `Assinatura: ${autor} — Intensivista` : null);
    escreve('Gerado por SASI — Sistema de Auditoria e Síntese Intensiva — TEMPLATE-BASE v2.0');

    return linhas.join('\n');
}

/** Versão do curso ABERTO para a linha do Infeccioso ("Meropenem D3 — foco pulmonar"). */
function linhaAtbAtivo2(a: AtbCursoParaNota): string {
    const corpo = juntar([a.droga, a.diasTerapia != null ? `D${a.diasTerapia}` : null], ' ') ?? a.droga;
    return a.foco ? `${corpo} — foco ${a.foco}` : corpo;
}

// ---------------------------------------------------------------------------
// PASSAGEM — Formato A do arquivo 05, POR PACIENTE, só os pacientes do plantão
// ---------------------------------------------------------------------------

/** Palavra com acentuação completa para o enum `gravidade_enum` (sem acento no banco). */
const GRAVIDADE_TEXTO: Readonly<Record<Gravidade, string>> = {
    estavel: 'estável',
    watcher: 'watcher',
    instavel: 'instável',
    critico: 'crítico',
};

/** Largura interna da moldura do Formato A (medida no próprio arquivo 05). */
const LARGURA_CAIXA = 63;

function molduraTopo(): string {
    return `╔${'═'.repeat(LARGURA_CAIXA)}╗`;
}

function molduraTitulo(texto: string): string {
    return `║  ${texto}`.padEnd(LARGURA_CAIXA + 1, ' ') + '║';
}

function molduraBase(): string {
    return `╚${'═'.repeat(LARGURA_CAIXA)}╝`;
}

function divisoria(titulo: string): string {
    // O arquivo 05 usa linhas de ─ em volta do título; o comprimento total é fixo.
    const corpo = `─── ${titulo} `;
    return corpo.padEnd(LARGURA_CAIXA + 2, '─');
}

/**
 * PIOR VALOR 24h de um tipo, a partir da janela (regra do arquivo 05: PAM min,
 * FC max, SpO2 min). Número cru composto AQUI, então leva a flag de absurdo
 * `(revisar)` quando fora da faixa do template — flag sinaliza, nunca corrige.
 */
function piorValor(
    janelas: JanelaProntaParaNota[],
    tipo: string,
    lado: 'min' | 'max',
    sufixo = '',
): string | null {
    const j = janelas.find((x) => x.tipo === tipo);
    const v = lado === 'min' ? j?.valor_min : j?.valor_max;
    if (v === null || v === undefined) return null;
    return comFlagAbsurdo(tipo, v, sufixo);
}

function blocoPassagemPaciente(i: InsumosPassagem): string {
    const p = i.paciente;
    const s = i.sistemas;
    const linhas: string[] = [];
    const escreve = (l: string | null | undefined): void => {
        if (l !== null && l !== undefined) linhas.push(l);
    };

    // Moldura e identificação — o esqueleto (e os glifos) são do arquivo 05.
    escreve(molduraTopo());
    escreve(
        molduraTitulo(
            juntar(
                [
                    `PASSAGEM — Leito ${digitosDoLeito(p.leito)} ${p.uti}`,
                    juntar([dataBR(i.dataPlantaoISO), i.turno], ' '),
                ],
                ' — ',
            ) ?? '',
        ),
    );
    escreve(molduraBase());
    escreve('');
    escreve(
        `🏷️  ${juntar(
            [
                juntar([
                    p.nome,
                    p.idade != null ? `${p.idade}a` : null,
                    p.peso != null ? `${numTexto(p.peso)}kg` : null,
                ]),
                i.diasInternacao != null ? `DH ${i.diasInternacao}º` : null,
                numTexto(p.hd) !== null ? `HD: ${numTexto(p.hd)}` : null,
            ],
            ' · ',
        )}`,
    );
    // Alergia sem fonte = linha omitida (nunca "nega" inventado).
    const alergias = numTexto(p.alergias);
    escreve(alergias !== null ? `⚠️  Alergias: ${alergias}` : null);
    escreve('');

    // Escores — o Δ é numérico (+2 / -1), nunca seta; transparência X/6 sempre.
    const sofaBase = linhaSofa(i.sofa, i.deltaSofa24h, i.qSofa).replace(/\.$/, '');
    escreve(
        `📊 ${juntar(
            [sofaBase, i.gravidade !== null ? `gravidade: ${GRAVIDADE_TEXTO[i.gravidade]}` : null],
            ' · ',
        )}`,
    );
    escreve('');

    // STATUS POR SISTEMA (pior valor 24h) — fragmento ausente some; sistema
    // inteiro sem dado sai "não avaliado".
    escreve(divisoria('STATUS POR SISTEMA (pior valor 24h)'));
    const linhaStatus = (emoji: string, rotulo: string, conteudo: string | null): string =>
        `${emoji} ${rotulo.padEnd(8, ' ')}${conteudo ?? 'não avaliado'}`;
    escreve(
        linhaStatus(
            '🧠',
            'NEURO',
            juntar(
                [numTexto(s.neuro?.descricao), rotulado('RASS', s.neuro?.rass), linhaDva(i.sedativos)],
                ' · ',
            ),
        ),
    );
    escreve(
        linhaStatus(
            '🫁',
            'RESP',
            juntar(
                [
                    numTexto(s.resp?.suporte),
                    rotulado('FiO2', i.fio2, '%'),
                    rotulado('SpO2', piorValor(i.janelas, 'spo2', 'min', '%')),
                    rotulado('P/F', i.pf),
                ],
                ' · ',
            ),
        ),
    );
    escreve(
        linhaStatus(
            '🫀',
            'HEMO',
            juntar(
                [
                    rotulado('PAM', piorValor(i.janelas, 'pam', 'min')),
                    rotulado('FC', piorValor(i.janelas, 'fc', 'max')),
                    linhaDva(i.dvas),
                ],
                ' · ',
            ),
        ),
    );
    escreve(
        linhaStatus(
            '💧',
            'RENAL',
            juntar(
                [
                    rotulado('DU', i.duMlKgH, ' mL/kg/h'),
                    i.bh24h != null ? `BH ${i.bh24h > 0 ? '+' : ''}${numTexto(i.bh24h)} mL` : null,
                    rotulado('Cr', s.renal?.cr),
                    numTexto(s.renal?.descricao),
                ],
                ' · ',
            ),
        ),
    );
    escreve(
        linhaStatus(
            '🩸',
            'HEMATO',
            juntar(
                [rotulado('Hb', s.hemato?.hb), rotulado('Plaq', s.hemato?.plaq), numTexto(s.hemato?.obs)],
                ' · ',
            ),
        ),
    );
    escreve(
        linhaStatus(
            '🦠',
            'INFEC',
            juntar(
                [
                    i.atbsAtivos.length > 0 ? i.atbsAtivos.map(linhaAtbAtivo).join(' · ') : null,
                    numTexto(i.culturasAtivas),
                ],
                ' · ',
            ),
        ),
    );
    escreve('');

    // PONTOS DE ATENÇÃO — só o que muda decisão; MÁXIMO 3 (corte do arquivo 05).
    if (i.alertas.length > 0) {
        escreve(divisoria('PONTOS DE ATENÇÃO'));
        i.alertas.slice(0, 3).forEach((a) => escreve(`🚨 ${a}`));
        escreve('');
    }

    // TAREFAS PENDENTES — RENDER do array, ordenado por prioridade, nunca redigido.
    if (i.pendencias.length > 0) {
        escreve(divisoria('TAREFAS PENDENTES PRÓXIMO TURNO'));
        checklistPendencias(i.pendencias).forEach((l) => escreve(l));
        escreve('');
    }

    // SE PIORAR — só com FONTE (riscos/conduta). Sem fonte, a seção NÃO EXISTE:
    // plano de resgate inventado é o pior tipo de alucinação clínica.
    if (i.sePiorar && i.sePiorar.length > 0) {
        escreve(divisoria('SE PIORAR'));
        i.sePiorar.forEach((l) => escreve(l));
        escreve('');
    }

    escreve(`${'═'.repeat(LARGURA_CAIXA + 2)}`);
    return linhas.join('\n');
}

/**
 * Passagem do plantão: Formato A por paciente, SÓ os pacientes do plantão.
 * A ORDEM DA LISTA É PRESERVADA — quem chama já entrega o mais grave primeiro
 * (a ordenação clínica é decisão do serviço, não de formatação).
 *
 * O Formato B (painel da unidade inteira) NÃO existe aqui, de propósito:
 * desenhar 34 leitos e o rótulo de origem dele foram vetados pelo operador
 * (docs/ARQUITETURA.md, decisão 5).
 */
export function montarPassagem(listaDeInsumos: InsumosPassagem[]): string {
    return listaDeInsumos.map(blocoPassagemPaciente).join('\n\n');
}

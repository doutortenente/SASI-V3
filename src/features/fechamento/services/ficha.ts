/**
 * Gravação da ficha do Fechamento — RPC `save_ficha` + UPDATE complementar.
 *
 * ---------------------------------------------------------------------------
 * POR QUE A GRAVAÇÃO É EM DOIS PASSOS
 * ---------------------------------------------------------------------------
 * A RPC `save_ficha` (migration `20260808102821`) grava paciente + evolução +
 * pendências NUMA TRANSAÇÃO — ela existe porque o v2 fazia 3 escritas soltas
 * e falha no meio deixava estado parcial (decisão 2 de `docs/ARQUITETURA.md`).
 * Mas a função é de 08-ago e não conhece as colunas do P0 de 10-ago
 * (`data_plantao`, `turno`, `tipo_nota`, autor, `illness_severity`,
 * `intercorrencias`, `finalizada_em`) nem o SOFA calculado no app. Esses vão
 * num UPDATE direto em `evolucoes`, DEPOIS da RPC, sobre o id que ela devolve.
 *
 * A divisão de colunas é estrita: o que a RPC grava o UPDATE não toca, e
 * vice-versa — duas escritas na mesma coluna seriam duas verdades
 * concorrentes, e o teste trava isso.
 *
 * ---------------------------------------------------------------------------
 * A ARMADILHA DE `save_ficha` (documentada, não teoria)
 * ---------------------------------------------------------------------------
 * No SQL da função, `hd = p_pac->>'hd'` e `alergias = p_pac->>'alergias'` NÃO
 * têm coalesce: payload sem as chaves APAGA o valor no banco. `idade`, `peso`
 * e `altura` (`nullif(...)::int` sem coalesce) e TODOS os sistemas do caminho
 * de UPDATE (`coalesce(p_evol->'neuro','{}')` — ausente vira objeto VAZIO,
 * não o valor atual) têm o mesmo comportamento. Por isso `PacienteDaFicha` e
 * `EvolucaoDaFicha` fecham esses campos como OBRIGATÓRIOS: a tela carrega a
 * ficha completa e reenvia tudo — esquecer a chave nem compila.
 *
 * Cliente por parâmetro, não por import — mesma doutrina de
 * `features/pendencias/services/pendencias.ts`.
 */
import {datetimeLocalEmSaoPaulo, derivarJanelaDePlantao} from '@/features/captura/lib/plantao';
import type {
    CamposComplementares,
    ClienteSasi,
    EntradaDeFicha,
    PlantaoLegado,
    TurnoDaNota,
} from '@/features/fechamento/types';
import type {Database, Json} from '@/types/supabase';

/**
 * Falha ao gravar a ficha ou o complemento da nota.
 *
 * Separada de `FalhaDeLeitura` porque o estrago é outro: escrita que falha em
 * silêncio faz o médico achar que a nota está salva quando NÃO está — e nota
 * perdida no fim do turno é voltar a transcrever do papel, exatamente o que o
 * V4 existe para matar.
 */
export class FalhaAoGravarFicha extends Error {
    readonly alvo: string;
    readonly causaOriginal: string | undefined;

    constructor(alvo: string, causaOriginal?: string) {
        super(
            `Falha ao gravar ${alvo}. O banco NÃO registrou a mudança — ` +
            `não tratar como salva.` +
            (causaOriginal ? ` Causa: ${causaOriginal}` : ''),
        );
        this.name = 'FalhaAoGravarFicha';
        this.alvo = alvo;
        this.causaOriginal = causaOriginal;
    }
}

/**
 * Entrada recusada ANTES de tocar o banco. Classe separada porque a conduta é
 * outra: aqui o defeito é de quem chamou (corrigir o código/o formulário);
 * em `FalhaAoGravarFicha` o banco é que falhou (tentar de novo).
 */
export class EntradaDeFichaRecusada extends Error {
    readonly motivo: string;

    constructor(motivo: string) {
        super(`Ficha recusada antes do envio: ${motivo}`);
        this.name = 'EntradaDeFichaRecusada';
        this.motivo = motivo;
    }
}

/**
 * O turno REAL da nota vira o `p_plantao` LEGADO que a RPC exige.
 *
 * `plantao_enum` tem 4 valores de uma era em que o dia tinha 3 turnos; o
 * modelo P0 tem 2 (diurna|noturna). O mapa diurna→'manha' e noturna→'noite' é
 * convenção deliberada SÓ para satisfazer a assinatura da RPC — os relógios
 * que valem (`data_plantao` + `turno`) vão explícitos no UPDATE complementar,
 * e a coluna `plantao` é legado que nenhuma tela nova lê.
 */
export function derivarPlantaoLegado(turno: TurnoDaNota): PlantaoLegado {
    return turno === 'diurna' ? 'manha' : 'noite';
}

/**
 * Os dois relógios da nota a partir do instante atual, no fuso do hospital.
 *
 * Reusa `derivarJanelaDePlantao` (Tela 2): a mesma regra dos dois relógios de
 * `fn_evolucao_relogios` no banco — nota noturna iniciada ANTES das 07h
 * pertence ao plantão que começou na véspera às 19h, então `data_plantao` é o
 * dia do INÍCIO da janela, no relógio de São Paulo. O trigger do banco só
 * roda no INSERT; quando a ficha atualiza nota existente, quem garante os
 * relógios é o app — por isso esta função existe.
 */
export function derivarRelogiosDaNota(agora: Date): { dataPlantao: string; turno: TurnoDaNota } {
    const janela = derivarJanelaDePlantao(agora);
    // 'YYYY-MM-DDTHH:mm' no relógio de São Paulo → os 10 primeiros são o dia.
    const dataPlantao = datetimeLocalEmSaoPaulo(janela.inicioISO).slice(0, 10);
    // O relógio de parede fala 'diurno/noturno' (o turno); a coluna fala
    // 'diurna/noturna' (a nota). Mapa explícito, sem mágica de sufixo.
    return {dataPlantao, turno: janela.turno === 'diurno' ? 'diurna' : 'noturna'};
}

/**
 * Grava paciente + evolução + pendências numa transação (RPC `save_ficha`) e
 * devolve o id da evolução gravada — o alvo do `complementarEvolucao`.
 *
 * O payload `p_pac` SEMPRE leva `hd`, `alergias`, `idade`, `peso` e `altura`
 * (ver armadilha no cabeçalho); `nome`/`leito`/`gravidade`/`data_adm` só vão
 * se a tela os trouxe (a função os coalesce, ausente preserva). `p_evol` leva
 * a ficha INTEIRA — e nada além dela: `condutas_sistemas` é modelo morto
 * (decisão 8) e `intercorrencias` é assunto do complementar.
 *
 * `internacao_id` NUNCA é enviado — o trigger carimba o episódio vigente.
 */
export async function salvarFicha(
    supabase: ClienteSasi,
    entrada: EntradaDeFicha,
): Promise<string> {
    const pPac: Record<string, Json> = {
        hd: entrada.paciente.hd,
        alergias: entrada.paciente.alergias,
        idade: entrada.paciente.idade,
        peso: entrada.paciente.peso,
        altura: entrada.paciente.altura,
    };
    if (entrada.paciente.nome !== undefined) pPac.nome = entrada.paciente.nome;
    if (entrada.paciente.leito !== undefined) pPac.leito = entrada.paciente.leito;
    if (entrada.paciente.gravidade !== undefined) pPac.gravidade = entrada.paciente.gravidade;
    if (entrada.paciente.data_adm !== undefined) pPac.data_adm = entrada.paciente.data_adm;

    const e = entrada.evolucao;
    const pEvol = {
        neuro: e.neuro,
        resp: e.resp,
        hemo: e.hemo,
        tgi: e.tgi,
        renal: e.renal,
        hemato: e.hemato,
        infecto: e.infecto,
        dvas: e.dvas,
        sedativos: e.sedativos,
        impressao: e.impressao,
        conduta: e.conduta,
        problemas_ativos: e.problemas_ativos,
        riscos: e.riscos,
    } as unknown as Json;

    const resposta = await supabase.rpc('save_ficha', {
        p_paciente_id: entrada.paciente_id,
        p_pac: pPac,
        p_evol: pEvol,
        // O gerador tipa `p_evolucao_id` como `string`, mas a função SQL trata
        // null (é o caminho de INSERT — nota nova). O cast documenta a lacuna
        // do gerador, que não modela nulabilidade de argumento de função.
        p_evolucao_id: entrada.evolucao_id as string,
        p_plantao: derivarPlantaoLegado(entrada.turno),
        p_pendencias: (entrada.pendencias ?? []) as unknown as Json,
    });

    const alvo = `a ficha do paciente ${entrada.paciente_id}`;
    if (resposta.error) throw new FalhaAoGravarFicha(alvo, resposta.error.message);
    if (typeof resposta.data !== 'string' || resposta.data === '') {
        // A RPC devolve o uuid da evolução; sem ele o complementar não tem
        // alvo — sucesso sem id não é sucesso.
        throw new FalhaAoGravarFicha(alvo);
    }
    return resposta.data;
}

/**
 * As colunas que a RPC `save_ficha` JÁ gravou — proibidas no UPDATE
 * complementar. Exportada para o teste travar a fronteira: se um dia alguém
 * adicionar `neuro` ao patch, o teste fica vermelho antes do banco.
 */
export const CAMPOS_DA_RPC = [
    'neuro',
    'resp',
    'hemo',
    'tgi',
    'renal',
    'hemato',
    'infecto',
    'dvas',
    'sedativos',
    'impressao',
    'conduta',
    'problemas_ativos',
    'condutas_sistemas',
    'riscos',
] as const;

/**
 * Completa a nota com o que a RPC não cobre. Devolve quantas linhas mudaram
 * (0 = id inexistente — o chamador decide se isso é erro).
 *
 * Update PARCIAL de verdade: campo omitido em `campos` NÃO entra no patch e o
 * banco não o toca. `sofa` grava as duas colunas juntas — `sofa_total` sai de
 * `total` (que é `null` enquanto faltar componente: travessão na tela, nunca
 * a soma parcial vestida de total) e `sofa_snapshot` guarda o `ResultadoSofa`
 * inteiro, com `apurados`/`faltando`/`suprimidos` — a transparência
 * "componentes capturados: X/6 · faltando: [...]" exigida pela regra da casa.
 */
export async function complementarEvolucao(
    supabase: ClienteSasi,
    evolucaoId: string,
    campos: CamposComplementares,
): Promise<number> {
    const patch: Database['public']['Tables']['evolucoes']['Update'] = {};
    if (campos.dataPlantao !== undefined) patch.data_plantao = campos.dataPlantao;
    if (campos.turno !== undefined) patch.turno = campos.turno;
    if (campos.tipoNota !== undefined) patch.tipo_nota = campos.tipoNota;
    if (campos.autorCrm !== undefined) patch.autor_crm = campos.autorCrm;
    if (campos.autorNome !== undefined) patch.autor_nome = campos.autorNome;
    if (campos.illnessSeverity !== undefined) patch.illness_severity = campos.illnessSeverity;
    if (campos.intercorrencias !== undefined) patch.intercorrencias = campos.intercorrencias;
    if (campos.sofa !== undefined) {
        patch.sofa_total = campos.sofa.total;
        patch.sofa_snapshot = campos.sofa as unknown as Json;
    }
    if (campos.finalizadaEm !== undefined) patch.finalizada_em = campos.finalizadaEm;

    if (Object.keys(patch).length === 0) {
        // UPDATE sem campo nenhum é erro de programação de quem chamou, não
        // uma gravação vazia bem-sucedida — recusar antes de tocar o banco.
        throw new EntradaDeFichaRecusada(
            'nenhum campo a complementar — chame com ao menos um campo preenchido',
        );
    }

    const resposta = await supabase
        .from('evolucoes')
        .update(patch)
        .eq('id', evolucaoId)
        .select('id');

    if (resposta.error) {
        throw new FalhaAoGravarFicha(
            `o complemento da evolução ${evolucaoId}`,
            resposta.error.message,
        );
    }
    return resposta.data?.length ?? 0;
}

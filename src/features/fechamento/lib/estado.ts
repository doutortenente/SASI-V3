/**
 * O estado da ficha em edição — funções PURAS entre o banco e o formulário.
 *
 * ---------------------------------------------------------------------------
 * POR QUE O ESTADO NÃO MORA NO COMPONENTE
 * ---------------------------------------------------------------------------
 * A ilha client precisa fazer três coisas com a MESMA ficha: mostrar os
 * inputs, montar o texto da pré-visualização e montar o payload da gravação.
 * Se cada uma delas montasse o objeto por conta própria, o texto copiado
 * poderia divergir do que foi salvo — e nota copiada para o prontuário que não
 * bate com a nota do banco é defeito clínico-legal, não estético. Aqui há UMA
 * conversão, testada, e as três consomem dela.
 *
 * ---------------------------------------------------------------------------
 * O QUE A TELA NÃO EDITA MAS PRECISA CARREGAR
 * ---------------------------------------------------------------------------
 * `problemas_ativos` e `riscos` não têm campo nesta tela — e mesmo assim
 * viajam no estado. Motivo: no caminho de UPDATE da RPC `save_ficha`, chave
 * ausente vira `'{}'` (cabeçalho de `services/ficha.ts`), ou seja, não mandar
 * APAGA o que a ingestão gravou. Carregar e reenviar intacto é a única forma
 * de a tela não destruir o que ela nem mostra.
 */
import {
    linhaDeInfusao,
    linhasPreenchidas,
    sistemaLimpo,
    sistemaParaEdicao,
    type FichaParaTexto,
} from '@/features/fechamento/lib/paraTexto';
import {
    CHAVES_SISTEMAS,
    camposDoSistema,
    type ChaveSistema,
} from '@/features/fechamento/lib/campos';
import type {
    EvolucaoCorrente,
    EvolucaoDaFicha,
    TipoDeNota,
} from '@/features/fechamento/types';
import type {
    Gravidade,
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

/** Os 4 valores de `gravidade_enum` pós-P0, com a palavra que a tela mostra. */
export const GRAVIDADES_DA_NOTA: ReadonlyArray<{valor: Gravidade; rotulo: string}> = [
    {valor: 'estavel', rotulo: 'Estável'},
    {valor: 'watcher', rotulo: 'Vigilância'},
    {valor: 'instavel', rotulo: 'Instável'},
    {valor: 'critico', rotulo: 'Crítico'},
];

/** Os 4 valores de `tipo_nota_enum`, com a palavra que a tela mostra. */
export const TIPOS_DE_NOTA: ReadonlyArray<{valor: TipoDeNota; rotulo: string}> = [
    {valor: 'admissao', rotulo: 'Admissão'},
    {valor: 'seriada', rotulo: 'Seriada'},
    {valor: 'alta', rotulo: 'Alta'},
    {valor: 'andar', rotulo: 'Andar'},
];

/**
 * A ficha como o formulário a segura: TUDO em texto.
 *
 * Campo numérico também é texto de propósito — "1,7" digitado com vírgula é a
 * entrada legítima em pt-BR, e converter cedo demais transformaria vírgula em
 * `NaN` ou, pior, em 17. A conversão acontece só no cálculo clínico
 * (`parseNumeroBR`, dentro de `calcularSofa`) e na saída, que já escreve com
 * vírgula.
 */
export interface EstadoDaFicha {
    sistemas: Record<ChaveSistema, Record<string, string>>;
    /** Uma linha por droga, texto livre — a forma que o banco vivo tem hoje. */
    dvas: string[];
    sedativos: string[];
    /** Só o DELTA das últimas 24h (`evolucoes.intercorrencias`). */
    intercorrencias: string[];
    impressao: string[];
    /** 1:1 com a impressão (regra do template). */
    conduta: string[];
    tipoNota: TipoDeNota;
    /** Gravidade DA NOTA — não a do paciente. `null` = ainda não classificada. */
    illnessSeverity: Gravidade | null;
    /** Carregados e reenviados sem edição — ver cabeçalho. */
    problemasAtivos: ProblemaAtivo[];
    riscos: Risco[];
}

/**
 * O estado inicial a partir da nota carregada. Sem nota (`null`), a ficha
 * nasce VAZIA — nunca preenchida com exemplo ou texto genérico: campo em
 * branco é ausência honesta, frase de preenchimento é dado inventado.
 *
 * `tipo_nota` cai em 'seriada' quando não há nota: é o tipo de 99% das notas
 * de plantão, e o médico troca em um toque. `illness_severity` NÃO ganha
 * padrão — classificar gravidade por omissão seria inventar julgamento
 * clínico.
 */
export function estadoInicialDaFicha(evolucao: EvolucaoCorrente | null): EstadoDaFicha {
    const sistemas = {} as Record<ChaveSistema, Record<string, string>>;
    for (const chave of CHAVES_SISTEMAS) {
        sistemas[chave] = sistemaParaEdicao(evolucao?.[chave], camposDoSistema(chave));
    }
    return {
        sistemas,
        dvas: (evolucao?.dvas ?? []).map(linhaDeInfusao).filter((l) => l !== ''),
        sedativos: (evolucao?.sedativos ?? []).map(linhaDeInfusao).filter((l) => l !== ''),
        intercorrencias: evolucao?.intercorrencias ?? [],
        impressao: evolucao?.impressao ?? [],
        conduta: evolucao?.conduta ?? [],
        tipoNota: evolucao?.tipo_nota ?? 'seriada',
        illnessSeverity: evolucao?.illness_severity ?? null,
        problemasAtivos: evolucao?.problemas_ativos ?? [],
        riscos: evolucao?.riscos ?? [],
    };
}

/**
 * Os 7 sistemas limpos (campo vazio some do jsonb, nunca vira 0 nem '').
 *
 * O cast existe porque `sistemaLimpo` devolve o mesmo formato que recebeu
 * (mapa de textos) e os tipos canônicos são mais específicos. A conversão é
 * segura por construção: as CHAVES saem de `camposDoSistema`, que espelha o
 * tipo canônico, e os VALORES são textos — forma aceita pelo esquema
 * (`string | number | null`).
 */
function sistemaTipado<T>(edicao: Record<string, string>): T {
    return sistemaLimpo(edicao) as unknown as T;
}

interface SistemasDaFicha {
    neuro: SistemaNeuro;
    resp: SistemaResp;
    hemo: SistemaHemo;
    tgi: SistemaTgi;
    renal: SistemaRenal;
    hemato: SistemaHemato;
    infecto: SistemaInfecto;
}

export function sistemasDaFicha(estado: EstadoDaFicha): SistemasDaFicha {
    return {
        neuro: sistemaTipado<SistemaNeuro>(estado.sistemas.neuro),
        resp: sistemaTipado<SistemaResp>(estado.sistemas.resp),
        hemo: sistemaTipado<SistemaHemo>(estado.sistemas.hemo),
        tgi: sistemaTipado<SistemaTgi>(estado.sistemas.tgi),
        renal: sistemaTipado<SistemaRenal>(estado.sistemas.renal),
        hemato: sistemaTipado<SistemaHemato>(estado.sistemas.hemato),
        infecto: sistemaTipado<SistemaInfecto>(estado.sistemas.infecto),
    };
}

/**
 * A ficha como o MOTOR DE TEXTO a consome. Mesma fonte do payload de gravação
 * (abaixo) — é o que garante que o texto copiado seja o texto do que foi salvo.
 */
export function fichaParaTexto(estado: EstadoDaFicha): FichaParaTexto {
    return {
        ...sistemasDaFicha(estado),
        dvas: linhasPreenchidas(estado.dvas),
        sedativos: linhasPreenchidas(estado.sedativos),
        impressao: linhasPreenchidas(estado.impressao),
        conduta: linhasPreenchidas(estado.conduta),
        intercorrencias: linhasPreenchidas(estado.intercorrencias),
        problemasAtivos: estado.problemasAtivos,
        riscos: estado.riscos,
    };
}

/**
 * O bloco `p_evol` da RPC `save_ficha`. `intercorrencias` NÃO entra aqui de
 * propósito: a função é de 08-ago e não conhece a coluna — ela vai no UPDATE
 * complementar (`complementarEvolucao`).
 */
export function evolucaoDaFicha(estado: EstadoDaFicha): EvolucaoDaFicha {
    return {
        ...sistemasDaFicha(estado),
        dvas: linhasPreenchidas(estado.dvas),
        sedativos: linhasPreenchidas(estado.sedativos),
        impressao: linhasPreenchidas(estado.impressao),
        conduta: linhasPreenchidas(estado.conduta),
        problemas_ativos: estado.problemasAtivos,
        riscos: estado.riscos,
    };
}

/**
 * A nota carregada pertence AO PLANTÃO CORRENTE?
 *
 * Se não pertence, salvar tem que CRIAR nota nova (evolucao_id = null): gravar
 * por cima usaria a nota de ontem como rascunho de hoje e apagaria o registro
 * do plantão anterior — perda de prontuário, não de rascunho. Os dois relógios
 * (`data_plantao` + `turno`) são a chave da comparação, exatamente como
 * `fn_evolucao_relogios` os deriva no banco.
 */
export function notaEDestePlantao(
    evolucao: EvolucaoCorrente | null,
    dataPlantaoISO: string,
    turno: EvolucaoCorrente['turno'],
): boolean {
    if (evolucao === null) return false;
    return evolucao.data_plantao === dataPlantaoISO && evolucao.turno === turno;
}

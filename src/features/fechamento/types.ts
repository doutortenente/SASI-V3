/**
 * Tipos do Fechamento (Tela 3) — contrato entre serviço, hook e tela.
 *
 * O Fechamento faz duas coisas (`docs/ARQUITETURA.md`, "Tela 3"):
 *  1. LÊ os insumos da nota — a evolução corrente + 8 fontes do banco;
 *  2. GRAVA a ficha revisada via RPC `save_ficha` (transação única) e
 *     complementa a evolução com o que a RPC não cobre.
 *
 * Regra que atravessa tudo (`docs/ARQUITETURA.md`, "Contrato por tela"):
 * `internacao_id` NUNCA é enviado — o trigger do banco carimba. Nenhum tipo de
 * payload abaixo tem o campo: mandar campo a mais nem compila.
 */
import type {SupabaseClient} from '@supabase/supabase-js';

import type {ResultadoSofa} from '@/lib/clinical/sofa';
import type {
    AlertLog,
    Gravidade,
    InfusaoOuTexto,
    IntencaoAtb,
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
    ViaAtb,
} from '@/types';
import type {Database} from '@/types/supabase';

import type {JanelaRender} from '@/features/captura/types';
import type {DispositivoAtivo} from '@/features/devices/services/dispositivos';

/** O cliente Supabase tipado, venha ele do servidor ou do navegador. */
export type ClienteSasi = SupabaseClient<Database>;

/** O turno REAL da nota, do enum pós-P0 (`turno_enum`): diurna | noturna. */
export type TurnoDaNota = Database['public']['Enums']['turno_enum'];

/** Tipo da nota (`tipo_nota_enum`): admissao | seriada | alta | andar. */
export type TipoDeNota = Database['public']['Enums']['tipo_nota_enum'];

/**
 * O formato LEGADO que a RPC `save_ficha` exige em `p_plantao`
 * (`plantao_enum`). Os dois relógios reais (`data_plantao` + `turno`) vão
 * depois, explícitos, no UPDATE complementar — este enum existe só para
 * satisfazer a assinatura da função.
 */
export type PlantaoLegado = Database['public']['Enums']['plantao_enum'];

/**
 * A nota corrente como o Fechamento a lê — os 7 sistemas, as listas e os dois
 * relógios do P0 de 10-ago.
 *
 * `dvas`/`sedativos` são `InfusaoOuTexto[]`: o banco vivo guarda TEXTO puro
 * (`["Tridil 12 ml/h"]`) nos registros existentes, e tipar só como objeto já
 * fez a tela descartar 100% das drogas duas vezes (defeito documentado em
 * `docs/ARQUITETURA.md`, mapa de reuso).
 */
export interface EvolucaoCorrente {
    id: string;
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
    /** Coluna nova (migration de 13-ago) — a seção "Intercorrências 24h" da nota. */
    intercorrencias: string[];
    problemas_ativos: ProblemaAtivo[];
    riscos: Risco[];
    sofa_snapshot: Json | null;
    sofa_total: number | null;
    /** Dia do plantão (noturna iniciada antes das 07h cai no dia anterior). */
    data_plantao: string;
    turno: TurnoDaNota;
    tipo_nota: TipoDeNota;
    /** Gravidade DA NOTA, não a corrente do paciente. */
    illness_severity: Gravidade | null;
    autor_crm: string | null;
    autor_nome: string | null;
    /** Preenchida = nota fechada. `null` = rascunho ainda aberto. */
    finalizada_em: string | null;
}

/**
 * Uma linha de `atbs` — o histórico COMPLETO, que é o que a evolução carrega
 * (decisão de produto de 10-ago: evolução leva o completo, passagem só os
 * ativos). Sem `internacao_id` (assunto do trigger) e sem `user_id`/carimbos
 * (a nota não os consome).
 */
export interface AtbRegistro {
    id: string;
    paciente_id: string;
    droga: string;
    dose: string | null;
    via: ViaAtb | null;
    frequencia: string | null;
    data_inicio: string;
    /** `null` = ainda em curso. */
    data_fim: string | null;
    intencao: IntencaoAtb | null;
    foco: string | null;
    agente_alvo: string | null;
    motivo_suspensao: string | null;
    duracao_planejada_dias: number | null;
}

/**
 * Uma linha de `vw_dias_atb_ativo` — só os ATB EM CURSO, com dias de terapia
 * DERIVADOS NO BANCO. É a fonte da passagem de plantão; recalcular dias na
 * tela é proibido pela mesma regra dos dispositivos (relógio do navegador
 * pode divergir do banco).
 */
export interface AtbAtivo {
    atb_id: string;
    paciente_id: string;
    droga: string;
    via: ViaAtb | null;
    frequencia: string | null;
    data_inicio: string | null;
    /** `null` fica `null` (sem data de início não há conta) — travessão na tela, nunca 0. */
    dias_terapia: number | null;
    intencao: IntencaoAtb | null;
    foco: string | null;
    agente_alvo: string | null;
    stewardship_flag: string | null;
}

/** A linha de `vw_bh_acumulado` de um paciente. `null` em campo = sem evento de BH na janela. */
export interface BhAcumulado {
    paciente_id: string;
    bh_24h: number | null;
    bh_48h: number | null;
    bh_72h: number | null;
    eventos_24h: number | null;
}

/**
 * O último dia de `vw_sofa_diario`, com a transparência exigida pela regra da
 * casa: `sofa_parcial` é a soma do APURADO (por isso o nome), e
 * `componentes_presentes`/`componentes_faltantes` dizem X/6 e o que falta —
 * a tela nunca mostra o parcial como se fosse total.
 */
export interface SofaDiario {
    paciente_id: string;
    dia: string;
    s_resp: number | null;
    s_coag: number | null;
    s_liver: number | null;
    s_cardio: number | null;
    s_neuro: number | null;
    s_renal: number | null;
    sofa_parcial: number | null;
    componentes_presentes: number | null;
    componentes_faltantes: string[] | null;
}

/**
 * Tudo que o Fechamento lê ALÉM da nota corrente, numa ida só (Promise.all).
 * Lista vazia e `null` são respostas legítimas (tabela sem insumo ainda);
 * falha de leitura em QUALQUER fonte lança e derruba o conjunto.
 */
export interface InsumosDoFechamento {
    /** A mais recente janela de cada tipo, com `render` pronto do banco. */
    janelas: JanelaRender[];
    /** Histórico completo — vai na evolução. */
    atbHistoricoCompleto: AtbRegistro[];
    /** Só os em curso, com dias derivados — vai na passagem. */
    atbAtivos: AtbAtivo[];
    bh: BhAcumulado | null;
    sofaDiario: SofaDiario | null;
    dispositivos: DispositivoAtivo[];
    pendencias: Pendencia[];
    alertasAbertos: AlertLog[];
}

/**
 * O bloco `p_pac` da RPC `save_ficha` — dados do paciente que a ficha reenvia.
 *
 * ARMADILHA DOCUMENTADA (`docs/ARQUITETURA.md` e a própria função, migration
 * `20260808102821`): `hd` e `alergias` gravam SEM coalesce — payload sem as
 * chaves APAGA o valor no banco. `idade`, `peso` e `altura` têm a MESMA
 * armadilha (`nullif(...)` sem coalesce). Por isso os cinco são OBRIGATÓRIOS
 * no tipo: quem chama recebe os valores na carga da tela e reenvia sempre —
 * esquecer a chave nem compila.
 *
 * `nome`, `leito`, `gravidade` e `data_adm` têm coalesce na função (ausente
 * preserva o valor atual) — podem ficar de fora sem estrago.
 */
export interface PacienteDaFicha {
    hd: string | null;
    alergias: string | null;
    idade: number | null;
    peso: number | null;
    altura: number | null;
    nome?: string;
    leito?: string;
    gravidade?: Gravidade | null;
    data_adm?: string | null;
}

/**
 * O bloco `p_evol` da RPC — a ficha por sistemas revisada na tela.
 *
 * TODOS os campos são obrigatórios de propósito: no caminho de UPDATE da RPC,
 * cada sistema ausente vira `coalesce(..., '{}')` — ou seja, chave faltando
 * APAGA a seção inteira da nota. A tela carrega a nota completa antes de
 * editar, então reenviar tudo não custa nada e fechar o tipo evita o apagão.
 *
 * `condutas_sistemas` NÃO existe aqui: modelo morto (decisão 8 de
 * `docs/ARQUITETURA.md` — 0 evoluções o usam). `intercorrencias` também não:
 * a RPC não a conhece; ela vai no UPDATE complementar.
 */
export interface EvolucaoDaFicha {
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
    problemas_ativos: ProblemaAtivo[];
    riscos: Risco[];
}

/**
 * Um item de `p_pendencias` da RPC: com `id` ela ATUALIZA (tarefa/conclusão);
 * sem `id` e com `tarefa` ela CRIA (prioridade fixa 2 — o 1 é escolha ativa
 * na tela de Captura, não no fechamento em lote).
 */
export interface PendenciaDaFicha {
    id?: string;
    tarefa: string;
    concluida?: boolean;
}

/** A entrada completa de `salvarFicha` — paciente + evolução + pendências. */
export interface EntradaDeFicha {
    paciente_id: string;
    /** `null` = criar nota nova (caminho de INSERT da RPC); id = atualizar a corrente. */
    evolucao_id: string | null;
    /** O turno REAL — vira o `p_plantao` legado só para satisfazer a RPC. */
    turno: TurnoDaNota;
    paciente: PacienteDaFicha;
    evolucao: EvolucaoDaFicha;
    pendencias?: PendenciaDaFicha[];
}

/**
 * O que o UPDATE complementar grava — exatamente o que a RPC `save_ficha` NÃO
 * cobre. Campo omitido NÃO é tocado (é update parcial); os campos que a RPC
 * já gravou são proibidos aqui de propósito — duas escritas na mesma coluna
 * seriam duas verdades concorrentes.
 *
 * `sofa` leva o `ResultadoSofa` INTEIRO (de `calcularSofa`), nunca um número
 * solto: `sofa_total` sai de `total` (null enquanto incompleto — travessão,
 * nunca soma parcial disfarçada) e `sofa_snapshot` guarda o resultado com
 * `apurados`, `faltando` e `suprimidos` — a transparência "X/6 · faltando"
 * exigida pela regra da casa.
 */
export interface CamposComplementares {
    /** Dia do plantão ('YYYY-MM-DD'). Ver `derivarRelogiosDaNota`. */
    dataPlantao?: string;
    turno?: TurnoDaNota;
    tipoNota?: TipoDeNota;
    autorCrm?: string | null;
    autorNome?: string | null;
    illnessSeverity?: Gravidade | null;
    intercorrencias?: string[];
    sofa?: ResultadoSofa;
    /** Carimbo ISO do fechamento da nota. Só mandar ao FECHAR de fato. */
    finalizadaEm?: string;
}

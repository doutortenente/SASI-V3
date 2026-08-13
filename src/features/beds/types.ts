/**
 * Contrato do domínio "leitos" — o que a tela do leito precisa saber.
 *
 * Espelha a view `vw_dashboard_uti` do banco (1 linha por leito ATIVO), que já entrega
 * o paciente, o último SOFA, o delta de 24h e a contagem de pendências num round-trip só.
 * Consultar as 4 tabelas separado e juntar no navegador seria mais lento e daria
 * resultado inconsistente (cada consulta chega num instante diferente).
 */
import type {TriadoParaGrade} from '@/lib/clinical/sasi';
import type {DispositivoAtivo} from '@/features/devices/services/dispositivos';
import type {Dispositivos, Gravidade, Isolamento, Pendencia, SeveridadeVisual, StatusLeito, Uti, VwDashboardUti,} from '@/types';

/**
 * Uma linha da grade de leitos, já triada.
 *
 * `TriadoParaGrade` acrescenta `semaforo` (derivado da gravidade),
 * `divergenciaDeSemaforo` (a coluna do banco discorda) e `acuidade`.
 * O card pinta `semaforo`, NÃO `severidade_visual` — ver o comentário em
 * `lib/clinical/sasi.ts`, seção "Semáforo exibido".
 */
export interface LeitoNaGrade extends VwDashboardUti, TriadoParaGrade {
}

/** Filtro da grade. Todo campo é opcional: ausente = não filtra. */
export interface FiltroLeitos {
    uti?: Uti;
    gravidade?: Gravidade;
    severidade?: SeveridadeVisual;
    isolamento?: Isolamento;
    status?: StatusLeito;
    /** Busca por nome ou leito. O banco tem índice trigram em `nome`. */
    busca?: string;
    /** Só leito com alerta não reconhecido. */
    somenteComAlerta?: boolean;
}

/** Como a grade é ordenada. `acuidade` é o padrão: o mais grave primeiro. */
export type OrdemDaGrade = 'acuidade' | 'leito' | 'sofa' | 'dias_internacao';

/** Chaves de dispositivo invasivo, para o card mostrar os selos. */
export type ChaveDispositivo = keyof Dispositivos;

/** Contagem de alertas abertos de um leito — espelha `vw_alertas_abertos`. */
export interface ContagemDeAlertasDoLeito {
    criticos: number;
    warnings: number;
    infos: number;
}

/**
 * O dado AO VIVO que a ilha client (`PainelMeuPlantao`) injeta na grade.
 *
 * Convenção dos mapas: `undefined` no mapa inteiro = a consulta ainda não
 * respondeu (ou falhou — ver o `erro` correspondente); paciente AUSENTE de um
 * mapa carregado = zero itens, um fato medido. As duas coisas são clinicamente
 * opostas e o card as mostra diferente.
 */
export interface DadosVivosDoPlantao {
    alertasPorPaciente: ReadonlyMap<string, ContagemDeAlertasDoLeito>;
    pendenciasPorPaciente: Record<string, Pendencia[]> | undefined;
    erroPendencias: Error | null;
    dispositivosPorPaciente: Record<string, DispositivoAtivo[]> | undefined;
    erroDispositivos: Error | null;
}

/**
 * O que o `BedCard` recebe. Os campos ao vivo são opcionais: sem eles o card
 * renderiza só o retrato do servidor (`vw_dashboard_uti`), sem interatividade.
 */
export interface PropsBedCard {
    leito: LeitoNaGrade;
    /** Instante da renderização, vindo da página — relógio único da grade. */
    agoraISO: string;
    /** Alertas abertos deste leito, vindo de `vw_alertas_abertos` (via `useAlertas`). */
    alertasAbertos?: ContagemDeAlertasDoLeito | undefined;
    /** Pendências ABERTAS ao vivo. `undefined` = consulta ainda sem resposta. */
    pendencias?: Pendencia[] | undefined;
    erroPendencias?: Error | null | undefined;
    /** Episódios de dispositivo ativos (`vw_dispositivos_ativos`), com dias de uso. */
    dispositivos?: DispositivoAtivo[] | undefined;
    erroDispositivos?: Error | null | undefined;
}

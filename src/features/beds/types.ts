/**
 * Contrato do domínio "leitos" — o que a tela do leito precisa saber.
 *
 * Espelha a view `vw_dashboard_uti` do banco (1 linha por leito ATIVO), que já entrega
 * o paciente, o último SOFA, o delta de 24h e a contagem de pendências num round-trip só.
 * Consultar as 4 tabelas separado e juntar no navegador seria mais lento e daria
 * resultado inconsistente (cada consulta chega num instante diferente).
 */
import type { Acuidade } from '@/lib/clinical/sasi';
import type {
  Dispositivos,
  Gravidade,
  Isolamento,
  SeveridadeVisual,
  StatusLeito,
  Uti,
  VwDashboardUti,
} from '@/types';

/** Uma linha da grade de leitos, já triada. */
export interface LeitoNaGrade extends VwDashboardUti {
  acuidade: Acuidade;
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

/** O que o `BedCard` recebe. */
export interface PropsBedCard {
  leito: LeitoNaGrade;
  /** Alertas abertos deste leito, vindo de `vw_alertas_abertos`. */
  alertasAbertos?: { criticos: number; warnings: number; infos: number };
  aoAbrir?: (pacienteId: string) => void;
  /** Marca o card como desatualizado quando o canal ao vivo cai. */
  desatualizado?: boolean;
}

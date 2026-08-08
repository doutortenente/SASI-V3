import 'server-only';
/**
 * Leitura dos leitos ocupados para o War Room.
 *
 * A view `vw_dashboard_uti` já entrega paciente + último SOFA + delta de 24h +
 * contagem de pendências numa consulta só, e já vem filtrada por leito ATIVO.
 * Consultar as tabelas separado e juntar no navegador seria mais lento e daria
 * resultado inconsistente: cada consulta chega num instante diferente.
 */
import { triagemDeLeitos } from '@/lib/clinical/sasi';
import { exigirDado } from '@/lib/data/erros';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { LeitoNaGrade } from '@/features/beds/types';

/**
 * Colunas pedidas UMA A UMA, de propósito.
 *
 * `select('*')` aqui puxaria `sofa_snapshot` e `sedativos` (JSONB inteiros) em
 * toda carga da tela, para exibir dois números. Débito conhecido do v2.
 */
const COLUNAS = [
  'paciente_id',
  'leito',
  'uti',
  'nome',
  'idade',
  'hd',
  'gravidade',
  'severidade_visual',
  'dias_internacao',
  'ultima_evolucao',
  'sofa_total',
  'delta_sofa_24h',
  'out_of_range_count',
  'pendencias_abertas',
  'dispositivos',
  'isolation',
  'dvas',
].join(',');

/**
 * Os leitos ocupados, já triados (mais grave primeiro).
 *
 * Lista vazia é resposta legítima — "nenhum leito ocupado" é um fato clínico.
 * Falha de leitura NÃO vira lista vazia: `exigirDado` lança e a exceção sobe
 * até `app/error.tsx`.
 */
export async function lerLeitosOcupados(): Promise<LeitoNaGrade[]> {
  const supabase = await getSupabaseServer();
  const resposta = await supabase.from('vw_dashboard_uti').select(COLUNAS);
  const linhas = exigirDado(resposta, 'vw_dashboard_uti (painel de leitos)');

  // A view não declara NOT NULL nas colunas (é view), então o tipo gerado as traz
  // opcionais. A triagem precisa de gravidade e leito; sem eles a linha não é
  // exibível e ficar em silêncio seria pior do que barulho.
  return triagemDeLeitos(
    (linhas as unknown as LeitoNaGrade[]).filter((l) => l.leito != null && l.gravidade != null),
  ) as LeitoNaGrade[];
}

/** Contagem por UTI para o cabeçalho: ocupados de quantos leitos a unidade tem. */
export function ocupacaoPorUti(leitos: LeitoNaGrade[]): Record<string, number> {
  return leitos.reduce<Record<string, number>>((acc, l) => {
    acc[l.uti] = (acc[l.uti] ?? 0) + 1;
    return acc;
  }, {});
}

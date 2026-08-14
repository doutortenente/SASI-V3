/**
 * Leitura de `pacientes` para o Fechamento — os campos que a ficha REENVIA.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTE SERVIÇO EXISTE (e `vw_dashboard_uti` não basta)
 * ---------------------------------------------------------------------------
 * A RPC `save_ficha` tem a armadilha documentada (migration `20260808102821`,
 * cabeçalho de `ficha.ts`): `hd`, `alergias`, `idade`, `peso` e `altura`
 * gravam SEM coalesce — payload sem as chaves APAGA o valor no banco. Para
 * reenviar, é preciso antes CARREGAR os cinco. A consulta do painel
 * (`lerLeitosOcupados`) não pede `peso`, `altura`, `alergias` nem
 * `patient_summary` — pedir lá encareceria toda carga do Meu plantão para
 * servir só esta tela. Então o Fechamento lê `pacientes` por conta própria,
 * só os ids do plantão.
 *
 * `patient_summary` vem junto porque a nota usa a ficha CONGELADA da admissão
 * (seção "Admissão" do TEMPLATE-BASE, que não atualiza) — e essa ficha mora
 * nesse jsonb.
 *
 * Cliente por parâmetro, não por import — mesma doutrina de
 * `features/pendencias/services/pendencias.ts`: quem chama decide se está no
 * servidor ou no navegador, e o teste dispensa mock de módulo.
 */
import {exigirDado} from '@/lib/data/erros';
import type {Gravidade, Json} from '@/types';

import type {ClienteSasi, TurnoDaNota} from '@/features/fechamento/types';

/**
 * O paciente como a ficha precisa dele. Os 5 campos da armadilha do
 * `save_ficha` são NÃO-opcionais no tipo (podem ser `null`, nunca ausentes):
 * quem monta o payload recebe os valores daqui e reenvia sempre.
 */
export interface PacienteParaFicha {
    id: string;
    nome: string;
    leito: string;
    uti: string;
    gravidade: Gravidade;
    hd: string | null;
    alergias: string | null;
    idade: number | null;
    peso: number | null;
    altura: number | null;
    /** A ficha congelada da admissão (contrato `PatientSummary`). */
    patient_summary: Json | null;
}

/**
 * Colunas uma a uma, como string literal (não `[...].join(',')`), para o
 * cliente tipado inferir a linha de volta: errar nome de coluna vira erro de
 * compilação. `dispositivos` fica de fora (é DERIVADO, e a tela lê
 * `vw_dispositivos_ativos`); `data_adm` fica de fora (legado pós-P0 — dias de
 * internação vêm de `vw_dashboard_uti.dias_internacao`).
 */
const COLUNAS_PACIENTE =
    'id, nome, leito, uti, gravidade, hd, alergias, idade, peso, altura, patient_summary';

/**
 * Os pacientes pedidos, na MESMA ordem da lista de ids recebida.
 *
 * A ordem importa: quem chama já triou (mais grave primeiro, para a passagem)
 * e o banco devolve `.in()` em ordem própria — reordenar aqui preserva a
 * decisão clínica do chamador. Id sem linha no banco simplesmente não vem
 * (paciente apagado entre a triagem e esta consulta); o chamador decide o que
 * fazer com a ausência. Falha de leitura lança via `exigirDado`.
 */
export async function lerPacientesParaFicha(
    supabase: ClienteSasi,
    ids: string[],
): Promise<PacienteParaFicha[]> {
    if (ids.length === 0) return [];
    const resposta = await supabase.from('pacientes').select(COLUNAS_PACIENTE).in('id', ids);
    const linhas = exigirDado(resposta, 'pacientes (dados da ficha do fechamento)');
    const porId = new Map((linhas as unknown as PacienteParaFicha[]).map((p) => [p.id, p]));
    return ids.map((id) => porId.get(id)).filter((p): p is PacienteParaFicha => p !== undefined);
}

/**
 * O resumo da nota mais recente de um paciente — o suficiente para a lista do
 * Fechamento dizer "há nota deste plantão? finalizada?" sem carregar os 7
 * sistemas de todo mundo.
 */
export interface ResumoDeNota {
    paciente_id: string;
    data_plantao: string;
    turno: TurnoDaNota;
    finalizada_em: string | null;
    data_evolucao: string;
}

/** Colunas do resumo — só os relógios e o estado, nunca o corpo da nota. */
const COLUNAS_RESUMO_NOTA = 'paciente_id, data_plantao, turno, finalizada_em, data_evolucao';

/**
 * A nota MAIS RECENTE de cada paciente pedido, indexada por paciente.
 *
 * Uma consulta só para a lista inteira (6–12 pacientes) — chamar
 * `lerEvolucaoCorrente` por paciente seriam N idas ao banco carregando os 7
 * sistemas que a lista nem mostra. Paciente ausente do mapa = SEM NOTA
 * NENHUMA (fato legítimo: recém-admitido); falha de leitura lança.
 */
export async function lerResumoDasNotas(
    supabase: ClienteSasi,
    ids: string[],
): Promise<Record<string, ResumoDeNota>> {
    if (ids.length === 0) return {};
    const resposta = await supabase
        .from('evolucoes')
        .select(COLUNAS_RESUMO_NOTA)
        .in('paciente_id', ids)
        .order('data_evolucao', {ascending: false});
    const linhas = exigirDado(resposta, 'evolucoes (resumo das notas do fechamento)');

    // Ordenado do mais novo para o mais velho: a PRIMEIRA linha de cada
    // paciente é a nota corrente; as demais são história e não sobrescrevem.
    const mapa: Record<string, ResumoDeNota> = {};
    for (const linha of linhas as unknown as ResumoDeNota[]) {
        mapa[linha.paciente_id] ??= linha;
    }
    return mapa;
}

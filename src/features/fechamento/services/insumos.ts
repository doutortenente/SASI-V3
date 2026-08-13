/**
 * Insumos do Fechamento (Tela 3) — a leitura de tudo que vira nota.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTE ARQUIVO SÓ LÊ
 * ---------------------------------------------------------------------------
 * O Fechamento monta a evolução e a passagem a partir do que a Captura e a
 * ingestão já gravaram. A gravação (RPC `save_ficha` + UPDATE complementar)
 * mora em `ficha.ts` — separar leitura de escrita deixa cada contrato testável
 * sozinho e impede que uma tela de leitura importe, sem querer, o poder de
 * escrever.
 *
 * ---------------------------------------------------------------------------
 * POR QUE `Promise.all`, E NÃO `allSettled`
 * ---------------------------------------------------------------------------
 * São 8 fontes independentes — em paralelo a espera é a da fonte mais lenta,
 * não a soma. E `Promise.all` derruba o conjunto na PRIMEIRA falha, de
 * propósito: com `allSettled` a nota sairia sem a seção que falhou, em
 * silêncio — e evolução sem os ATB porque a rede caiu é exatamente o tipo de
 * mentira que `exigirDado` existe para impedir. Falha parcial de leitura é
 * falha total.
 *
 * Cliente por parâmetro, não por import — mesma doutrina de
 * `features/pendencias/services/pendencias.ts`: quem chama decide se está no
 * servidor ou no navegador, e o teste dispensa mock de módulo.
 */
import {exigirDado} from '@/lib/data/erros';

import {lerAlertasAbertosDoPaciente} from '@/features/alerts/services/alertas';
import {lerJanelasDoPaciente} from '@/features/captura/services/janelas';
import type {JanelaRender} from '@/features/captura/types';
import {lerDispositivosDoPaciente} from '@/features/devices/services/dispositivos';
import type {
    AtbAtivo,
    AtbRegistro,
    BhAcumulado,
    ClienteSasi,
    EvolucaoCorrente,
    InsumosDoFechamento,
    SofaDiario,
} from '@/features/fechamento/types';
import {lerPendenciasDoPaciente} from '@/features/pendencias/services/pendencias';

/**
 * Colunas da nota, uma a uma, como string literal (não `[...].join(',')`) para
 * o cliente tipado inferir a linha de volta: errar nome de coluna vira erro de
 * compilação. `internacao_id` fica de fora (assunto do trigger); `plantao` e
 * `condutas_sistemas` ficam de fora porque são LEGADO — ler legado numa tela
 * nova é convidá-lo a sobreviver.
 */
const COLUNAS_EVOLUCAO =
    'id, neuro, resp, hemo, tgi, renal, hemato, infecto, dvas, sedativos, ' +
    'impressao, conduta, intercorrencias, problemas_ativos, riscos, ' +
    'sofa_snapshot, sofa_total, data_plantao, turno, tipo_nota, ' +
    'illness_severity, autor_crm, autor_nome, finalizada_em';

/**
 * A nota mais recente do paciente — a que o Fechamento abre para revisar.
 *
 * `null` é resposta LEGÍTIMA AQUI, e só aqui: paciente recém-admitido ainda
 * não tem nota nenhuma, e o Fechamento então cria a primeira (caminho de
 * INSERT da RPC). Não confundir com falha de leitura, que continua LANÇANDO
 * via `exigirDado` — "não existe nota" e "não consegui perguntar" seguem
 * clinicamente opostos; o que muda neste serviço é que a ausência tem
 * significado clínico próprio.
 */
export async function lerEvolucaoCorrente(
    supabase: ClienteSasi,
    pacienteId: string,
): Promise<EvolucaoCorrente | null> {
    const resposta = await supabase
        .from('evolucoes')
        .select(COLUNAS_EVOLUCAO)
        .eq('paciente_id', pacienteId)
        .order('data_evolucao', {ascending: false})
        .limit(1);
    const linhas = exigirDado(resposta, `evolução corrente do paciente ${pacienteId}`);
    const linha = (linhas as unknown as EvolucaoCorrente[])[0];
    return linha ?? null;
}

/**
 * A mais recente janela de CADA tipo — a nota mostra uma linha por vital
 * ("PAM 90-56 (4/12 <65)"), não o histórico inteiro.
 *
 * Compara `janela_fim` como string: ISO 8601 em UTC ordena lexicograficamente
 * igual a ordenar por data, sem parse. Linha sem `tipo` é descartada (não há
 * do que ela ser "a mais recente"); linha sem `janela_fim` perde para
 * qualquer uma datada — janela sem fim declarado não pode reivindicar ser a
 * atual. Função pura, independente da ordem de chegada.
 */
export function maisRecentePorTipo(janelas: JanelaRender[]): JanelaRender[] {
    const porTipo = new Map<string, JanelaRender>();
    for (const j of janelas) {
        if (j.tipo == null) continue;
        const atual = porTipo.get(j.tipo);
        if (!atual || (j.janela_fim ?? '') > (atual.janela_fim ?? '')) {
            porTipo.set(j.tipo, j);
        }
    }
    return [...porTipo.values()];
}

/**
 * Colunas de `atbs`, conferidas contra `src/types/supabase.ts`. Sem
 * `internacao_id`, `user_id` e carimbos — a nota não os consome.
 */
const COLUNAS_ATB =
    'id, paciente_id, droga, dose, via, frequencia, data_inicio, data_fim, ' +
    'intencao, foco, agente_alvo, motivo_suspensao, duracao_planejada_dias';

/**
 * O histórico COMPLETO de ATB — decisão de produto de 10-ago: a evolução
 * carrega o completo; a passagem, só os ativos (que vêm da view, abaixo).
 * Mais recente primeiro: o esquema vigente interessa antes do que já acabou.
 *
 * Lista vazia é legítima (`atbs` está em 0 linhas até a ingestão alimentar —
 * medido em `docs/MAPA-BANCO-TELAS.md`); falha de leitura lança.
 */
export async function lerAtbsDoPaciente(
    supabase: ClienteSasi,
    pacienteId: string,
): Promise<AtbRegistro[]> {
    const resposta = await supabase
        .from('atbs')
        .select(COLUNAS_ATB)
        .eq('paciente_id', pacienteId)
        .order('data_inicio', {ascending: false});
    const linhas = exigirDado(resposta, `atbs do paciente ${pacienteId}`);
    return linhas as unknown as AtbRegistro[];
}

/** Colunas de `vw_dias_atb_ativo` — `dias_terapia` é DERIVADO NO BANCO. */
const COLUNAS_ATB_ATIVO =
    'atb_id, paciente_id, droga, via, frequencia, data_inicio, dias_terapia, ' +
    'intencao, foco, agente_alvo, stewardship_flag';

/** Linha crua da view, como o gerador a entrega (tudo opcional). */
interface LinhaCruaDeAtbAtivo {
    atb_id: string | null;
    paciente_id: string | null;
    droga: string | null;
    via: AtbAtivo['via'];
    frequencia: string | null;
    data_inicio: string | null;
    dias_terapia: number | null;
    intencao: AtbAtivo['intencao'];
    foco: string | null;
    agente_alvo: string | null;
    stewardship_flag: string | null;
}

/**
 * Descarta a linha que não dá para atribuir: sem `atb_id`/`paciente_id`/
 * `droga` não se sabe QUAL antibiótico é de QUEM. Na prática a view nunca os
 * devolve nulos (vêm de colunas NOT NULL de `atbs`), mas o gerador de tipos
 * trata coluna de view como opcional — mesmo tratamento de
 * `normalizarDispositivos`. `dias_terapia` null NÃO descarta: o ATB existe,
 * só a conta de dias é que falta (travessão na tela, nunca 0).
 */
export function normalizarAtbsAtivos(linhas: LinhaCruaDeAtbAtivo[]): AtbAtivo[] {
    const pronto: AtbAtivo[] = [];
    for (const l of linhas) {
        if (l.atb_id == null || l.paciente_id == null || l.droga == null) continue;
        pronto.push({
            atb_id: l.atb_id,
            paciente_id: l.paciente_id,
            droga: l.droga,
            via: l.via ?? null,
            frequencia: l.frequencia ?? null,
            data_inicio: l.data_inicio ?? null,
            dias_terapia: l.dias_terapia ?? null,
            intencao: l.intencao ?? null,
            foco: l.foco ?? null,
            agente_alvo: l.agente_alvo ?? null,
            stewardship_flag: l.stewardship_flag ?? null,
        });
    }
    return pronto;
}

/**
 * Só os ATB EM CURSO, com dias de terapia contados pelo banco — a fonte da
 * passagem de plantão. `data_inicio asc` põe no topo o esquema há mais tempo
 * rodando: é o que o stewardship revisa primeiro (mesma lógica dos dias de
 * cateter em `dispositivos.ts`).
 */
export async function lerAtbsAtivosDoPaciente(
    supabase: ClienteSasi,
    pacienteId: string,
): Promise<AtbAtivo[]> {
    const resposta = await supabase
        .from('vw_dias_atb_ativo')
        .select(COLUNAS_ATB_ATIVO)
        .eq('paciente_id', pacienteId)
        .order('data_inicio', {ascending: true});
    const linhas = exigirDado(resposta, `vw_dias_atb_ativo do paciente ${pacienteId}`);
    return normalizarAtbsAtivos(linhas as unknown as LinhaCruaDeAtbAtivo[]);
}

/** Colunas de `vw_bh_acumulado` — os acumulados vêm prontos do banco. */
const COLUNAS_BH = 'paciente_id, bh_24h, bh_48h, bh_72h, eventos_24h';

/**
 * O balanço hídrico acumulado do paciente — a view agrega por paciente, então
 * vem 0 ou 1 linha. `null` = nenhum evento de BH registrado (a tela mostra
 * travessão na seção, nunca "BH 0": zero é um balanço MEDIDO e neutro,
 * ausência é outra coisa).
 */
export async function lerBhAcumulado(
    supabase: ClienteSasi,
    pacienteId: string,
): Promise<BhAcumulado | null> {
    const resposta = await supabase
        .from('vw_bh_acumulado')
        .select(COLUNAS_BH)
        .eq('paciente_id', pacienteId);
    const linhas = exigirDado(resposta, `vw_bh_acumulado do paciente ${pacienteId}`);
    const linha = (linhas as unknown as BhAcumulado[])[0];
    return linha ?? null;
}

/** Colunas de `vw_sofa_diario` — inclui a transparência (presentes/faltantes). */
const COLUNAS_SOFA_DIARIO =
    'paciente_id, dia, s_resp, s_coag, s_liver, s_cardio, s_neuro, s_renal, ' +
    'sofa_parcial, componentes_presentes, componentes_faltantes';

/**
 * O ÚLTIMO dia de `vw_sofa_diario` — o SOFA que a nota comenta é o do plantão
 * corrente, não a série. A view já entrega `componentes_presentes` e
 * `componentes_faltantes`: é o que permite à tela cumprir a regra
 * "componentes capturados: X/6 · faltando: [...]" sem inventar escore cheio
 * a partir de soma parcial.
 */
export async function lerSofaDiarioMaisRecente(
    supabase: ClienteSasi,
    pacienteId: string,
): Promise<SofaDiario | null> {
    const resposta = await supabase
        .from('vw_sofa_diario')
        .select(COLUNAS_SOFA_DIARIO)
        .eq('paciente_id', pacienteId)
        .order('dia', {ascending: false})
        .limit(1);
    const linhas = exigirDado(resposta, `vw_sofa_diario do paciente ${pacienteId}`);
    const linha = (linhas as unknown as SofaDiario[])[0];
    return linha ?? null;
}

/**
 * Todos os insumos da nota numa ida só, em paralelo.
 *
 * As 3 fontes que JÁ tinham serviço são importadas, não reescritas
 * (`docs/ARQUITETURA.md`, mapa de reuso): dispositivos de
 * `features/devices`, pendências de `features/pendencias`, alertas de
 * `features/alerts`. Reescrever aqui criaria uma segunda consulta que
 * diverge da primeira — o defeito clássico deste repo.
 */
export async function lerInsumosDoFechamento(
    supabase: ClienteSasi,
    pacienteId: string,
): Promise<InsumosDoFechamento> {
    const [
        janelasTodas,
        atbHistoricoCompleto,
        atbAtivos,
        bh,
        sofaDiario,
        dispositivos,
        pendencias,
        alertasAbertos,
    ] = await Promise.all([
        lerJanelasDoPaciente(supabase, pacienteId),
        lerAtbsDoPaciente(supabase, pacienteId),
        lerAtbsAtivosDoPaciente(supabase, pacienteId),
        lerBhAcumulado(supabase, pacienteId),
        lerSofaDiarioMaisRecente(supabase, pacienteId),
        lerDispositivosDoPaciente(supabase, pacienteId),
        lerPendenciasDoPaciente(supabase, pacienteId),
        lerAlertasAbertosDoPaciente(supabase, pacienteId),
    ]);

    return {
        janelas: maisRecentePorTipo(janelasTodas),
        atbHistoricoCompleto,
        atbAtivos,
        bh,
        sofaDiario,
        dispositivos,
        pendencias,
        alertasAbertos,
    };
}

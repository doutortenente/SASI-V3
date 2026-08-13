/**
 * Vocabulário da Captura — o que PODE ser registrado.
 *
 * ---------------------------------------------------------------------------
 * POR QUE O VOCABULÁRIO VEM DO BANCO E NÃO DE UMA CONSTANTE
 * ---------------------------------------------------------------------------
 * `evento_tipo_ref` é a dimensão que governa `eventos_clinicos.tipo` (FK) e
 * `janelas_24h.tipo` (FK). São 79 códigos no banco vivo, e o P0 de 10-ago
 * provou que a lista CRESCE (56 → 79 numa tarde). Constante copiada no app
 * apodreceria na primeira expansão — o banco é a casa única.
 *
 * A leitura está liberada para `anon` desde 30-jul (migration
 * `20260730182809`): é configuração, não dado de paciente.
 *
 * `faixa_min`/`faixa_max` são limites de ABSURDO FISIOLÓGICO (sanity flag),
 * não faixa de normalidade — comentário da própria tabela. Quem os consome é
 * `avaliarFaixa` em `eventos.ts`: sinaliza, nunca corrige nem bloqueia.
 *
 * Cliente por parâmetro, não por import — mesma doutrina de
 * `features/pendencias/services/pendencias.ts`: quem chama decide se está no
 * servidor ou no navegador, e o teste dispensa mock de módulo.
 */
import {exigirDado} from '@/lib/data/erros';

import type {ClienteSasi, TipoDeEvento} from '@/features/captura/types';

/**
 * Colunas uma a uma, como string literal, para o cliente tipado inferir a
 * linha de volta. `loinc_code` fica de fora de propósito: a Captura não fala
 * FHIR (vetado pelo operador) — pedir a coluna seria carregar peso morto.
 */
const COLUNAS_VOCABULARIO =
    'codigo, rotulo, categoria, unidade_padrao, faixa_min, faixa_max, ordem, ativo';

/**
 * Todos os tipos de evento ATIVOS, na ordem de exibição do vocabulário.
 *
 * `ativo = true`: código desligado é história (ex.: legado de janela), não
 * opção de tela. `ordem asc`: a sequência clínica da folha (PA antes de
 * glicemia, vital antes de lab) mora na coluna `ordem`, decidida no banco —
 * a tela não reordena.
 *
 * Falha de leitura LANÇA via `exigirDado`. Vocabulário vazio na tela
 * significaria "nada pode ser registrado" — clinicamente oposto de "não
 * consegui perguntar ao banco".
 */
export async function lerTiposDeEvento(supabase: ClienteSasi): Promise<TipoDeEvento[]> {
    const resposta = await supabase
        .from('evento_tipo_ref')
        .select(COLUNAS_VOCABULARIO)
        .eq('ativo', true)
        .order('ordem', {ascending: true});
    const linhas = exigirDado(resposta, 'vocabulário de tipos de evento');
    return linhas as unknown as TipoDeEvento[];
}

/**
 * Agrupa o vocabulário por categoria, preservando a ordem vinda do banco.
 *
 * É o formato que a tela consome: uma seção por categoria (vital, gaso,
 * renal…), cada uma já ordenada por `ordem` porque a lista de entrada veio
 * ordenada de `lerTiposDeEvento`. Função pura: sem isso cada render varreria
 * a lista de 79 códigos uma vez por seção.
 *
 * A chave é a categoria como está no banco — o rótulo humano ("Sinais
 * vitais") é assunto da tela, não do serviço.
 */
export function agruparPorCategoria(lista: TipoDeEvento[]): Record<string, TipoDeEvento[]> {
    const mapa: Record<string, TipoDeEvento[]> = {};
    for (const tipo of lista) {
        (mapa[tipo.categoria] ??= []).push(tipo);
    }
    return mapa;
}

/**
 * Tipos da Captura (Tela 2) — contrato entre serviço, hook e tela.
 *
 * A Captura grava três coisas (decisão 6 de `docs/ARQUITETURA.md`): janela de
 * vital, evento com valor e pendência. Pendência já tem casa própria em
 * `features/pendencias`; aqui moram os tipos de janela e evento.
 *
 * Regra que atravessa tudo (`docs/ARQUITETURA.md`, "Contrato por tela"):
 * `internacao_id` e `requires_review` NUNCA são enviados — o trigger do banco
 * carimba o primeiro e o gatilho `fn_autoflag_lowconf` decide o segundo.
 * Por isso nenhum tipo de PAYLOAD abaixo tem esses campos: mandar campo a mais
 * nem compila.
 */
import type {SupabaseClient} from '@supabase/supabase-js';

import type {EventoTipoRef} from '@/types';
import type {Database} from '@/types/supabase';

/** O cliente Supabase tipado, venha ele do servidor ou do navegador. */
export type ClienteSasi = SupabaseClient<Database>;

/**
 * Uma linha do vocabulário (`evento_tipo_ref`), sem o `loinc_code`: a Captura
 * não fala FHIR (vetado), então a coluna nem é pedida ao banco.
 */
export type TipoDeEvento = Omit<EventoTipoRef, 'loinc_code'>;

/**
 * O que a tela envia para registrar uma janela de 24h (Máx–Mín + excursões).
 *
 * Os campos numéricos aceitam `string` porque a digitação é brasileira:
 * "35,5" tem vírgula decimal e passa por `parseNumeroBR` antes de virar
 * número. Campo vazio ('' ou undefined) NÃO entra no payload — jamais vira 0,
 * porque zero é um valor medido e vazio é ausência.
 */
export interface EntradaDeJanela {
    paciente_id: string;
    /** Código do vocabulário (`evento_tipo_ref.codigo`), ex.: 'pam', 'fc'. */
    tipo: string;
    /** Início da janela, ISO. */
    janelaInicioISO: string;
    /** Fim da janela, ISO. É parte da chave única (paciente+tipo+janela_fim). */
    janelaFimISO: string;
    valor_max?: number | string | null;
    valor_min?: number | string | null;
    /**
     * Nº real de aferições da janela. Se omitido, vale o default 12 do banco —
     * que representa a folha COMPLETA (aferição de 2/2h). Informar o real
     * quando a folha for parcial, nunca chutar.
     */
    n_total?: number | string | null;
    n_fora_alto?: number | string | null;
    n_fora_baixo?: number | string | null;
    limiar_alto?: number | string | null;
    limiar_baixo?: number | string | null;
    /** Texto da fonte (ex.: a linha da folha), para auditoria. */
    source_text?: string;
}

/**
 * O payload que vai de fato ao banco. Sem `internacao_id`, sem
 * `requires_review`, sem `confidence` — de propósito (ver cabeçalho).
 */
export interface PayloadDeJanela {
    paciente_id: string;
    tipo: string;
    janela_inicio: string;
    janela_fim: string;
    /** Digitação à mão é sempre 'manual' — a coluna tem default, mas ser explícito documenta a origem. */
    fonte: 'manual';
    valor_max?: number;
    valor_min?: number;
    n_total?: number;
    n_fora_alto?: number;
    n_fora_baixo?: number;
    limiar_alto?: number;
    limiar_baixo?: number;
    source_text?: string;
}

/**
 * Resultado da validação pura `montarJanela`.
 *
 * `ok: false` = a entrada violaria uma CONSTRAINT do banco (janela invertida,
 * excursão sem limiar, n_fora > n_total) — mandar assim só trocaria esta
 * mensagem por um erro de SQL ilegível. Isso NÃO é a malha de faixas
 * fisiológicas: faixa sinaliza e deixa passar; constraint é contrato do banco.
 *
 * `avisos` acompanha o `ok: true`: '(revisar)' quando máx/mín vieram
 * invertidos na digitação e foram trocados (doutrina da skill
 * `sasi-ingest-export` — inverte e marca, nunca descarta).
 */
export type ResultadoMontarJanela =
    | { ok: true; payload: PayloadDeJanela; avisos: string[] }
    | { ok: false; motivo: string };

/** A linha de `janelas_24h` como o serviço a devolve (sem `internacao_id`). */
export interface Janela24h {
    id: string;
    paciente_id: string;
    tipo: string;
    janela_inicio: string;
    janela_fim: string;
    valor_max: number | null;
    valor_min: number | null;
    n_total: number;
    n_fora_alto: number | null;
    n_fora_baixo: number | null;
    limiar_alto: number | null;
    limiar_baixo: number | null;
    fonte: string;
    source_text: string | null;
    requires_review: boolean;
    created_at: string;
}

/**
 * Uma linha de `vw_janelas_24h_render`. O campo `render` vem PRONTO do banco
 * ("PAM 90-56 (4/12 <65)") — exibir, nunca remontar (docs/MAPA-BANCO-TELAS.md:
 * a linha de texto da nota é montada no banco, casa única).
 */
export interface JanelaRender {
    id: string | null;
    paciente_id: string | null;
    tipo: string | null;
    rotulo: string | null;
    unidade_padrao: string | null;
    janela_inicio: string | null;
    janela_fim: string | null;
    valor_max: number | null;
    valor_min: number | null;
    n_total: number | null;
    n_fora_alto: number | null;
    n_fora_baixo: number | null;
    limiar_alto: number | null;
    limiar_baixo: number | null;
    faixa_txt: string | null;
    excursoes_txt: string | null;
    render: string | null;
    requires_review: boolean | null;
    created_at: string | null;
}

/** Onde o valor caiu em relação à faixa de absurdo fisiológico da ref. */
export type PosicaoNaFaixa = 'dentro' | 'fora_baixo' | 'fora_alto';

/**
 * O que a tela envia para registrar um evento pontual (lab, escore, dose…).
 *
 * `ref` é a linha do vocabulário escolhida na tela: ela traz junto o código,
 * a unidade padrão e a faixa — impossível gravar tipo de um e unidade de outro.
 */
export interface EntradaDeEvento {
    paciente_id: string;
    /** A linha do vocabulário — de `lerTiposDeEvento`, nunca digitada à mão. */
    ref: TipoDeEvento;
    /**
     * Hora da COLETA, ISO — o chamador manda sempre. `now()` calado é
     * proibido: a gasometria das 04h lançada às 06h aconteceu às 04h.
     */
    tsISO: string;
    /** Aceita "1,7" (vírgula decimal, via parseNumeroBR). Vazio = não envia. */
    valor?: number | string | null;
    /** Texto da fonte, para auditoria. */
    source_text?: string;
}

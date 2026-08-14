/**
 * Eventos clínicos pontuais — lab, escore, dose, medida avulsa.
 *
 * ---------------------------------------------------------------------------
 * POR QUE A FAIXA SINALIZA E NUNCA BLOQUEIA
 * ---------------------------------------------------------------------------
 * `faixa_min`/`faixa_max` da ref são limites de ABSURDO FISIOLÓGICO, não de
 * normalidade. Valor fora da faixa gera aviso '(revisar)' na tela e o envio
 * SEGUE: "corrigir SpO2 145% para 95% é iatrogenia computacional"
 * (`docs/ARQUITETURA.md`, contrato da Tela 2). O app não sabe se o 145 é erro
 * de digitação ou transdutor descalibrado — quem sabe é o médico, e o dado
 * gravado com bandeira vale mais que o dado "corrigido" por palpite.
 *
 * ---------------------------------------------------------------------------
 * DOIS CAMPOS QUE NÃO SÃO COMO PARECEM
 * ---------------------------------------------------------------------------
 * - `fonte` NÃO tem default em `eventos_clinicos` (diferente de `janelas_24h`)
 *   — esquecê-la é erro de INSERT. Este serviço manda 'manual' sempre.
 * - `ts` é a hora da COLETA, vinda do chamador — nunca `now()` calado. A
 *   gasometria das 04h lançada às 06h aconteceu às 04h; carimbar a hora do
 *   toque na tela mentiria a cronologia que o motor de tendência lê.
 *
 * `internacao_id` e `requires_review` nunca são enviados: trigger carimba o
 * primeiro, `fn_autoflag_lowconf` decide o segundo.
 *
 * Cliente por parâmetro, não por import — mesma doutrina de
 * `features/pendencias/services/pendencias.ts`.
 */
import {parseNumeroBR} from '@/lib/clinical/unidades';

import type {ClienteSasi, EntradaDeEvento, PosicaoNaFaixa, TipoDeEvento} from '@/features/captura/types';
import type {EventoClinico} from '@/types';

/** Falha ao gravar o evento — o banco NÃO registrou, não tratar como salvo. */
export class FalhaAoGravarEvento extends Error {
    readonly causaOriginal: string | undefined;

    constructor(alvo: string, causaOriginal?: string) {
        super(
            `Falha ao gravar ${alvo}. O banco NÃO registrou o evento — ` +
                `não tratar como salvo.` +
                (causaOriginal ? ` Causa: ${causaOriginal}` : ''),
        );
        this.name = 'FalhaAoGravarEvento';
        this.causaOriginal = causaOriginal;
    }
}

/**
 * Onde o valor cai em relação à faixa de absurdo fisiológico da ref. PURA.
 *
 * Limite ausente (`null`) não sinaliza nada daquele lado: faixa que o banco
 * não declarou não se inventa (zero alucinação) — `be`, `mg`, `ca` e outros
 * vivem sem faixa de propósito. Valor exatamente NO limite é 'dentro': a
 * faixa é inclusiva, o absurdo começa depois dela.
 */
export function avaliarFaixa(
    valor: number,
    ref: Pick<TipoDeEvento, 'faixa_min' | 'faixa_max'>,
): PosicaoNaFaixa {
    if (ref.faixa_min !== null && valor < ref.faixa_min) return 'fora_baixo';
    if (ref.faixa_max !== null && valor > ref.faixa_max) return 'fora_alto';
    return 'dentro';
}

/**
 * Colunas do retorno — as mesmas do tipo `EventoClinico` de `@/types`, uma a
 * uma, para o cliente tipado pegar erro de nome em compilação.
 * `internacao_id` fica de fora (assunto do trigger); `requires_review` volta
 * na LEITURA (a tela mostra a bandeira) mas jamais vai na escrita.
 */
const COLUNAS_EVENTO =
    'id, paciente_id, evolucao_id, user_id, ts, tipo, valor_num, valor_json, ' +
    'unidade, fonte, confidence, source_text, requires_review, created_at';

/**
 * Grava um evento clínico e devolve a linha do banco + a posição na faixa.
 *
 * O payload é montado da REF, não de campos soltos: `tipo` = `ref.codigo` e
 * `unidade` = `ref.unidade_padrao` saem da mesma linha do vocabulário —
 * impossível gravar valor de creatinina com unidade de potássio. Unidade só
 * vai junto de valor (unidade sem número não descreve nada), e ref com
 * unidade vazia ('' — ex.: pH, escores) não manda a coluna.
 *
 * `posicao` volta para a tela marcar '(revisar)' quando 'fora_*' — o envio
 * já aconteceu, por desenho (ver cabeçalho). `null` = evento sem valor
 * numérico ou ref sem faixa dos dois lados: nada a julgar.
 */
export async function registrarEvento(
    supabase: ClienteSasi,
    entrada: EntradaDeEvento,
): Promise<{evento: EventoClinico; posicao: PosicaoNaFaixa | null}> {
    const valorNum =
        entrada.valor === undefined || entrada.valor === null ? null : parseNumeroBR(entrada.valor);

    // fonte SEM default no banco: 'manual' explícito, sempre.
    const payload: {
        paciente_id: string;
        tipo: string;
        ts: string;
        fonte: 'manual';
        valor_num?: number;
        unidade?: string;
        source_text?: string;
    } = {
        paciente_id: entrada.paciente_id,
        tipo: entrada.ref.codigo,
        ts: entrada.tsISO,
        fonte: 'manual',
    };
    if (valorNum !== null) {
        payload.valor_num = valorNum;
        const unidade = entrada.ref.unidade_padrao;
        if (unidade !== null && unidade !== '') payload.unidade = unidade;
    }
    if (entrada.source_text !== undefined && entrada.source_text.trim() !== '') {
        payload.source_text = entrada.source_text;
    }

    const resposta = await supabase.from('eventos_clinicos').insert(payload).select(COLUNAS_EVENTO);

    const alvo = `o evento "${entrada.ref.codigo}" do paciente ${entrada.paciente_id}`;
    if (resposta.error) throw new FalhaAoGravarEvento(alvo, resposta.error.message);
    const linha = resposta.data?.[0];
    if (!linha) {
        // Insert sem erro e sem linha de volta não existe no contrato do
        // supabase-js — se acontecer, é falha, não sucesso silencioso.
        throw new FalhaAoGravarEvento(alvo);
    }

    const posicao = valorNum === null ? null : avaliarFaixa(valorNum, entrada.ref);
    return {evento: linha as unknown as EventoClinico, posicao};
}

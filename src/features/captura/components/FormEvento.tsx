'use client';
/**
 * EVENTO — lab, escore, dose ou medida avulsa, com hora da COLETA.
 *
 * Três contratos desta tela que o formulário materializa:
 * - A UNIDADE nunca é editável: ela vem da MESMA linha do vocabulário que dá o
 *   código — impossível gravar creatinina com unidade de potássio.
 * - A hora da coleta é EDITÁVEL e o padrão é agora (vindo do servidor por
 *   prop): a gasometria das 04h lançada às 06h aconteceu às 04h, e `now()`
 *   calado mentiria a cronologia que o motor de tendência lê.
 * - A malha de faixas SINALIZA e nunca bloqueia: SpO2 145 é enviado como 145,
 *   com aviso "(revisar)" — "corrigir para 95% é iatrogenia computacional".
 */
import {useState} from 'react';

import {ConfirmacaoDeGravacao, ErroDeGravacao} from '@/features/captura/components/Mensagens';
import {useRegistrarEvento} from '@/features/captura/hooks/useRegistrarEvento';
import {
    dataHoraCurtaEmSaoPaulo,
    datetimeLocalEmSaoPaulo,
    isoDeDatetimeLocalSaoPaulo,
} from '@/features/captura/lib/plantao';
import {avaliarFaixa} from '@/features/captura/services/eventos';
import {agruparPorCategoria} from '@/features/captura/services/vocabulario';
import {parseNumeroBR} from '@/lib/clinical/unidades';
import {SEM_DADO, num, txt, unidadeSegura} from '@/lib/formatters/clinico';
import type {TipoDeEvento} from '@/features/captura/types';

/**
 * Rótulo humano das categorias do banco (medidas nas migrations: 13). A chave
 * crua é o fallback — categoria nova no banco aparece com o nome do banco em
 * vez de sumir da tela.
 */
const ROTULO_CATEGORIA: Record<string, string> = {
    vital: 'Sinais vitais',
    gaso: 'Gasometria',
    renal: 'Renal',
    hemato: 'Hematologia',
    infecto: 'Infecção',
    droga: 'Drogas',
    neuro: 'Neuro',
    score: 'Escores',
    cardio: 'Cardio',
    coag: 'Coagulação',
    hepato: 'Hepático',
    endocrino: 'Endócrino',
    outro: 'Outros',
};

/** Número em pt-BR com as casas que o valor pede. Ausente = travessão. */
function fmt(valor: number | null | undefined): string {
    if (valor == null) return SEM_DADO;
    return num(valor, Number.isInteger(valor) ? 0 : 2);
}

const CAMPO =
    'border-borda-padrao bg-superficie-card text-texto-titulo w-full rounded-md border px-3 py-2.5 text-base';

export function FormEvento({
    pacienteId,
    vocabulario,
    agoraISO,
}: {
    pacienteId: string;
    vocabulario: TipoDeEvento[];
    /** Relógio do servidor — vira o default (editável) da hora da coleta. */
    agoraISO: string;
}) {
    const grupos = agruparPorCategoria(vocabulario);
    const categorias = Object.keys(grupos);

    const [categoria, setCategoria] = useState<string | null>(categorias[0] ?? null);
    const [codigo, setCodigo] = useState<string | null>(null);
    const [valor, setValor] = useState('');
    // Default determinístico vindo da prop (não `new Date()` no cliente): o
    // mesmo valor renderiza no servidor e no navegador, sem estouro de hidratação.
    const [hora, setHora] = useState(() => datetimeLocalEmSaoPaulo(agoraISO));
    const [sucesso, setSucesso] = useState<string | null>(null);
    const [erroHora, setErroHora] = useState<string | null>(null);

    const gravar = useRegistrarEvento();

    const tiposDaCategoria = categoria ? (grupos[categoria] ?? []) : [];
    const ref = vocabulario.find((t) => t.codigo === codigo) ?? null;

    // Sinalização AO DIGITAR: fora da faixa de absurdo fisiológico fica amarelo
    // e o envio segue — a malha sinaliza, nunca corrige nem bloqueia.
    const valorNum = valor.trim() === '' ? null : parseNumeroBR(valor);
    const posicaoAoVivo = ref && valorNum !== null ? avaliarFaixa(valorNum, ref) : null;

    function aoGravar() {
        if (!ref) return;
        setErroHora(null);
        const tsISO = isoDeDatetimeLocalSaoPaulo(hora);
        if (tsISO === null) {
            // Guarda de CONTRATO (ts é obrigatório no banco), não juízo clínico:
            // hora ilegível não vira `now()` calado nem data inventada.
            setErroHora('Hora da coleta inválida — corrija o campo antes de gravar.');
            return;
        }
        gravar.mutate(
            {
                paciente_id: pacienteId,
                ref,
                tsISO,
                // Campo vazio vira null = NÃO envia — jamais vira 0.
                valor: valor.trim() === '' ? null : valor,
            },
            {
                onSuccess: ({evento, posicao}) => {
                    const valorTxt =
                        evento.valor_num == null
                            ? 'sem valor numérico'
                            : `${fmt(evento.valor_num)}${evento.unidade ? ` ${unidadeSegura(evento.unidade)}` : ''}`;
                    const partes = [
                        `${ref.rotulo} ${valorTxt} gravado`,
                        `coleta ${txt(dataHoraCurtaEmSaoPaulo(evento.ts))}`,
                    ];
                    if (posicao === 'fora_alto' || posicao === 'fora_baixo') {
                        partes.push('fora da faixa esperada (revisar)');
                    }
                    setSucesso(partes.join(' — '));
                    setValor('');
                },
            },
        );
    }

    return (
        <div className="space-y-4">
            {/* Categoria — a ordem vem do banco (coluna `ordem`), a tela não reordena. */}
            <div role="group" aria-label="Categoria do evento">
                <div className="flex flex-wrap gap-1.5">
                    {categorias.map((c) => {
                        const ativa = c === categoria;
                        return (
                            <button
                                key={c}
                                type="button"
                                aria-pressed={ativa}
                                onClick={() => {
                                    setCategoria(c);
                                    setCodigo(null);
                                    setSucesso(null);
                                    gravar.reset();
                                }}
                                className={`min-h-11 rounded-full border px-3 text-xs transition-colors duration-(--dur-fast) ${
                                    ativa
                                        ? 'border-acento bg-superficie-elevada text-texto-titulo font-semibold'
                                        : 'border-borda-padrao bg-superficie-card text-texto-corpo hover:bg-superficie-elevada font-medium'
                                }`}
                            >
                                {ROTULO_CATEGORIA[c] ?? c}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tipo dentro da categoria — chips grandes (alvo ≥48px). */}
            <div role="group" aria-label="Tipo de evento">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {tiposDaCategoria.map((t) => {
                        const ativo = t.codigo === codigo;
                        return (
                            <button
                                key={t.codigo}
                                type="button"
                                aria-pressed={ativo}
                                onClick={() => {
                                    setCodigo(t.codigo);
                                    setSucesso(null);
                                    gravar.reset();
                                }}
                                className={`min-h-12 rounded-lg border px-2 py-1.5 text-sm transition-colors duration-(--dur-fast) ${
                                    ativo
                                        ? 'border-acento bg-superficie-elevada text-texto-titulo font-semibold'
                                        : 'border-borda-padrao bg-superficie-card text-texto-corpo hover:bg-superficie-elevada font-medium'
                                }`}
                            >
                                {t.rotulo}
                                {t.unidade_padrao ? (
                                    <span className="text-texto-tenue block text-2xs font-normal">
                                        {unidadeSegura(t.unidade_padrao)}
                                    </span>
                                ) : null}
                            </button>
                        );
                    })}
                </div>
            </div>

            {ref && (
                <>
                    <div className="flex items-end gap-2">
                        <label className="block flex-1">
                            <span className="sasi-eyebrow">Valor</span>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={valor}
                                onChange={(e) => setValor(e.target.value)}
                                placeholder="vírgula p/ decimal"
                                data-clinical-number
                                className={`mt-1 ${CAMPO}`}
                            />
                        </label>
                        {/* Unidade da ref — exibida, NUNCA editável. */}
                        {ref.unidade_padrao && (
                            <span className="text-texto-suave pb-3 text-sm font-medium">
                                {unidadeSegura(ref.unidade_padrao)}
                            </span>
                        )}
                    </div>

                    {(posicaoAoVivo === 'fora_alto' || posicaoAoVivo === 'fora_baixo') && (
                        <p className="bg-gravidade-watcher-bg text-gravidade-watcher-text rounded-md px-3 py-2 text-xs font-medium">
                            Valor fora da faixa esperada de {ref.rotulo}
                            {ref.faixa_min != null || ref.faixa_max != null ? (
                                <span data-clinical-number>
                                    {' '}
                                    ({fmt(ref.faixa_min)} a {fmt(ref.faixa_max)})
                                </span>
                            ) : null}
                            {' — será gravado COMO DIGITADO e marcado para revisar. Nada é corrigido.'}
                        </p>
                    )}

                    <label className="block">
                        <span className="sasi-eyebrow">Hora da coleta (não a do lançamento)</span>
                        <input
                            type="datetime-local"
                            value={hora}
                            onChange={(e) => setHora(e.target.value)}
                            data-clinical-number
                            className={`mt-1 ${CAMPO}`}
                        />
                    </label>
                    {erroHora && <ErroDeGravacao mensagem={erroHora} />}

                    <button
                        type="button"
                        onClick={aoGravar}
                        disabled={gravar.isPending}
                        className="bg-acento min-h-12 w-full rounded-lg text-base font-semibold text-(--texto-sobre-acento) hover:bg-(--acento-hover) disabled:opacity-50"
                    >
                        {gravar.isPending ? 'Gravando…' : `Gravar ${ref.rotulo}`}
                    </button>
                </>
            )}

            {/* Falha NUNCA é engolida: a mensagem do serviço já diz "o banco NÃO registrou". */}
            {gravar.error && <ErroDeGravacao mensagem={gravar.error.message} />}
            {sucesso && <ConfirmacaoDeGravacao>{sucesso}</ConfirmacaoDeGravacao>}
        </div>
    );
}

'use client';
/**
 * Lista de linhas editáveis — impressão, conduta, intercorrências e drogas.
 *
 * ---------------------------------------------------------------------------
 * POR QUE LINHA A LINHA, E NÃO UM TEXTÃO COM QUEBRA DE LINHA
 * ---------------------------------------------------------------------------
 * O banco guarda `text[]` (array), e o template numera impressão e conduta
 * item a item, 1:1. Um `textarea` único obrigaria a tela a adivinhar onde
 * termina cada item — e adivinhação em texto clínico é como este repo perde
 * dado. Uma linha por item também deixa a numeração da tela ser exatamente a
 * numeração da nota: o "3." que o médico lê aqui é o "3." que sai no texto.
 *
 * Linha vazia não é apagada enquanto se digita (atrapalharia), mas some na
 * gravação e no texto (`linhasPreenchidas`): vazio é ausência, e ausência não
 * vira item.
 */
import {Plus, X} from 'lucide-react';

export function ListaEditavel({
    rotulo,
    itens,
    aoMudar,
    numerada = false,
    exemplo,
    ajuda,
    rotuloDeAdicionar = 'Adicionar linha',
}: {
    rotulo: string;
    itens: string[];
    aoMudar: (itens: string[]) => void;
    /** Impressão e conduta são numeradas (o template as numera). */
    numerada?: boolean;
    exemplo?: string;
    ajuda?: string;
    rotuloDeAdicionar?: string;
}) {
    function mudarLinha(indice: number, valor: string) {
        aoMudar(itens.map((item, i) => (i === indice ? valor : item)));
    }

    function removerLinha(indice: number) {
        aoMudar(itens.filter((_, i) => i !== indice));
    }

    return (
        <section aria-label={rotulo}>
            <h4 className="sasi-eyebrow">{rotulo}</h4>
            {ajuda && <p className="mt-0.5 text-2xs text-texto-tenue">{ajuda}</p>}

            {itens.length === 0 && (
                <p className="mt-1 text-xs text-texto-tenue">
                    Nenhuma linha. Sem linha, a seção NÃO sai no texto — nada é preenchido por conta própria.
                </p>
            )}

            <ul className="mt-1 space-y-1.5">
                {itens.map((item, indice) => (
                    // O índice é a identidade real da linha aqui: a lista é
                    // reordenável só por remoção, e o conteúdo pode repetir.
                    <li key={indice} className="flex items-start gap-1.5">
                        {numerada && (
                            <span
                                data-clinical-number
                                className="mt-2.5 w-5 shrink-0 text-right text-xs font-semibold text-texto-suave"
                            >
                                {indice + 1}.
                            </span>
                        )}
                        <input
                            type="text"
                            value={item}
                            onChange={(e) => mudarLinha(indice, e.target.value)}
                            placeholder={exemplo}
                            aria-label={`${rotulo}, linha ${indice + 1}`}
                            className="min-h-11 w-full rounded-md border border-borda-padrao bg-superficie-card px-3 py-2 text-sm text-texto-titulo"
                        />
                        <button
                            type="button"
                            onClick={() => removerLinha(indice)}
                            aria-label={`Remover a linha ${indice + 1} de ${rotulo}`}
                            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md border border-borda-padrao text-texto-suave hover:bg-superficie-elevada"
                        >
                            <X aria-hidden size={16} />
                        </button>
                    </li>
                ))}
            </ul>

            <button
                type="button"
                onClick={() => aoMudar([...itens, ''])}
                className="mt-1.5 inline-flex min-h-11 items-center gap-1.5 rounded-md border border-borda-padrao px-3 text-xs font-medium text-texto-corpo hover:bg-superficie-elevada"
            >
                <Plus aria-hidden size={14} />
                {rotuloDeAdicionar}
            </button>
        </section>
    );
}

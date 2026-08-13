'use client';
/**
 * Um painel de sistema da ficha — os inputs gerados a partir de `campos.ts`.
 *
 * A tela não escreve nome de campo à mão: cada input nasce do descritor, que
 * espelha o esquema canônico de `src/types/clinical.ts`. Assim `spo2_min`
 * digitado errado num JSX não vira chave fantasma no jsonb (o banco aceitaria,
 * a nota nunca leria e ninguém descobriria).
 *
 * TECLADO: campo numérico usa `type="text"` com `inputMode="decimal"`. É
 * deliberado — `type="number"` recusa vírgula em teclado pt-BR, e "1,7" é a
 * forma como o operador escreve creatinina. A conversão para número acontece
 * só no cálculo clínico (`parseNumeroBR`), nunca aqui.
 */
import type {PainelDeSistema} from '@/features/fechamento/lib/campos';

export function CamposDoSistema({
    painel,
    valores,
    aoMudar,
}: {
    painel: PainelDeSistema;
    valores: Record<string, string>;
    aoMudar: (campo: string, valor: string) => void;
}) {
    return (
        <section
            aria-label={`Sistema ${painel.rotulo}`}
            className="border-borda-padrao bg-superficie-card rounded-lg border p-3"
        >
            <h3 className="text-texto-titulo text-sm font-semibold">{painel.rotulo}</h3>
            {painel.nota && <p className="text-texto-tenue mt-0.5 text-2xs">{painel.nota}</p>}

            {/* Duas colunas: é o que põe Máx e Mín lado a lado, como se lê. */}
            <div className="mt-2 grid grid-cols-2 gap-2">
                {painel.campos.map((campo) => {
                    const largura = campo.tipo === 'area' ? 'col-span-2' : '';
                    const id = `${painel.chave}-${campo.chave}`;
                    return (
                        <label key={campo.chave} className={`block ${largura}`}>
                            <span className="sasi-eyebrow">
                                {campo.rotulo}
                                {campo.unidade ? ` (${campo.unidade})` : ''}
                            </span>
                            {campo.tipo === 'area' ? (
                                <textarea
                                    id={id}
                                    rows={2}
                                    value={valores[campo.chave] ?? ''}
                                    onChange={(e) => aoMudar(campo.chave, e.target.value)}
                                    placeholder={campo.exemplo}
                                    className="border-borda-padrao bg-superficie-card text-texto-titulo mt-0.5 w-full rounded-md border px-3 py-2 text-sm"
                                />
                            ) : (
                                <input
                                    id={id}
                                    type="text"
                                    inputMode={campo.tipo === 'numero' ? 'decimal' : undefined}
                                    value={valores[campo.chave] ?? ''}
                                    onChange={(e) => aoMudar(campo.chave, e.target.value)}
                                    placeholder={campo.exemplo}
                                    className="border-borda-padrao bg-superficie-card text-texto-titulo mt-0.5 min-h-11 w-full rounded-md border px-3 py-2 text-sm"
                                />
                            )}
                        </label>
                    );
                })}
            </div>
        </section>
    );
}

/**
 * Rota /captura — escolher EM QUEM lançar, antes de lançar.
 *
 * Server Component: a mesma consulta triada do Meu plantão
 * (`lerLeitosOcupados`, mais grave primeiro) vira aqui uma lista COMPACTA de
 * um toque por paciente. Nada de grade de 34 leitos: a contagem é do plantão
 * dele, e leito fora do banco não é "vago", está fora do sistema.
 *
 * `force-dynamic`: escolher paciente numa lista guardada em cache poderia
 * oferecer um leito que já teve alta — e lançar no paciente errado é o pior
 * erro desta tela.
 */
import {ChevronRight} from 'lucide-react';
import Link from 'next/link';
import type {Metadata} from 'next';

import {GravityBadge} from '@/components/clinical/GravityBadge';
import {lerLeitosOcupados} from '@/features/beds/services/leitos';
import {numeroDoLeito, txt} from '@/lib/formatters/clinico';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {title: 'Captura'};

export default async function CapturaPage() {
    const leitos = await lerLeitosOcupados();

    return (
        <>
            {/* Mesma barra de comando das outras telas: navy nos dois temas, grudada
                no topo. `pr-14` reserva o canto direito para o BotaoTema do layout. */}
            <header className="sasi-chrome sticky top-0 z-10">
                <div className="mx-auto flex max-w-[1600px] items-baseline gap-3 px-4 py-3 pr-14 sm:px-6 sm:pr-14">
                    <span className="text-chrome-texto text-md font-bold tracking-tight">SASI</span>
                    <span className="text-chrome-suave text-xs font-medium tracking-wide uppercase">
                        Captura · escolha o paciente
                    </span>
                </div>
            </header>

            <main className="mx-auto max-w-xl p-4 sm:p-6">
                {leitos.length === 0 && (
                    <p className="border-borda-padrao bg-superficie-card text-texto-suave rounded-lg border p-4 text-sm">
                        Nenhum leito ocupado no painel — não há em quem lançar. Se isso não bate com o
                        plantão real, o problema é de ingestão, não desta tela.
                    </p>
                )}

                {/* Ordem da triagem (mais grave primeiro), a mesma do Meu plantão. */}
                <ul className="space-y-2">
                    {leitos.map((l) => (
                        <li key={l.paciente_id}>
                            <Link
                                href={`/captura/${l.paciente_id}`}
                                className="bg-superficie-card border-borda-padrao shadow-card hover:shadow-elevada flex min-h-16 items-center gap-3 rounded-xl border p-3 transition-shadow duration-(--dur-fast)"
                            >
                                <div className="w-14 shrink-0">
                                    <p className="sasi-eyebrow">{l.uti}</p>
                                    <p
                                        data-clinical-number
                                        className="text-texto-titulo text-2xl leading-none font-bold"
                                    >
                                        {numeroDoLeito(l.leito)}
                                    </p>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-texto-titulo truncate text-sm font-semibold">
                                        {txt(l.nome)}
                                    </p>
                                    <p className="text-texto-suave truncate text-xs">{txt(l.hd)}</p>
                                </div>
                                <GravityBadge nivel={l.acuidade} tamanho="sm" />
                                <ChevronRight aria-hidden size={18} className="text-texto-tenue shrink-0" />
                            </Link>
                        </li>
                    ))}
                </ul>
            </main>
        </>
    );
}

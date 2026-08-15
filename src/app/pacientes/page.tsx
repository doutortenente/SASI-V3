/**
 * Pacientes — lista de leitos ativos, ponto de entrada pra ficha
 * (`/pacientes/[pacienteId]`). Mesma fonte do War Room e do Round.
 */
import type {Metadata} from 'next';
import Link from 'next/link';

import {GravityBadge} from '@/components/clinical/GravityBadge';
import {SofaBadge} from '@/components/clinical/SofaBadge';
import {TopBar} from '@/components/core/TopBar';
import {lerLeitosOcupados} from '@/features/beds/services/leitos';
import {numeroDoLeito, txt} from '@/lib/formatters/clinico';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {title: 'Pacientes'};

export default async function PacientesPage() {
    const leitos = await lerLeitosOcupados();

    return (
        <>
            <TopBar rotulo="Pacientes" carimbo={`${leitos.length} leito${leitos.length === 1 ? '' : 's'}`} />
            <main className="mx-auto max-w-[1600px] p-4 sm:p-6">
                <ul className="divide-y divide-borda-sutil overflow-hidden rounded-xl border border-borda-padrao bg-superficie-card">
                    {leitos.map((leito) => (
                        <li key={leito.paciente_id}>
                            <Link
                                href={`/pacientes/${leito.paciente_id}`}
                                className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors duration-(--dur-fast) hover:bg-superficie-elevada"
                            >
                                <span
                                    data-clinical-number
                                    className="w-20 shrink-0 text-sm font-bold text-texto-titulo"
                                >
                                    {numeroDoLeito(leito.leito ?? '')}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-sm text-texto-corpo">
                                    {txt(leito.nome)}
                                </span>
                                <GravityBadge nivel={leito.acuidade} tamanho="sm" />
                                <SofaBadge escore={leito.sofa_total} delta={leito.delta_sofa_24h} />
                            </Link>
                        </li>
                    ))}
                    {leitos.length === 0 && (
                        <li className="px-4 py-8 text-center text-sm text-texto-suave">Nenhum leito ocupado.</li>
                    )}
                </ul>
            </main>
        </>
    );
}

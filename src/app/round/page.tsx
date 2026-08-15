/**
 * Rota /round — Round: leitos em lista, mais grave primeiro, para a visita física.
 * Mesma fonte e mesma triagem do War Room (`lerLeitosOcupados`); a tela do
 * pacote de design que isto porta (`templates/round/Round.dc.html`).
 */
import type {Metadata} from 'next';

import {TopBar} from '@/components/core/TopBar';
import {PainelRound} from '@/features/beds/components/PainelRound';
import {lerLeitosOcupados} from '@/features/beds/services/leitos';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {title: 'Round'};

export default async function RoundPage() {
    const leitos = await lerLeitosOcupados(); // já vem triado, mais grave primeiro
    const agoraISO = new Date().toISOString();

    return (
        <>
            <TopBar rotulo="Round" carimbo={`${leitos.length} leito${leitos.length === 1 ? '' : 's'}`} />
            <main className="mx-auto max-w-[1600px] p-4 sm:p-6">
                <PainelRound leitos={leitos} agoraISO={agoraISO} />
            </main>
        </>
    );
}

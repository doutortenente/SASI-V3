/**
 * Rota raiz — Meu plantão.
 *
 * Server Component: a consulta dos leitos roda no servidor e o navegador
 * recebe HTML pronto. Nenhum cálculo clínico aqui — a triagem vem de
 * `lib/clinical/sasi.ts`. O que muda AO VIVO durante o plantão (alertas,
 * pendências, dispositivos, filtros) mora na ilha client `PainelMeuPlantao`,
 * que recebe esta carga por prop e não a refaz.
 *
 * `dynamic = 'force-dynamic'`: tela de comando não pode servir página guardada
 * em cache. Um leito que mudou de gravidade há 30 segundos tem que aparecer
 * mudado.
 */
import type {Metadata} from 'next';

import {StatPill} from '@/components/core/StatPill';
import {TopBar} from '@/components/core/TopBar';
import {PainelMeuPlantao} from '@/features/beds/components/PainelMeuPlantao';
import {lerLeitosOcupados} from '@/features/beds/services/leitos';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {title: 'Meu plantão'};

export default async function MeuPlantaoPage() {
    const leitos = await lerLeitosOcupados();
    // Um relógio só para toda a grade, passado para baixo: os componentes ficam
    // puros e testáveis, e a idade das infusões é medida contra o mesmo instante.
    // Conta de data NÃO se faz no navegador — o relógio é este, do servidor.
    const agoraISO = new Date().toISOString();

    const criticos = leitos.filter((l) => l.acuidade === 'CRITICO').length;
    const instaveis = leitos.filter((l) => l.acuidade === 'INSTAVEL').length;
    const pendencias = leitos.reduce((s, l) => s + (l.pendencias_abertas ?? 0), 0);
    const divergencias = leitos.filter((l) => l.divergenciaDeSemaforo).length;

    const carimbo = new Date(agoraISO).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <>
            <TopBar rotulo="Meu plantão" carimbo={carimbo} />

            <main className="mx-auto max-w-[1600px] p-4 sm:p-6">
                <section aria-label="Resumo do plantão" className="mb-6">
                    {/*
            A contagem é do PLANTÃO, não da unidade: o operador assume 6 a 12
            pacientes, não os 34 leitos do serviço. Uma tentativa de desenhar a
            planta inteira foi descartada por isso — leito que ele não assumiu
            não está "vago", está fora do sistema, e pintar de vago seria
            afirmar uma coisa que a tela não sabe.

            Os números são do plantão INTEIRO, de propósito fora do filtro da
            ilha client: filtrar a grade não muda quantos críticos existem.
          */}
                    <dl className="flex flex-wrap gap-2">
                        <StatPill rotulo="Pacientes" valor={leitos.length} />
                        <StatPill
                            rotulo="Críticos"
                            valor={criticos}
                            tom={criticos > 0 ? 'critico' : 'neutro'}
                        />
                        <StatPill
                            rotulo="Instáveis"
                            valor={instaveis}
                            tom={instaveis > 0 ? 'instavel' : 'neutro'}
                        />
                        <StatPill
                            rotulo="Pendências"
                            valor={pendencias}
                            tom={pendencias > 0 ? 'vigilancia' : 'neutro'}
                        />
                    </dl>

                    {/* Aviso de qualidade de dado, não de estado clínico. */}
                    {divergencias > 0 && (
                        <p className="mt-3 rounded-md bg-gravidade-critico-bg px-3 py-2 text-xs font-medium text-gravidade-critico-text">
                            {divergencias} leito(s) com semáforo gravado em desacordo com a gravidade. A tela
                            mostra o valor derivado da gravidade e marca o card. O banco não foi alterado — a
                            correção é sua.
                        </p>
                    )}
                </section>

                <PainelMeuPlantao leitos={leitos} agoraISO={agoraISO} />
            </main>
        </>
    );
}

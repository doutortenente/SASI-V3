/**
 * Ficha do paciente — a tela "Paciente · Folhão" do pacote de design. Reusa
 * `lerLeitosOcupados` (mesma fonte do War Room e do Round): não existe
 * consulta dedicada por paciente ainda, e duplicar a leitura da view para
 * filtrar 1 linha seria round-trip a mais sem ganho.
 *
 * O folhão de laboratório (`FolhaoDeLabs`) lê `eventos_clinicos` direto,
 * filtrado pelos códigos de `features/pacientes/lib/labs.ts` — conferidos contra
 * `evento_tipo_ref` no banco vivo em 15-ago-2026.
 *
 * A faixa de medidas e as abas portam `templates/paciente-folhao/PacienteFolhao.dc.html`.
 * Altura, IMC, SOFA basal e alergias NÃO existem no schema — travessão, nunca inventado.
 * Só a aba "Folhão Labs" abre tela real; as outras 6 não têm banco por trás.
 */
import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';

import {GravityBadge} from '@/components/clinical/GravityBadge';
import {SofaBadge} from '@/components/clinical/SofaBadge';
import {TherapyBadge} from '@/components/clinical/TherapyBadge';
import {TopBar} from '@/components/core/TopBar';
import {FolhaoDeLabs} from '@/features/pacientes/components/FolhaoDeLabs';
import {PainelDoPaciente} from '@/features/pacientes/components/PainelDoPaciente';
import {lerFolhaoDeLabs} from '@/features/pacientes/services/labs';
import {lerLeitosOcupados} from '@/features/beds/services/leitos';
import {SEM_DADO, numeroDoLeito, txt} from '@/lib/formatters/clinico';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {title: 'Paciente'};

const ROTULO_ISOLAMENTO: Record<string, string> = {
    contact: 'Contato',
    droplet: 'Gotícula',
    aerosol: 'Aerossol',
};

/** As 7 abas do template — só a de labs abre tela real. */
const ABAS = ['Resumo', 'Sinais 24h', 'Folhão Labs', 'Exame físico', 'Evolução', 'Prescrição', 'Especialidades'] as const;
const ABA_ATIVA = 'Folhão Labs';

export default async function PacientePage({params}: {params: Promise<{pacienteId: string}>}) {
    const {pacienteId} = await params;
    const leitos = await lerLeitosOcupados();
    const leito = leitos.find((l) => l.paciente_id === pacienteId);

    // Paciente não está entre os leitos ativos do plantão: 404, não ficha vazia.
    if (!leito) notFound();

    const agoraISO = new Date().toISOString();
    const folhao = await lerFolhaoDeLabs(pacienteId);
    const isolamento =
        leito.isolation && leito.isolation !== 'none' ? (ROTULO_ISOLAMENTO[leito.isolation] ?? leito.isolation) : null;
    const admissao = leito.data_adm
        ? new Date(leito.data_adm).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', year: 'numeric'})
        : SEM_DADO;

    const medidas = [
        {rotulo: 'Idade', valor: leito.idade == null ? SEM_DADO : String(leito.idade), unidade: leito.idade == null ? '' : 'a'},
        {rotulo: 'Peso', valor: leito.peso == null ? SEM_DADO : String(leito.peso), unidade: leito.peso == null ? '' : 'kg'},
        {rotulo: 'Altura', valor: SEM_DADO, unidade: ''},
        {rotulo: 'IMC', valor: SEM_DADO, unidade: ''},
        {rotulo: 'Admissão', valor: admissao, unidade: ''},
        {rotulo: 'Internação', valor: txt(leito.dias_internacao), unidade: leito.dias_internacao == null ? '' : 'dias'},
        {rotulo: 'SOFA basal', valor: SEM_DADO, unidade: ''},
    ];

    return (
        <>
            <TopBar rotulo={`Paciente · ${numeroDoLeito(leito.leito ?? '')}`} />
            <main className="mx-auto max-w-[900px] p-4 sm:p-6">
                <Link
                    href="/pacientes"
                    className="sasi-eyebrow mb-3 inline-block text-texto-suave hover:text-texto-titulo"
                >
                    ← Pacientes
                </Link>

                <header className="rounded-xl border border-borda-padrao bg-superficie-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="sasi-eyebrow">
                                {leito.uti} · {numeroDoLeito(leito.leito ?? '')}
                            </p>
                            <h1 className="text-lg font-bold text-texto-titulo">{txt(leito.nome)}</h1>
                            <p className="mt-0.5 text-xs text-texto-suave">
                                {leito.idade == null ? SEM_DADO : `${leito.idade} anos`} ·{' '}
                                {txt(leito.dias_internacao)} dias internado
                            </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
                            {isolamento && <TherapyBadge tipo="pend" rotulo={`Isolamento · ${isolamento}`} />}
                            <SofaBadge escore={leito.sofa_total} delta={leito.delta_sofa_24h} tamanho="lg" />
                            <GravityBadge nivel={leito.acuidade} />
                        </div>
                    </div>
                    <p className="mt-3 text-sm text-texto-corpo">{txt(leito.hd)}</p>

                    {/* Alergias: sem fonte no schema hoje — travessão, nunca 'Nega' fabricado. */}
                    <div className="mt-3 flex items-center gap-3 rounded-lg border border-borda-padrao bg-superficie-afundada px-3.5 py-2.5">
                        <span className="sasi-eyebrow">Alergias</span>
                        <span className="text-sm font-semibold text-texto-tenue">{SEM_DADO} sem fonte</span>
                    </div>

                    <div className="mt-3.5 grid grid-cols-2 divide-x divide-borda-sutil overflow-hidden rounded-lg border border-borda-padrao sm:grid-cols-4 lg:grid-cols-7">
                        {medidas.map((m) => (
                            <div key={m.rotulo} className="px-3.5 py-3">
                                <p className="sasi-eyebrow">{m.rotulo}</p>
                                <p data-clinical-number className="mt-1.5 text-lg leading-none font-bold text-texto-titulo">
                                    {m.valor}{' '}
                                    {m.unidade && <span className="text-xs font-medium text-texto-tenue">{m.unidade}</span>}
                                </p>
                            </div>
                        ))}
                    </div>
                </header>

                {/* As 7 abas do template. Só "Folhão Labs" abre tela real — as outras
                    6 não têm banco por trás (Prescrição, Evolução, Exame físico,
                    Especialidades, Sinais 24h, Resumo): rótulo à vista, sem link. */}
                <nav className="mt-5 flex flex-wrap gap-6 border-b border-borda-padrao" aria-label="Seções da ficha">
                    {ABAS.map((aba) => (
                        <span
                            key={aba}
                            aria-current={aba === ABA_ATIVA ? 'page' : undefined}
                            className={
                                aba === ABA_ATIVA
                                    ? 'border-b-2 border-acento pb-3 text-sm font-bold text-acento-texto'
                                    : 'border-b-2 border-transparent pb-3 text-sm font-medium text-texto-tenue'
                            }
                        >
                            {aba}
                        </span>
                    ))}
                </nav>

                <div className="mt-4 rounded-xl border border-borda-padrao bg-superficie-card">
                    <PainelDoPaciente
                        pacienteId={leito.paciente_id}
                        deltaSofa24h={leito.delta_sofa_24h}
                        outOfRangeCount={leito.out_of_range_count}
                        agoraISO={agoraISO}
                    />
                </div>

                <div className="mt-4 rounded-xl border border-borda-padrao bg-superficie-card">
                    <p className="sasi-eyebrow px-3.5 pt-3.5">Folhão de laboratório</p>
                    <FolhaoDeLabs folhao={folhao} />
                </div>
            </main>
        </>
    );
}

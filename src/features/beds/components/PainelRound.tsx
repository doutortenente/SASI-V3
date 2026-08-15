'use client';
/**
 * Ilha client do Round — filtro de UTI + toggle "só quem precisa de ação" em
 * cima da carga do servidor. Mesmo padrão de `PainelMeuPlantao`. Porta
 * `templates/round/Round.dc.html` do pacote de design.
 */
import Link from 'next/link';
import {useState} from 'react';

import {GravityBadge} from '@/components/clinical/GravityBadge';
import {SofaBadge} from '@/components/clinical/SofaBadge';
import {TherapyBadge} from '@/components/clinical/TherapyBadge';
import {StatPill} from '@/components/core/StatPill';
import {useAlertas} from '@/features/alerts/hooks/useAlertas';
import {FiltroDeLeitos} from '@/features/beds/components/FiltroDeLeitos';
import {filtrarLeitos} from '@/features/beds/lib/filtrar';
import type {LeitoNaGrade} from '@/features/beds/types';
import {usePendencias} from '@/features/pendencias/hooks/usePendencias';
import {dataComIdade, numeroDoLeito, SEM_DADO, txt} from '@/lib/formatters/clinico';
import {useFiltroLeitos} from '@/stores/bedStore';

const ROTULO_ISOLAMENTO: Record<string, string> = {
    contact: 'Contato',
    droplet: 'Gotícula',
    aerosol: 'Aerossol',
};

/** `atbs` tem 0 linhas em produção — texto fixo, igual ao próprio template. */
const SEM_ATB_EM_CURSO = 'sem ATB em curso';

function semEvolucaoEm24h(ultimaEvolucao: string | null, agoraISO: string): boolean {
    if (!ultimaEvolucao) return true;
    return new Date(agoraISO).getTime() - new Date(ultimaEvolucao).getTime() > 24 * 60 * 60 * 1000;
}

export function PainelRound({leitos, agoraISO}: {leitos: LeitoNaGrade[]; agoraISO: string}) {
    const alertas = useAlertas();
    const pendencias = usePendencias();
    const filtro = useFiltroLeitos();
    const [soAcao, setSoAcao] = useState(false);

    const alertasProntos = !alertas.carregando && alertas.erro === null;
    const pacientesComAlerta = alertasProntos ? new Set(alertas.alertas.map((a) => a.paciente_id)) : undefined;
    const porUti = filtrarLeitos(leitos, filtro, pacientesComAlerta);

    const linhas = porUti.map((l) => {
        const contagem = alertas.porPaciente.get(l.paciente_id);
        const criticos = contagem?.criticos ?? 0;
        const totalAlertas = contagem?.total ?? 0;
        const pend = pendencias.pendenciasPorPaciente?.[l.paciente_id] ?? [];
        const pendAlta = pend.filter((p) => p.prioridade === 1).length;
        const semEvolucao = semEvolucaoEm24h(l.ultima_evolucao, agoraISO);
        const precisaAcao = criticos > 0 || pendAlta > 0 || semEvolucao;
        return {l, criticos, totalAlertas, pend, pendAlta, semEvolucao, precisaAcao};
    });

    const visiveis = soAcao ? linhas.filter((r) => r.precisaAcao) : linhas;
    const totalCriticos = linhas.filter((r) => r.criticos > 0).length;
    const totalPendAlta = linhas.reduce((s, r) => s + r.pendAlta, 0);
    const totalSemEvolucao = linhas.filter((r) => r.semEvolucao).length;
    const totalPedindoAcao = linhas.filter((r) => r.precisaAcao).length;

    return (
        <>
            <FiltroDeLeitos visiveis={visiveis.length} total={leitos.length} alertasProntos={alertasProntos} />

            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-texto-titulo">
                        {leitos.length} leito{leitos.length === 1 ? '' : 's'} · {totalPedindoAcao} pedindo ação
                    </h2>
                    <p className="sasi-eyebrow mt-1">
                        Ordem: gravidade → alerta crítico → pendência alta → evolução atrasada
                    </p>
                </div>
                <button
                    type="button"
                    aria-pressed={soAcao}
                    onClick={() => setSoAcao((v) => !v)}
                    className={`min-h-12 rounded-xl border px-4 text-sm font-semibold transition-colors duration-(--dur-fast) ${
                        soAcao
                            ? 'border-acento/35 bg-acento-suave text-acento-texto'
                            : 'border-borda-padrao bg-superficie-card text-texto-titulo shadow-card'
                    }`}
                >
                    Só quem precisa de ação
                </button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
                <StatPill rotulo="Com alerta crítico" valor={totalCriticos} tom="critico" />
                <StatPill rotulo="Pendência de prioridade alta" valor={totalPendAlta} tom="vigilancia" />
                <StatPill rotulo="Sem evolução em 24 h" valor={totalSemEvolucao} tom="vigilancia" />
            </div>

            <div className="hidden grid-cols-[160px_minmax(240px,1fr)_90px_200px_220px] gap-4 px-4 pb-2 text-2xs font-semibold tracking-wide text-texto-suave uppercase md:grid">
                <span>Leito</span>
                <span>Paciente</span>
                <span>SOFA</span>
                <span>Alertas e ATB</span>
                <span>Pendências</span>
            </div>

            <ul className="grid gap-3">
                {visiveis.map(({l, criticos, totalAlertas, pend, semEvolucao}) => {
                    const isolamento =
                        l.isolation && l.isolation !== 'none' ? (ROTULO_ISOLAMENTO[l.isolation] ?? l.isolation) : null;
                    const tarefa = pend[0]?.tarefa ?? null;
                    const abertas = l.pendencias_abertas ?? 0;
                    return (
                        <li key={l.paciente_id}>
                            <Link
                                href={`/pacientes/${l.paciente_id}`}
                                className="grid gap-3 rounded-xl border border-borda-padrao bg-superficie-card p-4 shadow-card transition-shadow duration-(--dur-fast) hover:shadow-elevada md:grid-cols-[160px_minmax(240px,1fr)_90px_200px_220px]"
                            >
                                <div>
                                    <p className="sasi-eyebrow">
                                        {l.uti} · {numeroDoLeito(l.leito)}
                                    </p>
                                    <GravityBadge nivel={l.acuidade} tamanho="sm" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="truncate text-base font-bold text-texto-titulo">{txt(l.nome)}</h3>
                                    <p className="mt-0.5 text-xs text-texto-suave">
                                        {l.idade == null ? SEM_DADO : `${l.idade} anos`} · {txt(l.dias_internacao)} d de UTI · evolução{' '}
                                        <span className={semEvolucao ? 'font-semibold text-gravidade-watcher-text' : ''}>
                                            {dataComIdade(l.ultima_evolucao, agoraISO)}
                                        </span>
                                    </p>
                                    <p className="mt-1.5 line-clamp-2 text-sm text-texto-corpo">{txt(l.hd)}</p>
                                    {isolamento && <TherapyBadge tipo="pend" rotulo={`Isolamento ${isolamento}`} />}
                                </div>
                                <div>
                                    <SofaBadge escore={l.sofa_total} delta={l.delta_sofa_24h} />
                                </div>
                                <p className="text-sm text-texto-suave">
                                    {/* Mesma régua do War Room: o card conta TODO alerta aberto
                                        (`total` da `vw_alertas_abertos`), não só os críticos.
                                        Contar só `criticos` fazia o mesmo paciente aparecer
                                        "ALERTA 2" na grade e "sem alerta aberto" aqui. */}
                                    {totalAlertas > 0
                                        ? criticos > 0
                                            ? `${totalAlertas} alerta(s) aberto(s) · ${criticos} crítico(s)`
                                            : `${totalAlertas} alerta(s) aberto(s)`
                                        : 'sem alerta aberto'}
                                    <br />
                                    {SEM_ATB_EM_CURSO}
                                </p>
                                <div>
                                    <p className="text-sm text-texto-corpo">
                                        {abertas > 0 ? `${abertas} pendência(s) aberta(s)` : SEM_DADO}
                                    </p>
                                    {tarefa && <p className="mt-1 text-xs text-texto-suave">{tarefa}</p>}
                                </div>
                            </Link>
                        </li>
                    );
                })}
                {visiveis.length === 0 && (
                    <li className="rounded-xl border border-borda-padrao bg-superficie-card p-8 text-center text-sm text-texto-suave">
                        Nenhum leito no recorte atual.
                    </li>
                )}
            </ul>
        </>
    );
}

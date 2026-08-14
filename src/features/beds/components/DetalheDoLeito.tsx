'use client';
/**
 * Detalhe expandido do card — alertas, pendências, dispositivos e "o que mudou".
 *
 * É a parte INTERATIVA do leito: reconhecer alerta e concluir pendência a um
 * toque, sem modal (lista curta dentro do próprio card; modal em cima de grade
 * de plantão esconde o resto da unidade). Alvos de toque ≥ 44px — o polegar de
 * quem anda pelo corredor com o celular numa mão não acerta alvo menor.
 *
 * Doutrina de honestidade, herdada dos serviços:
 * - Falha de LEITURA nunca vira lista vazia: mostra o aviso de falha.
 * - Falha de ESCRITA (ack/conclusão) mostra a mensagem do erro — que já diz
 *   "o alerta CONTINUA ABERTO" / "o banco NÃO registrou". Engolir esse erro
 *   faz o médico achar que resolveu o que segue aberto.
 * - Dispositivos: a tabela nova está em 0 linhas (medido 11-ago-2026); o
 *   estado vazio DIZ isso e não se mistura com o chip herdado do card, que vem
 *   de outra fonte (`pacientes.dispositivos`).
 */
import {useAlertasDoPaciente, useReconhecerAlerta} from '@/features/alerts/hooks/useAlertasDoPaciente';
import {useConcluirPendencia} from '@/features/pendencias/hooks/usePendencias';
import {SEM_DADO, direcao, txt} from '@/lib/formatters/clinico';
import {resumoEvolucao} from '@/lib/formatters/tempo';
import type {DispositivoAtivo} from '@/features/devices/services/dispositivos';
import type {Pendencia, SeveridadeAlerta} from '@/types';

const CLASSE_SEVERIDADE: Record<SeveridadeAlerta, string> = {
    critical: 'bg-gravidade-critico-bg text-gravidade-critico-text',
    warning: 'bg-gravidade-watcher-bg text-gravidade-watcher-text',
    info: 'bg-superficie-afundada text-texto-suave',
};

const ROTULO_SEVERIDADE: Record<SeveridadeAlerta, string> = {
    critical: 'Crítico',
    warning: 'Atenção',
    info: 'Info',
};

/** Rótulos do contrato de `pendencias.prioridade` (1 = tempo-sensível). */
const PRIORIDADE: Record<1 | 2 | 3, {rotulo: string; classe: string}> = {
    1: {rotulo: 'P1 agora', classe: 'bg-gravidade-critico-bg text-gravidade-critico-text'},
    2: {rotulo: 'P2 turno', classe: 'bg-gravidade-watcher-bg text-gravidade-watcher-text'},
    3: {rotulo: 'P3 pode esperar', classe: 'bg-superficie-afundada text-texto-suave'},
};

/** Aviso de falha de leitura — vermelho porque "não sei" exige ação, não silêncio. */
function AvisoDeFalha({mensagem}: {mensagem: string}) {
    return (
        <p className="rounded-sm bg-gravidade-critico-bg px-2 py-1.5 text-2xs font-medium text-gravidade-critico-text">
            {mensagem}
        </p>
    );
}

function BlocoAlertas({pacienteId, agoraISO}: {pacienteId: string; agoraISO: string}) {
    const consulta = useAlertasDoPaciente(pacienteId);
    const reconhecer = useReconhecerAlerta();

    return (
        <section aria-label="Alertas abertos">
            <h4 className="sasi-eyebrow">Alertas abertos</h4>
            {consulta.isPending && <p className="mt-1 text-xs text-texto-tenue">Consultando o banco…</p>}
            {consulta.error && <AvisoDeFalha mensagem={consulta.error.message} />}
            {/* A mensagem do serviço já diz o essencial: "o alerta CONTINUA ABERTO". */}
            {reconhecer.error && <AvisoDeFalha mensagem={reconhecer.error.message} />}
            {consulta.data && consulta.data.length === 0 && (
                <p className="mt-1 text-xs text-texto-tenue">Nenhum alerta aberto.</p>
            )}
            {consulta.data && consulta.data.length > 0 && (
                <ul className="mt-1 space-y-1.5">
                    {consulta.data.map((a) => (
                        <li key={a.id} className="flex items-center gap-2">
                            <div className="min-w-0 flex-1">
                                <p className="text-xs text-texto-corpo">
                                    <span
                                        className={`mr-1.5 rounded-sm px-1.5 py-0.5 text-2xs font-semibold tracking-wide uppercase ${CLASSE_SEVERIDADE[a.severidade]}`}
                                    >
                                        {ROTULO_SEVERIDADE[a.severidade]}
                                    </span>
                                    {a.mensagem}
                                </p>
                                <p className="text-2xs text-texto-tenue" data-clinical-number>
                                    {resumoEvolucao(a.created_at, new Date(agoraISO)).rotulo}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => reconhecer.mutate(a.id)}
                                disabled={reconhecer.isPending}
                                className="min-h-11 shrink-0 rounded-md border border-borda-padrao px-3 text-xs font-medium text-texto-corpo hover:bg-superficie-elevada disabled:opacity-50"
                            >
                                Reconhecer
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

function BlocoPendencias({pendencias, erro}: {pendencias: Pendencia[] | undefined; erro: Error | null}) {
    const concluir = useConcluirPendencia();

    return (
        <section aria-label="Pendências abertas">
            <h4 className="sasi-eyebrow">Pendências abertas</h4>
            {erro && <AvisoDeFalha mensagem={erro.message} />}
            {/* A mensagem do serviço já diz: "o banco NÃO registrou a mudança". */}
            {concluir.error && <AvisoDeFalha mensagem={concluir.error.message} />}
            {!erro && pendencias === undefined && (
                <p className="mt-1 text-xs text-texto-tenue">Consultando o banco…</p>
            )}
            {pendencias && pendencias.length === 0 && (
                <p className="mt-1 text-xs text-texto-tenue">Nenhuma pendência aberta.</p>
            )}
            {pendencias && pendencias.length > 0 && (
                <ul className="mt-1 space-y-1.5">
                    {pendencias.map((p) => (
                        <li key={p.id} className="flex items-center gap-2">
                            <div className="min-w-0 flex-1">
                                <p className="text-xs text-texto-corpo">
                                    <span
                                        className={`mr-1.5 rounded-sm px-1.5 py-0.5 text-2xs font-semibold tracking-wide uppercase ${PRIORIDADE[p.prioridade].classe}`}
                                    >
                                        {PRIORIDADE[p.prioridade].rotulo}
                                    </span>
                                    {p.tarefa}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => concluir.mutate(p.id)}
                                disabled={concluir.isPending}
                                className="min-h-11 shrink-0 rounded-md border border-borda-padrao px-3 text-xs font-medium text-texto-corpo hover:bg-superficie-elevada disabled:opacity-50"
                            >
                                Concluir
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

function BlocoDispositivos({
    dispositivos,
    erro,
}: {
    dispositivos: DispositivoAtivo[] | undefined;
    erro: Error | null;
}) {
    return (
        <section aria-label="Dispositivos com dias de uso">
            <h4 className="sasi-eyebrow">Dispositivos · dias de uso</h4>
            {erro && <AvisoDeFalha mensagem={erro.message} />}
            {!erro && dispositivos === undefined && (
                <p className="mt-1 text-xs text-texto-tenue">Consultando o banco…</p>
            )}
            {dispositivos && dispositivos.length === 0 && (
                // Estado vazio HONESTO: a tabela de episódios está em 0 linhas até a
                // ingestão alimentar. Os selos cinza do card vêm de OUTRA fonte
                // (`pacientes.dispositivos`, herdada) — não somar as duas num número.
                <p className="mt-1 text-xs text-texto-tenue">
                    Nenhum episódio de dispositivo registrado na tabela nova (a ingestão ainda não a
                    alimenta). Os selos cinza do card vêm do cadastro herdado — outra fonte.
                </p>
            )}
            {dispositivos && dispositivos.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                    {dispositivos.map((d) => (
                        <li
                            key={d.episodio_id ?? `${d.tipo}-${d.data_inicio}`}
                            className="text-xs text-texto-corpo"
                        >
                            <span className="font-semibold uppercase">{d.tipo}</span>
                            {d.sitio ? ` · ${d.sitio}` : ''}
                            {' — '}
                            <span data-clinical-number>
                                {/* `dias_em_uso` é DERIVADO no banco; null mostra travessão, nunca 0. */}
                                {d.dias_em_uso == null ? SEM_DADO : `${d.dias_em_uso} dia(s) de uso`}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

export function DetalheDoLeito({
    pacienteId,
    deltaSofa24h,
    outOfRangeCount,
    agoraISO,
    pendencias,
    erroPendencias,
    dispositivos,
    erroDispositivos,
}: {
    pacienteId: string;
    deltaSofa24h: number | null;
    /** `out_of_range_count` da view — contagem medida, não estimada. */
    outOfRangeCount: number | null;
    agoraISO: string;
    pendencias: Pendencia[] | undefined;
    erroPendencias: Error | null;
    dispositivos: DispositivoAtivo[] | undefined;
    erroDispositivos: Error | null;
}) {
    return (
        <div className="space-y-3 border-t border-borda-sutil p-3.5 pt-3">
            {/* O QUE MUDOU — variação em PALAVRA (direcao), nunca seta. */}
            <section aria-label="O que mudou">
                <h4 className="sasi-eyebrow">O que mudou · 24h</h4>
                <p className="mt-1 text-xs text-texto-corpo">
                    SOFA {direcao(deltaSofa24h)}
                    {deltaSofa24h != null && deltaSofa24h !== 0 && (
                        <span data-clinical-number> ({Math.abs(deltaSofa24h)} ponto(s))</span>
                    )}
                    {deltaSofa24h == null && (
                        <span className="text-texto-tenue"> — sem os dois SOFA para comparar</span>
                    )}
                </p>
                <p className="text-2xs text-texto-tenue" data-clinical-number>
                    Excursões fora de faixa registradas: {txt(outOfRangeCount)}
                </p>
            </section>

            <BlocoAlertas pacienteId={pacienteId} agoraISO={agoraISO} />
            <BlocoPendencias pendencias={pendencias} erro={erroPendencias} />
            <BlocoDispositivos dispositivos={dispositivos} erro={erroDispositivos} />
        </div>
    );
}

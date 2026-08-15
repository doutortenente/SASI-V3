'use client';
/**
 * Card de um leito no Meu plantão.
 *
 * Componente EXIBE, não calcula: acuidade, semáforo e divergência chegam
 * prontos de `triagemDeLeitos`. Nenhum cálculo clínico mora aqui.
 *
 * O visual segue o `LeitoCard` do `sasi-design-system` do v2: barra de
 * gravidade grossa à esquerda, número do leito como âncora, SOFA como numeral
 * herói, e os selos de terapia numa fileira só. A versão anterior deste
 * arquivo tinha tudo no mesmo peso de texto — em 33 leitos, isso obriga a ler
 * card por card para achar o grave.
 *
 * ILHA CLIENT POR CARD: a única interatividade que mora AQUI é a expansão
 * (`useState`). O detalhe expandido (`DetalheDoLeito`) é montado só quando
 * aberto — é lá que vivem o ack de alerta e a conclusão de pendência; assim um
 * card fechado não dispara consulta nenhuma.
 */
import {ChevronDown, ChevronUp} from 'lucide-react';
import {useState} from 'react';

import {GravityBadge} from '@/components/clinical/GravityBadge';
import {SofaBadge} from '@/components/clinical/SofaBadge';
import {TherapyBadge} from '@/components/clinical/TherapyBadge';
import type {Acuidade} from '@/lib/clinical/sasi';
import {
    CLASSE_SEMAFORO,
    SEM_DADO,
    dataComIdade,
    numeroDoLeito,
    rotuloInfusao,
    txt,
} from '@/lib/formatters/clinico';
import type {Dispositivos, InfusaoOuTexto, Isolamento} from '@/types';
import {DetalheDoLeito} from '@/features/beds/components/DetalheDoLeito';
import type {PropsBedCard} from '@/features/beds/types';

/** Barra esquerda por acuidade — o olho acha o grave antes de ler. */
const BARRA_ACUIDADE: Record<Acuidade, string> = {
    CRITICO: 'bg-gravidade-critico',
    INSTAVEL: 'bg-gravidade-instavel',
    VIGILANCIA: 'bg-gravidade-watcher',
    ESTAVEL: 'bg-gravidade-estavel',
    // Óbito tem token próprio (cinza). Nunca verde: verde na tela de comando
    // significa "estável", e um paciente morto não é um paciente estável.
    OBITO: 'bg-gravidade-obito',
};

/** Mesmo token, cru (sem `bg-`), pro `color-mix` do lavado de fundo. */
const TOKEN_ACUIDADE: Record<Acuidade, string> = {
    CRITICO: '--color-gravidade-critico',
    INSTAVEL: '--color-gravidade-instavel',
    VIGILANCIA: '--color-gravidade-watcher',
    ESTAVEL: '--color-gravidade-estavel',
    OBITO: '--color-gravidade-obito',
};

/**
 * Fundo do card inteiro tingido pela gravidade — a fórmula é a do BedCard.tsx
 * do V2 REAL em produção (`sasi-uti.vercel.app`, conferido no código-fonte,
 * não num mockup): `color-mix(in srgb, var(--grav-X-solid) 9%|5%, var(--surface-card))`.
 * Sem o lavado, sobra fundo branco chapado + borda cheia — o card lê como
 * bloco duro em vez de card clínico.
 */
function lavadoDeGravidade(acuidade: Acuidade): string {
    const porcentagem = acuidade === 'CRITICO' ? 9 : 5;
    return `color-mix(in srgb, var(${TOKEN_ACUIDADE[acuidade]}) ${porcentagem}%, var(--superficie-card))`;
}

const ROTULO_ISOLAMENTO: Record<Isolamento, string | null> = {
    none: null,
    contact: 'Contato',
    droplet: 'Gotícula',
    aerosol: 'Aerossol',
};

/** Só dispositivo invasivo, que muda conduta. `detalhe` não é dispositivo. */
const ROTULO_DISPOSITIVO: Partial<Record<keyof Dispositivos, string>> = {
    iot: 'IOT',
    tqt: 'TQT',
    cvc: 'CVC',
    pai: 'PAI',
    svd: 'SVD',
    sne: 'SNE',
    avp: 'AVP',
    picc: 'PICC',
    dreno: 'Dreno',
    mpd: 'MPD',
    shilley: 'Shilley',
};

function dispositivosAtivos(d: Dispositivos | null): string[] {
    if (!d) return [];
    return (Object.keys(ROTULO_DISPOSITIVO) as Array<keyof Dispositivos>)
        .filter((k) => d[k] === true)
        .map((k) => ROTULO_DISPOSITIVO[k]!);
}

/*
  NÃO filtrar por `d.droga`: no banco vivo `dvas` é lista de TEXTO puro
  ("Dobutamina 5 ml/h"), que não tem esse campo. O filtro por campo descartava
  100% das drogas vasoativas em silêncio — o mesmo defeito de "dose que sumia
  da passagem" do v2. Aqui só sai o que é vazio de verdade.
*/
function infusoesReais(lista: InfusaoOuTexto[] | null | undefined): InfusaoOuTexto[] {
    return (lista ?? []).filter((d) => (typeof d === 'string' ? d.trim() !== '' : Boolean(d?.droga)));
}

export function BedCard({
    leito,
    agoraISO,
    alertasAbertos,
    pendencias: pendenciasVivas,
    erroPendencias = null,
    dispositivos: dispositivosVivos,
    erroDispositivos = null,
}: PropsBedCard) {
    const [expandido, setExpandido] = useState(false);

    const dispositivos = dispositivosAtivos(leito.dispositivos);
    const isolamento = leito.isolation ? ROTULO_ISOLAMENTO[leito.isolation] : null;
    const dvas = infusoesReais(leito.dvas);
    const sedativos = infusoesReais(leito.sedativos);

    // Via aérea artificial: o selo VM sai de dispositivo, não de campo próprio —
    // a view não tem coluna de ventilação.
    const emVM = Boolean(leito.dispositivos?.iot || leito.dispositivos?.tqt);
    // Contagem AO VIVO quando a consulta já respondeu (a lista só tem abertas);
    // até lá, o retrato do servidor (`vw_dashboard_uti.pendencias_abertas`).
    // Duas fontes, uma de cada vez — nunca somadas.
    const pendencias = pendenciasVivas ? pendenciasVivas.length : (leito.pendencias_abertas ?? 0);
    const alertas = alertasAbertos ?? null;
    const temAlerta = alertas !== null && alertas.criticos + alertas.warnings + alertas.infos > 0;
    const idDetalhe = `detalhe-${leito.paciente_id}`;

    return (
        <article
            className="relative flex flex-col overflow-hidden rounded-xl border border-borda-padrao pl-4 text-texto-corpo shadow-card transition-shadow duration-200 hover:shadow-elevada"
            style={{background: lavadoDeGravidade(leito.acuidade)}}
            aria-label={`Leito ${leito.leito}, acuidade ${leito.acuidade}`}
        >
            {/* Barra de gravidade: 6px cheios, do topo ao pé do card. */}
            <span
                className={`absolute inset-y-0 left-0 w-1.5 ${BARRA_ACUIDADE[leito.acuidade]}`}
                aria-hidden="true"
            />

            <div className="flex flex-col gap-3 p-3.5">
                {/* Linha 1 — leito, gravidade, semáforo */}
                <header className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="sasi-eyebrow">{leito.uti ?? SEM_DADO}</p>
                        <h3 data-clinical-number className="text-xl leading-none font-bold text-texto-titulo">
                            {numeroDoLeito(leito.leito ?? '')}
                        </h3>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                        <GravityBadge nivel={leito.acuidade} tamanho="sm" />
                        <span
                            className={`size-2.5 shrink-0 rounded-full ${CLASSE_SEMAFORO[leito.semaforo]}`}
                            aria-label={`Semáforo ${leito.semaforo}`}
                        />
                    </div>
                </header>

                {/*
          Alertas abertos — badge de contagem, visível sem expandir o card.
          Só aparece quando a consulta respondeu E há alerta: ausência de badge
          com dado carregado = zero alertas (fato); sem dado, nada se afirma.
        */}
                {temAlerta && (
                    <ul className="flex flex-wrap gap-1" aria-label="Alertas abertos deste leito">
                        {alertas.criticos > 0 && (
                            <li className="inline-flex items-center gap-1 rounded-sm bg-gravidade-critico-bg px-1.5 py-0.5 text-2xs font-semibold tracking-wide text-gravidade-critico-text">
                                ALERTA CRÍTICO
                                <span data-clinical-number className="font-bold">
                                    {alertas.criticos}
                                </span>
                            </li>
                        )}
                        {alertas.warnings > 0 && (
                            <li className="inline-flex items-center gap-1 rounded-sm bg-gravidade-watcher-bg px-1.5 py-0.5 text-2xs font-semibold tracking-wide text-gravidade-watcher-text">
                                ALERTA
                                <span data-clinical-number className="font-bold">
                                    {alertas.warnings}
                                </span>
                            </li>
                        )}
                        {alertas.infos > 0 && (
                            <li className="inline-flex items-center gap-1 rounded-sm bg-superficie-afundada px-1.5 py-0.5 text-2xs font-semibold tracking-wide text-texto-suave">
                                INFO
                                <span data-clinical-number className="font-bold">
                                    {alertas.infos}
                                </span>
                            </li>
                        )}
                    </ul>
                )}

                {/*
          Divergência de dado: o semáforo guardado no banco discorda da
          gravidade. A tela pinta o derivado da gravidade e AVISA — não
          corrige o banco.
        */}
                {leito.divergenciaDeSemaforo && (
                    <p className="rounded-sm bg-gravidade-critico-bg px-2 py-1 text-2xs font-medium text-gravidade-critico-text">
                        Dado inconsistente: gravidade {txt(leito.gravidade)}, semáforo gravado{' '}
                        {txt(leito.severidade_visual)}. A tela mostra o derivado da gravidade. Conferir no
                        cadastro.
                    </p>
                )}

                {/* Linha 2 — identificação */}
                <div className="min-w-0">
                    <p
                        className="truncate text-sm font-semibold text-texto-titulo"
                        title={leito.nome ?? undefined}
                    >
                        {txt(leito.nome)}
                    </p>
                    <p className="text-xs text-texto-suave">
                        {leito.idade == null ? SEM_DADO : `${leito.idade} anos`} ·{' '}
                        {txt(leito.dias_internacao)} dias internado
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-texto-corpo" title={leito.hd ?? undefined}>
                        {txt(leito.hd)}
                    </p>
                </div>

                {/*
          Linha 3 — números. SOFA ausente mostra travessão, nunca 0.
          Hoje 0 de 16 evoluções têm `sofa_total`: o travessão é o normal.
        */}
                <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-borda-sutil bg-superficie-elevada">
                    <div className="flex flex-col gap-1 bg-superficie-card px-2.5 py-2">
                        <dt className="sasi-eyebrow">SOFA</dt>
                        <dd>
                            <SofaBadge escore={leito.sofa_total} delta={leito.delta_sofa_24h} />
                        </dd>
                    </div>
                    <div className="flex flex-col gap-1 bg-superficie-card px-2.5 py-2">
                        <dt className="sasi-eyebrow">Pendências</dt>
                        <dd
                            data-clinical-number
                            className={`text-xl leading-none font-semibold ${pendencias > 0 ? 'text-gravidade-watcher' : 'text-texto-tenue'}`}
                        >
                            {txt(pendencias)}
                        </dd>
                    </div>
                </dl>

                {/* Linha 4 — selos de terapia, o resumo de um segundo */}
                {(dvas.length > 0 || sedativos.length > 0 || emVM || pendencias > 0 || isolamento) && (
                    <ul className="flex flex-wrap gap-1">
                        {isolamento && (
                            <li>
                                <TherapyBadge tipo="pend" rotulo={`Isolamento ${isolamento}`} />
                            </li>
                        )}
                        {dvas.length > 0 && (
                            <li>
                                <TherapyBadge tipo="dva" contagem={dvas.length} />
                            </li>
                        )}
                        {sedativos.length > 0 && (
                            <li>
                                <TherapyBadge tipo="sed" contagem={sedativos.length} />
                            </li>
                        )}
                        {emVM && (
                            <li>
                                <TherapyBadge tipo="vm" />
                            </li>
                        )}
                        {pendencias > 0 && (
                            <li>
                                <TherapyBadge tipo="pend" contagem={pendencias} />
                            </li>
                        )}
                    </ul>
                )}

                {/*
          Drogas vasoativas COM A DATA do lançamento.
          Sem data, "Noradrenalina 0,3" numa tela de comando é lido como
          "está correndo agora". Se a última evolução é de dias atrás, isso é
          história e não conduta — e o card estaria mentindo por omissão.
        */}
                {dvas.length > 0 && (
                    <div className="border-t border-borda-sutil pt-2">
                        <p className="sasi-eyebrow">
                            Infusões · {dataComIdade(leito.ultima_evolucao, agoraISO)}
                        </p>
                        <ul className="mt-1 space-y-0.5">
                            {dvas.map((d, i) => {
                                const rotulo = rotuloInfusao(d);
                                return (
                                    <li
                                        key={`${rotulo}-${i}`}
                                        data-clinical-number
                                        className="text-xs font-medium text-sistema-hemo"
                                    >
                                        {rotulo}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}

                {/*
          Dispositivos (chip HERDADO de `vw_dashboard_uti.dispositivos`):
          informação de fundo, peso visual mínimo. Os dias de uso da tabela
          nova aparecem no detalhe expandido — fontes distintas, não misturar.
        */}
                {dispositivos.length > 0 && (
                    <ul className="flex flex-wrap gap-1">
                        {dispositivos.map((d) => (
                            <li
                                key={d}
                                className="rounded-xs bg-superficie-afundada px-1.5 py-0.5 text-2xs font-medium text-texto-suave"
                            >
                                {d}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/*
        Expansão — a ilha interativa do card. Alvo de toque ≥ 44px (min-h-11):
        uma mão, andando pelo corredor. O detalhe só monta quando aberto, então
        card fechado não consulta o banco.
      */}
            <button
                type="button"
                onClick={() => setExpandido((e) => !e)}
                aria-expanded={expandido}
                aria-controls={idDetalhe}
                className="flex min-h-11 w-full items-center justify-center gap-1 border-t border-borda-sutil text-xs font-medium text-texto-suave transition-colors duration-(--dur-fast) hover:bg-superficie-elevada hover:text-texto-titulo"
            >
                {expandido ? 'Fechar detalhes' : 'Alertas, pendências e dispositivos'}
                {expandido ? <ChevronUp aria-hidden size={14} /> : <ChevronDown aria-hidden size={14} />}
            </button>
            {expandido && (
                <div id={idDetalhe}>
                    <DetalheDoLeito
                        pacienteId={leito.paciente_id}
                        deltaSofa24h={leito.delta_sofa_24h}
                        outOfRangeCount={leito.out_of_range_count}
                        agoraISO={agoraISO}
                        pendencias={pendenciasVivas}
                        erroPendencias={erroPendencias}
                        dispositivos={dispositivosVivos}
                        erroDispositivos={erroDispositivos}
                    />
                </div>
            )}
        </article>
    );
}

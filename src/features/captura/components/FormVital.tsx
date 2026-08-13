'use client';
/**
 * VITAL — janela Máx–Mín do plantão, a primeira ação da Captura.
 *
 * O que este formulário NÃO faz, por contrato (Tela 2, `docs/ARQUITETURA.md`):
 * - não grava aferição bruta (decisão de 10-ago: excursão só como AGREGADO);
 * - não escolhe a janela: ela vem PRONTA do servidor por prop (plantão
 *   corrente, 07h–19h ou 19h–07h em São Paulo) — o celular do corredor não é
 *   fonte de fuso;
 * - não valida clínica: a validação que existe é a de `montarJanela` (espelho
 *   das constraints do banco), e roda DENTRO do serviço na hora de gravar.
 *
 * Máx vem ANTES de Mín na tela porque o formato canônico do app inteiro é
 * Máx–Mín — o campo na mesma ordem em que o número será lido evita a inversão
 * de digitação (que, se acontecer, o serviço inverte e marca "(revisar)" em
 * vez de descartar).
 */
import {useState} from 'react';

import {AvisoAmarelo, AvisoDeFalhaDeLeitura, ConfirmacaoDeGravacao, ErroDeGravacao} from '@/features/captura/components/Mensagens';
import {useJanelasDoPaciente, useRegistrarJanela} from '@/features/captura/hooks/useJanelas';
import {dataHoraCurtaEmSaoPaulo} from '@/features/captura/lib/plantao';
import {LIMIARES_PADRAO} from '@/features/captura/services/janelas';
import {SEM_DADO, num, txt, unidadeSegura} from '@/lib/formatters/clinico';
import type {JanelaDePlantao} from '@/features/captura/lib/plantao';
import type {TipoDeEvento} from '@/features/captura/types';

/**
 * Os vitais CONTÍNUOS que fazem sentido como janela de 24h — nomes exatos do
 * vocabulário (medido nas migrations: pa_sys/pa_dia, não "pas"/"pad").
 * `pam_min` e `pas_min` seguem ativos no banco como LEGADO de janela
 * (substituídos por `janelas_24h` desde o P0) e ficam fora DESTA lista de
 * propósito: gravar uma janela do tipo "PA média (mínima)" duplicaria o
 * legado que a tabela nova veio matar. Desativá-los é decisão de banco.
 */
const VITAIS_DE_JANELA = new Set([
    'pa_sys',
    'pa_dia',
    'pam',
    'fc',
    'fr',
    'spo2',
    'temp',
    'glicemia',
    'pvc',
]);

/** Número em pt-BR com as casas que o valor pede (37,8 · 90). Ausente = travessão. */
function fmt(valor: number | null | undefined): string {
    if (valor == null) return SEM_DADO;
    return num(valor, Number.isInteger(valor) ? 0 : 1);
}

/** O limiar padrão do tipo, em texto — para o médico saber o que "fora" significa. */
function textoDoLimiarPadrao(codigo: string): string | null {
    const p = LIMIARES_PADRAO[codigo];
    if (!p) return null;
    const partes: string[] = [];
    if (p.baixo !== undefined) partes.push(`baixo <${fmt(p.baixo)}`);
    if (p.alto !== undefined) partes.push(`alto >${fmt(p.alto)}`);
    return partes.length > 0 ? partes.join(' · ') : null;
}

const CAMPO =
    'border-borda-padrao bg-superficie-card text-texto-titulo w-full rounded-md border px-3 py-2.5 text-base';

export function FormVital({
    pacienteId,
    vocabulario,
    janela,
}: {
    pacienteId: string;
    vocabulario: TipoDeEvento[];
    /** Janela do plantão corrente, derivada NO SERVIDOR e passada por prop. */
    janela: JanelaDePlantao;
}) {
    const vitais = vocabulario.filter((t) => VITAIS_DE_JANELA.has(t.codigo));
    const [codigo, setCodigo] = useState<string | null>(null);
    const [valorMax, setValorMax] = useState('');
    const [valorMin, setValorMin] = useState('');
    const [nTotal, setNTotal] = useState('');
    const [nForaAlto, setNForaAlto] = useState('');
    const [nForaBaixo, setNForaBaixo] = useState('');
    const [sucesso, setSucesso] = useState<string | null>(null);

    const janelas = useJanelasDoPaciente(pacienteId);
    const gravar = useRegistrarJanela();

    const ref = vitais.find((t) => t.codigo === codigo) ?? null;

    // Substituição: a chave única do banco é paciente+tipo+janela_fim. Se já
    // existe janela deste tipo com ESTE fim, gravar SUBSTITUI (upsert) — e o
    // médico é avisado ANTES, não surpreendido depois.
    const fimMs = Date.parse(janela.fimISO);
    const jaExistente = ref
        ? (janelas.data ?? []).find(
              (j) => j.tipo === ref.codigo && j.janela_fim != null && Date.parse(j.janela_fim) === fimMs,
          )
        : undefined;

    const semValor = valorMax.trim() === '' && valorMin.trim() === '';

    function aoGravar() {
        if (!ref) return;
        const substitui = jaExistente !== undefined;
        gravar.mutate(
            {
                paciente_id: pacienteId,
                tipo: ref.codigo,
                janelaInicioISO: janela.inicioISO,
                janelaFimISO: janela.fimISO,
                // Campo vazio vira null = NÃO entra no payload (jamais vira 0).
                valor_max: valorMax.trim() === '' ? null : valorMax,
                valor_min: valorMin.trim() === '' ? null : valorMin,
                n_total: nTotal.trim() === '' ? null : nTotal,
                n_fora_alto: nForaAlto.trim() === '' ? null : nForaAlto,
                n_fora_baixo: nForaBaixo.trim() === '' ? null : nForaBaixo,
            },
            {
                onSuccess: ({janela: gravada, avisos}) => {
                    const partes = [
                        `${ref.rotulo} ${fmt(gravada.valor_max)}–${fmt(gravada.valor_min)} gravada`,
                    ];
                    if (substitui) partes.push('substituiu a janela anterior deste plantão');
                    if (avisos.length > 0) partes.push(avisos.join(' · '));
                    setSucesso(partes.join(' — '));
                    setValorMax('');
                    setValorMin('');
                    setNTotal('');
                    setNForaAlto('');
                    setNForaBaixo('');
                },
            },
        );
    }

    return (
        <div className="space-y-4">
            {/* A janela em que TUDO abaixo será gravado — sempre à vista. */}
            <p className="text-texto-suave text-xs font-medium">{janela.rotulo}</p>

            {/* Escolha do vital — chips grandes (alvo ≥48px), rótulo do banco. */}
            <div role="group" aria-label="Tipo de sinal vital">
                <div className="grid grid-cols-3 gap-2">
                    {vitais.map((t) => {
                        const ativo = t.codigo === codigo;
                        return (
                            <button
                                key={t.codigo}
                                type="button"
                                aria-pressed={ativo}
                                onClick={() => {
                                    setCodigo(t.codigo);
                                    setSucesso(null);
                                    gravar.reset();
                                }}
                                className={`min-h-12 rounded-lg border px-2 py-1.5 text-sm transition-colors duration-(--dur-fast) ${
                                    ativo
                                        ? 'border-acento bg-superficie-elevada text-texto-titulo font-semibold'
                                        : 'border-borda-padrao bg-superficie-card text-texto-corpo hover:bg-superficie-elevada font-medium'
                                }`}
                            >
                                {t.rotulo}
                            </button>
                        );
                    })}
                </div>
            </div>

            {ref && (
                <>
                    {jaExistente && (
                        <AvisoAmarelo>
                            Já existe {ref.rotulo} nesta janela de plantão (
                            <span data-clinical-number>{txt(jaExistente.render)}</span>). Gravar de novo
                            SUBSTITUI esse registro.
                        </AvisoAmarelo>
                    )}

                    {/* Máx antes de Mín — a ordem canônica do app inteiro. */}
                    <div className="grid grid-cols-2 gap-2">
                        <label className="block">
                            <span className="sasi-eyebrow">
                                Máx {ref.unidade_padrao ? `(${unidadeSegura(ref.unidade_padrao)})` : ''}
                            </span>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={valorMax}
                                onChange={(e) => setValorMax(e.target.value)}
                                placeholder="vírgula p/ decimal"
                                data-clinical-number
                                className={`mt-1 ${CAMPO}`}
                            />
                        </label>
                        <label className="block">
                            <span className="sasi-eyebrow">Mín</span>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={valorMin}
                                onChange={(e) => setValorMin(e.target.value)}
                                data-clinical-number
                                className={`mt-1 ${CAMPO}`}
                            />
                        </label>
                    </div>

                    {/*
                      Aferições e excursões são OPCIONAIS: sem n_total o banco
                      assume 12 (folha completa de 2/2h); excursão sem limiar
                      informado usa o limiar padrão do tipo — e tipo sem padrão
                      é recusado pelo serviço, nunca inventado.
                    */}
                    <details className="border-borda-sutil rounded-md border">
                        <summary className="text-texto-suave hover:text-texto-titulo flex min-h-11 cursor-pointer items-center px-3 text-xs font-medium">
                            Aferições e excursões (opcional)
                        </summary>
                        <div className="grid grid-cols-3 gap-2 px-3 pb-3">
                            <label className="block">
                                <span className="sasi-eyebrow">Nº aferições</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={nTotal}
                                    onChange={(e) => setNTotal(e.target.value)}
                                    placeholder="12"
                                    data-clinical-number
                                    className={`mt-1 ${CAMPO}`}
                                />
                            </label>
                            <label className="block">
                                <span className="sasi-eyebrow">Nº acima</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={nForaAlto}
                                    onChange={(e) => setNForaAlto(e.target.value)}
                                    data-clinical-number
                                    className={`mt-1 ${CAMPO}`}
                                />
                            </label>
                            <label className="block">
                                <span className="sasi-eyebrow">Nº abaixo</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={nForaBaixo}
                                    onChange={(e) => setNForaBaixo(e.target.value)}
                                    data-clinical-number
                                    className={`mt-1 ${CAMPO}`}
                                />
                            </label>
                            {textoDoLimiarPadrao(ref.codigo) && (
                                <p className="text-texto-tenue col-span-3 text-2xs" data-clinical-number>
                                    Limiar padrão de {ref.rotulo}: {textoDoLimiarPadrao(ref.codigo)}
                                </p>
                            )}
                        </div>
                    </details>

                    <button
                        type="button"
                        onClick={aoGravar}
                        disabled={semValor || gravar.isPending}
                        className="bg-acento min-h-12 w-full rounded-lg text-base font-semibold text-(--texto-sobre-acento) hover:bg-(--acento-hover) disabled:opacity-50"
                    >
                        {gravar.isPending ? 'Gravando…' : `Gravar ${ref.rotulo} do plantão`}
                    </button>
                    {semValor && (
                        <p className="text-texto-tenue text-2xs">
                            Preencha ao menos um dos dois valores — janela sem valor não registra nada.
                        </p>
                    )}
                </>
            )}

            {/* Falha NUNCA é engolida: a mensagem do serviço já diz "o banco NÃO registrou". */}
            {gravar.error && <ErroDeGravacao mensagem={gravar.error.message} />}
            {sucesso && <ConfirmacaoDeGravacao>{sucesso}</ConfirmacaoDeGravacao>}

            {/* Janelas já registradas — o campo `render` vem PRONTO do banco. */}
            <section aria-label="Janelas já registradas">
                <h3 className="sasi-eyebrow">Já registradas deste paciente</h3>
                {janelas.isPending && <p className="text-texto-tenue mt-1 text-xs">Consultando o banco…</p>}
                {janelas.error && <AvisoDeFalhaDeLeitura mensagem={janelas.error.message} />}
                {janelas.data && janelas.data.length === 0 && (
                    <p className="text-texto-tenue mt-1 text-xs">
                        Nenhuma janela registrada — a tabela enche conforme a captura e a ingestão.
                    </p>
                )}
                {janelas.data && janelas.data.length > 0 && (
                    <ul className="mt-1 space-y-1">
                        {janelas.data.map((j) => (
                            <li key={j.id ?? `${j.tipo}-${j.janela_fim}`} className="text-texto-corpo text-xs">
                                <span data-clinical-number className="font-medium">
                                    {txt(j.render)}
                                </span>{' '}
                                <span className="text-texto-tenue" data-clinical-number>
                                    · até {txt(dataHoraCurtaEmSaoPaulo(j.janela_fim))}
                                </span>
                                {j.requires_review === true && (
                                    <span className="bg-gravidade-watcher-bg text-gravidade-watcher-text ml-1.5 rounded-sm px-1.5 py-0.5 text-2xs font-semibold">
                                        revisar
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

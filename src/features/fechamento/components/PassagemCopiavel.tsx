'use client';
/**
 * A passagem de plantão pronta para copiar — a ilha client da rota
 * `/fechamento/passagem`.
 *
 * O TEXTO já vem montado do servidor (`montarPassagem`, função pura): esta
 * ilha não redige nada, não consulta nada e não reordena nada. Ela existe por
 * UM motivo — `navigator.clipboard` só existe no navegador. A ordem dos blocos
 * é a da triagem (mais grave primeiro) e vem decidida do servidor.
 *
 * Copiar TUDO e copiar UM: o turno inteiro vai num bloco só para o grupo do
 * plantão, mas quando o colega pergunta de um leito específico ninguém quer
 * mandar a unidade inteira. As duas cópias saem do MESMO texto — o "copiar
 * tudo" é a junção dos blocos, não uma segunda montagem que poderia divergir.
 */
import {BotaoCopiar} from '@/features/fechamento/components/BotaoCopiar';

export interface BlocoDaPassagem {
    pacienteId: string;
    /** "UTI2 L07 · Nome do paciente" — identidade da aba, não conteúdo clínico. */
    titulo: string;
    texto: string;
}

export function PassagemCopiavel({
    blocos,
    textoCompleto,
}: {
    blocos: BlocoDaPassagem[];
    textoCompleto: string;
}) {
    return (
        <div className="space-y-4">
            <div className="sticky top-16 z-[5] flex flex-wrap items-center justify-between gap-2 rounded-lg border border-borda-padrao bg-superficie-card p-3 shadow-card">
                <div>
                    <p className="sasi-eyebrow">Passagem completa</p>
                    <p className="text-xs text-texto-suave">
                        {blocos.length} paciente{blocos.length === 1 ? '' : 's'} do seu plantão, mais grave
                        primeiro.
                    </p>
                </div>
                <BotaoCopiar texto={textoCompleto} rotulo="Copiar tudo" variante="destaque" />
            </div>

            <p
                role="note"
                className="rounded-md bg-gravidade-watcher-bg px-3 py-2 text-xs font-medium text-gravidade-watcher-text"
            >
                Rascunho a revisar antes de passar. O que não tinha fonte no banco foi omitido — ausência aqui
                não é normalidade, é falta de registro.
            </p>

            {blocos.map((bloco) => (
                <section
                    key={bloco.pacienteId}
                    aria-label={bloco.titulo}
                    className="rounded-lg border border-borda-padrao bg-superficie-card p-3"
                >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold text-texto-titulo">{bloco.titulo}</h2>
                        <BotaoCopiar texto={bloco.texto} rotulo="Copiar este" />
                    </div>
                    <pre className="mt-2 max-h-[60vh] overflow-auto rounded-md border border-borda-padrao bg-superficie-afundada p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-texto-corpo">
                        {bloco.texto}
                    </pre>
                </section>
            ))}
        </div>
    );
}

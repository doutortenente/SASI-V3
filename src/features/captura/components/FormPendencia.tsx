'use client';
/**
 * PENDÊNCIA — o "falta fazer" do paciente: criar e concluir a um toque.
 *
 * Casa única: o serviço e os hooks de leitura/conclusão moram em
 * `features/pendencias` (é de lá que a passagem de plantão lê) — este
 * formulário REUTILIZA `usePendencias`/`useConcluirPendencia` e só acrescenta
 * a mutação de criação (`useCriarPendencia`). Criar pendência por outro
 * caminho faria a passagem mentir.
 *
 * Prioridade em 3 botões ROTULADOS (não numerados): "Agora" (1,
 * tempo-sensível), "Rotina" (2, padrão) e "Pode esperar" (3). O 1 é escolha
 * ativa do médico, nunca automática.
 */
import {useState} from 'react';

import {
    AvisoDeFalhaDeLeitura,
    ConfirmacaoDeGravacao,
    ErroDeGravacao,
} from '@/features/captura/components/Mensagens';
import {useCriarPendencia} from '@/features/captura/hooks/useCriarPendencia';
import {useConcluirPendencia, usePendencias} from '@/features/pendencias/hooks/usePendencias';
import type {PrioridadeDePendencia} from '@/features/pendencias/services/pendencias';

/** Rótulos e cores do contrato de prioridade (1 = tempo-sensível). */
const PRIORIDADES: Array<{
    valor: PrioridadeDePendencia;
    rotulo: string;
    classeAtiva: string;
}> = [
    {valor: 1, rotulo: 'Agora', classeAtiva: 'bg-gravidade-critico-bg text-gravidade-critico-text border-gravidade-critico'},
    {valor: 2, rotulo: 'Rotina', classeAtiva: 'bg-gravidade-watcher-bg text-gravidade-watcher-text border-gravidade-watcher'},
    {valor: 3, rotulo: 'Pode esperar', classeAtiva: 'bg-superficie-afundada text-texto-titulo border-borda-padrao'},
];

const ROTULO_PRIORIDADE: Record<PrioridadeDePendencia, string> = {
    1: 'Agora',
    2: 'Rotina',
    3: 'Pode esperar',
};

const CLASSE_SELO: Record<PrioridadeDePendencia, string> = {
    1: 'bg-gravidade-critico-bg text-gravidade-critico-text',
    2: 'bg-gravidade-watcher-bg text-gravidade-watcher-text',
    3: 'bg-superficie-afundada text-texto-suave',
};

export function FormPendencia({pacienteId}: {pacienteId: string}) {
    const [tarefa, setTarefa] = useState('');
    const [prioridade, setPrioridade] = useState<PrioridadeDePendencia>(2);
    const [sucesso, setSucesso] = useState<string | null>(null);

    const criar = useCriarPendencia();
    const concluir = useConcluirPendencia();
    const {pendenciasPorPaciente, erro, carregando, desatualizado} = usePendencias();

    // Mapa carregado + paciente ausente = zero pendência aberta (fato medido).
    const abertas = pendenciasPorPaciente ? (pendenciasPorPaciente[pacienteId] ?? []) : undefined;

    function aoCriar() {
        const texto = tarefa.trim();
        if (texto === '') return;
        criar.mutate(
            {paciente_id: pacienteId, tarefa: texto, prioridade},
            {
                onSuccess: (gravada) => {
                    setSucesso(
                        `Pendência registrada — "${gravada.tarefa}" · ${ROTULO_PRIORIDADE[gravada.prioridade]}`,
                    );
                    setTarefa('');
                },
            },
        );
    }

    return (
        <div className="space-y-4">
            <label className="block">
                <span className="sasi-eyebrow">O que falta fazer</span>
                <input
                    type="text"
                    value={tarefa}
                    onChange={(e) => setTarefa(e.target.value)}
                    placeholder="ex.: colher gasometria de controle"
                    className="border-borda-padrao bg-superficie-card text-texto-titulo mt-1 w-full rounded-md border px-3 py-2.5 text-base"
                />
            </label>

            <div role="group" aria-label="Prioridade">
                <div className="grid grid-cols-3 gap-2">
                    {PRIORIDADES.map((p) => {
                        const ativa = p.valor === prioridade;
                        return (
                            <button
                                key={p.valor}
                                type="button"
                                aria-pressed={ativa}
                                onClick={() => setPrioridade(p.valor)}
                                className={`min-h-12 rounded-lg border px-2 text-sm transition-colors duration-(--dur-fast) ${
                                    ativa
                                        ? `font-semibold ${p.classeAtiva}`
                                        : 'border-borda-padrao bg-superficie-card text-texto-corpo hover:bg-superficie-elevada font-medium'
                                }`}
                            >
                                {p.rotulo}
                            </button>
                        );
                    })}
                </div>
            </div>

            <button
                type="button"
                onClick={aoCriar}
                disabled={tarefa.trim() === '' || criar.isPending}
                className="bg-acento min-h-12 w-full rounded-lg text-base font-semibold text-(--texto-sobre-acento) hover:bg-(--acento-hover) disabled:opacity-50"
            >
                {criar.isPending ? 'Gravando…' : 'Criar pendência'}
            </button>

            {/* Falha NUNCA é engolida: a mensagem já diz "o banco NÃO registrou". */}
            {criar.error && <ErroDeGravacao mensagem={criar.error.message} />}
            {sucesso && <ConfirmacaoDeGravacao>{sucesso}</ConfirmacaoDeGravacao>}

            {/* Abertas deste paciente — concluir a um toque, sem sair da tela. */}
            <section aria-label="Pendências abertas deste paciente">
                <h3 className="sasi-eyebrow">Abertas deste paciente</h3>
                {desatualizado && (
                    <p className="bg-gravidade-watcher-bg text-gravidade-watcher-text mt-1 rounded-md px-3 py-2 text-xs font-medium">
                        O canal ao vivo caiu — a lista pode estar desatualizada até a conexão voltar.
                    </p>
                )}
                {erro && <AvisoDeFalhaDeLeitura mensagem={erro.message} />}
                {concluir.error && <ErroDeGravacao mensagem={concluir.error.message} />}
                {!erro && carregando && <p className="text-texto-tenue mt-1 text-xs">Consultando o banco…</p>}
                {abertas && abertas.length === 0 && (
                    <p className="text-texto-tenue mt-1 text-xs">Nenhuma pendência aberta.</p>
                )}
                {abertas && abertas.length > 0 && (
                    <ul className="mt-1 space-y-1.5">
                        {abertas.map((p) => (
                            <li key={p.id} className="flex items-center gap-2">
                                <div className="min-w-0 flex-1">
                                    <p className="text-texto-corpo text-sm">
                                        <span
                                            className={`mr-1.5 rounded-sm px-1.5 py-0.5 text-2xs font-semibold tracking-wide uppercase ${CLASSE_SELO[p.prioridade]}`}
                                        >
                                            {ROTULO_PRIORIDADE[p.prioridade]}
                                        </span>
                                        {p.tarefa}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => concluir.mutate(p.id)}
                                    disabled={concluir.isPending}
                                    className="border-borda-padrao text-texto-corpo hover:bg-superficie-elevada min-h-11 shrink-0 rounded-md border px-3 text-xs font-medium disabled:opacity-50"
                                >
                                    Concluir
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

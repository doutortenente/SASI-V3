'use client';
/**
 * A ilha client da Captura — as três ações sobre UM paciente.
 *
 * O paciente (cabeçalho fixo), o vocabulário e a janela do plantão chegam
 * PRONTOS do Server Component (`app/captura/[pacienteId]/page.tsx`): este
 * componente não consulta nada disso de novo — aqui moram só as mutações e as
 * listas ao vivo de cada formulário.
 *
 * Abas como cartões grandes (alvo ≥48px), sem modal nenhum: celular, UMA MÃO,
 * andando pelo corredor. Trocar de aba não perde o que já foi digitado nas
 * outras — os três formulários ficam montados e só a visibilidade muda
 * (`hidden`), porque perder a tarefa digitada ao conferir um vital seria
 * exatamente o atrito que faria o papel voltar.
 */
import {useState} from 'react';

import {FormEvento} from '@/features/captura/components/FormEvento';
import {FormPendencia} from '@/features/captura/components/FormPendencia';
import {FormVital} from '@/features/captura/components/FormVital';
import type {JanelaDePlantao} from '@/features/captura/lib/plantao';
import type {TipoDeEvento} from '@/features/captura/types';

type Aba = 'vital' | 'evento' | 'pendencia';

const ABAS: Array<{id: Aba; rotulo: string; descricao: string}> = [
    {id: 'vital', rotulo: 'Vital', descricao: 'Máx–Mín do plantão'},
    {id: 'evento', rotulo: 'Evento', descricao: 'lab, escore, dose'},
    {id: 'pendencia', rotulo: 'Pendência', descricao: 'falta fazer'},
];

export function CapturaDoPaciente({
    pacienteId,
    vocabulario,
    janela,
    agoraISO,
}: {
    pacienteId: string;
    /** Vocabulário completo (`evento_tipo_ref` ativos), lido no servidor. */
    vocabulario: TipoDeEvento[];
    /** Janela do plantão corrente, derivada no servidor. */
    janela: JanelaDePlantao;
    /** Relógio do servidor — default da hora de coleta do evento. */
    agoraISO: string;
}) {
    const [aba, setAba] = useState<Aba>('vital');

    return (
        <div className="space-y-4">
            <div role="tablist" aria-label="Ação de captura" className="grid grid-cols-3 gap-2">
                {ABAS.map((a) => {
                    const ativa = a.id === aba;
                    return (
                        <button
                            key={a.id}
                            type="button"
                            role="tab"
                            aria-selected={ativa}
                            aria-controls={`painel-${a.id}`}
                            onClick={() => setAba(a.id)}
                            className={`flex min-h-14 flex-col items-center justify-center rounded-xl border px-2 py-1.5 transition-colors duration-(--dur-fast) ${
                                ativa
                                    ? 'border-acento bg-superficie-card text-texto-titulo shadow-card'
                                    : 'border-borda-padrao bg-superficie-elevada text-texto-suave hover:text-texto-titulo'
                            }`}
                        >
                            <span className={`text-sm ${ativa ? 'font-bold' : 'font-semibold'}`}>{a.rotulo}</span>
                            <span className="text-2xs">{a.descricao}</span>
                        </button>
                    );
                })}
            </div>

            <div
                id="painel-vital"
                role="tabpanel"
                aria-label="Registrar sinal vital"
                hidden={aba !== 'vital'}
                className="bg-superficie-card border-borda-padrao shadow-card rounded-xl border p-4"
            >
                <FormVital pacienteId={pacienteId} vocabulario={vocabulario} janela={janela} />
            </div>
            <div
                id="painel-evento"
                role="tabpanel"
                aria-label="Registrar evento clínico"
                hidden={aba !== 'evento'}
                className="bg-superficie-card border-borda-padrao shadow-card rounded-xl border p-4"
            >
                <FormEvento pacienteId={pacienteId} vocabulario={vocabulario} agoraISO={agoraISO} />
            </div>
            <div
                id="painel-pendencia"
                role="tabpanel"
                aria-label="Registrar pendência"
                hidden={aba !== 'pendencia'}
                className="bg-superficie-card border-borda-padrao shadow-card rounded-xl border p-4"
            >
                <FormPendencia pacienteId={pacienteId} />
            </div>
        </div>
    );
}

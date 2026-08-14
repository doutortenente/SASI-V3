/**
 * Rota /captura/[pacienteId] — REGISTRO À BEIRA DO LEITO.
 *
 * O Server Component carrega o que é estável durante a captura e entrega por
 * prop à ilha client (`CapturaDoPaciente`):
 * - o PACIENTE (da mesma consulta triada do painel) — vira o cabeçalho FIXO
 *   com leito + nome + gravidade, porque lançar no paciente errado é o pior
 *   erro desta tela e a identidade não pode sair da vista ao rolar;
 * - o VOCABULÁRIO (`evento_tipo_ref` ativos, na ordem do banco);
 * - a JANELA do plantão corrente (07h–19h ou 19h–07h em America/Sao_Paulo),
 *   derivada AQUI no servidor — o relógio do celular não decide fuso;
 * - o relógio `agoraISO`, default editável da hora de coleta.
 *
 * `force-dynamic`: identidade de paciente e vocabulário não podem vir de
 * página guardada em cache.
 */
import {ArrowLeft} from 'lucide-react';
import Link from 'next/link';
import type {Metadata} from 'next';

import {GravityBadge} from '@/components/clinical/GravityBadge';
import {CapturaDoPaciente} from '@/features/captura/components/CapturaDoPaciente';
import {derivarJanelaDePlantao} from '@/features/captura/lib/plantao';
import {lerTiposDeEvento} from '@/features/captura/services/vocabulario';
import {lerLeitosOcupados} from '@/features/beds/services/leitos';
import {getSupabaseServer} from '@/lib/supabase/server';
import {numeroDoLeito, txt} from '@/lib/formatters/clinico';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {title: 'Captura'};

export default async function CapturaPacientePage({params}: {params: Promise<{pacienteId: string}>}) {
    const {pacienteId} = await params;

    const leitos = await lerLeitosOcupados();
    const paciente = leitos.find((l) => l.paciente_id === pacienteId);

    // Paciente fora do painel (alta, óbito, id errado no link): dizer a verdade
    // e mandar de volta — nunca abrir formulário órfão que gravaria no vazio.
    if (!paciente) {
        return (
            <main className="mx-auto max-w-xl p-4 sm:p-6">
                <section className="rounded-lg border border-borda-padrao bg-superficie-card p-6 shadow-card">
                    <p className="sasi-eyebrow">Paciente não encontrado</p>
                    <h1 className="text-lg font-semibold text-texto-titulo">
                        Este paciente não está no painel de leitos ativos
                    </h1>
                    <p className="mt-2 text-sm text-texto-suave">
                        Ou o leito já foi desocupado (alta, óbito, transferência), ou o endereço veio errado.
                        Nada foi gravado.
                    </p>
                    <Link
                        href="/captura"
                        className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-md border border-borda-padrao px-4 text-sm font-medium text-texto-corpo hover:bg-superficie-elevada"
                    >
                        <ArrowLeft aria-hidden size={16} />
                        Escolher outro paciente
                    </Link>
                </section>
            </main>
        );
    }

    const supabase = await getSupabaseServer();
    const vocabulario = await lerTiposDeEvento(supabase);
    const agora = new Date();
    const janela = derivarJanelaDePlantao(agora);

    return (
        <>
            {/*
              Cabeçalho FIXO em bloco único (barra de comando + identidade):
              dois `sticky` separados brigariam pelo topo. A identidade fica
              SEMPRE visível — é a garantia de "estou lançando em quem eu acho".
            */}
            <div className="sticky top-0 z-10">
                <header className="sasi-chrome">
                    <div className="mx-auto flex max-w-[1600px] items-baseline gap-3 px-4 py-3 pr-14 sm:px-6 sm:pr-14">
                        <span className="text-md font-bold tracking-tight text-chrome-texto">SASI</span>
                        <span className="text-xs font-medium tracking-wide text-chrome-suave uppercase">
                            Captura · beira do leito
                        </span>
                    </div>
                </header>
                <div className="border-b border-borda-padrao bg-superficie-card shadow-card">
                    <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-2 sm:px-6">
                        <Link
                            href="/captura"
                            aria-label="Trocar de paciente"
                            className="-ml-2 flex min-h-11 min-w-11 items-center justify-center text-texto-suave hover:text-texto-titulo"
                        >
                            <ArrowLeft aria-hidden size={20} />
                        </Link>
                        <div className="shrink-0">
                            <p className="sasi-eyebrow">{paciente.uti}</p>
                            <p
                                data-clinical-number
                                className="text-2xl leading-none font-bold text-texto-titulo"
                            >
                                {numeroDoLeito(paciente.leito)}
                            </p>
                        </div>
                        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-texto-titulo">
                            {txt(paciente.nome)}
                        </p>
                        <GravityBadge nivel={paciente.acuidade} tamanho="sm" />
                    </div>
                </div>
            </div>

            <main className="mx-auto max-w-xl p-4 sm:p-6">
                <CapturaDoPaciente
                    pacienteId={paciente.paciente_id}
                    vocabulario={vocabulario}
                    janela={janela}
                    agoraISO={agora.toISOString()}
                />
            </main>
        </>
    );
}

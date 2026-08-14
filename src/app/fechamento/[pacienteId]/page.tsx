/**
 * Rota /fechamento/[pacienteId] — A FICHA E O TEXTO, lado a lado.
 *
 * O Server Component carrega TUDO que a nota consome, numa ida só por fonte:
 *  - o paciente com os 5 campos da armadilha do `save_ficha` (`hd`,
 *    `alergias`, `idade`, `peso`, `altura`) mais a ficha congelada da admissão;
 *  - a nota corrente (`lerEvolucaoCorrente`) — `null` é resposta legítima;
 *  - os insumos das 8 fontes (`lerInsumosDoFechamento`, em paralelo);
 *  - os dois relógios do plantão, derivados AQUI: o relógio do navegador não
 *    decide fuso nem virada de turno (regra de `fn_evolucao_relogios`).
 *
 * Falha de LEITURA em qualquer uma delas lança e sobe para `app/error.tsx` —
 * nunca vira tela em branco que se parece com "paciente sem dado".
 *
 * `force-dynamic`: ficha de paciente não pode vir de página guardada em cache.
 */
import {ArrowLeft} from 'lucide-react';
import Link from 'next/link';
import type {Metadata} from 'next';

import {GravityBadge} from '@/components/clinical/GravityBadge';
import {lerLeitosOcupados} from '@/features/beds/services/leitos';
import {FechamentoDoPaciente} from '@/features/fechamento/components/FechamentoDoPaciente';
import {notaEDestePlantao} from '@/features/fechamento/lib/estado';
import {derivarRelogiosDaNota} from '@/features/fechamento/services/ficha';
import {lerEvolucaoCorrente, lerInsumosDoFechamento} from '@/features/fechamento/services/insumos';
import {lerPacientesParaFicha} from '@/features/fechamento/services/pacientes';
import {getSupabaseServer} from '@/lib/supabase/server';
import {numeroDoLeito, txt} from '@/lib/formatters/clinico';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {title: 'Fechamento'};

export default async function FechamentoDoPacientePage({params}: {params: Promise<{pacienteId: string}>}) {
    const {pacienteId} = await params;

    const leitos = await lerLeitosOcupados();
    const leito = leitos.find((l) => l.paciente_id === pacienteId);

    // Paciente fora do painel (alta, óbito, id errado no link): dizer a verdade
    // e mandar de volta — nunca abrir ficha órfã que gravaria no vazio.
    if (!leito) {
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
                        href="/fechamento"
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
    const [pacientes, evolucao, insumos] = await Promise.all([
        lerPacientesParaFicha(supabase, [pacienteId]),
        lerEvolucaoCorrente(supabase, pacienteId),
        lerInsumosDoFechamento(supabase, pacienteId),
    ]);
    const paciente = pacientes[0];

    // A view do painel tem o paciente, mas `pacientes` não devolveu a linha:
    // sem `hd`/`alergias`/`peso` carregados, gravar APAGARIA esses campos (a
    // armadilha do `save_ficha`). Melhor não abrir a ficha do que abri-la
    // sabendo que salvar destrói dado.
    if (!paciente) {
        return (
            <main className="mx-auto max-w-xl p-4 sm:p-6">
                <section className="rounded-lg border-2 border-gravidade-critico bg-superficie-card p-6">
                    <p className="sasi-eyebrow">Ficha indisponível</p>
                    <h1 className="text-lg font-semibold text-gravidade-critico">
                        O paciente aparece no painel, mas o cadastro não voltou
                    </h1>
                    <p className="mt-2 text-sm text-texto-suave">
                        Sem o cadastro carregado (hipótese diagnóstica, alergias, peso), salvar a ficha
                        APAGARIA esses campos no banco. Nada foi gravado e a ficha não abre.
                    </p>
                    <Link
                        href="/fechamento"
                        className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-md border border-borda-padrao px-4 text-sm font-medium text-texto-corpo hover:bg-superficie-elevada"
                    >
                        <ArrowLeft aria-hidden size={16} />
                        Voltar
                    </Link>
                </section>
            </main>
        );
    }

    const agora = new Date();
    const {dataPlantao, turno} = derivarRelogiosDaNota(agora);

    return (
        <>
            {/*
              Cabeçalho FIXO em bloco único (barra de comando + identidade): a
              identidade fica SEMPRE visível, porque escrever a nota no paciente
              errado é o pior erro desta tela.
            */}
            <div className="sticky top-0 z-10">
                <header className="sasi-chrome">
                    <div className="mx-auto flex max-w-[1600px] items-baseline gap-3 px-4 py-3 pr-14 sm:px-6 sm:pr-14">
                        <span className="text-md font-bold tracking-tight text-chrome-texto">SASI</span>
                        <span className="text-xs font-medium tracking-wide text-chrome-suave uppercase">
                            Fechamento · {dataPlantao.split('-').reverse().join('/')} {turno}
                        </span>
                    </div>
                </header>
                <div className="border-b border-borda-padrao bg-superficie-card shadow-card">
                    <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-2 sm:px-6">
                        <Link
                            href="/fechamento"
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
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-texto-titulo">
                                {txt(paciente.nome)}
                            </p>
                            <p className="truncate text-xs text-texto-suave">{txt(paciente.hd)}</p>
                        </div>
                        <GravityBadge nivel={leito.acuidade} tamanho="sm" />
                    </div>
                </div>
            </div>

            <main className="mx-auto max-w-[1600px] p-4 sm:p-6">
                <FechamentoDoPaciente
                    paciente={paciente}
                    evolucao={evolucao}
                    insumos={insumos}
                    dataPlantaoISO={dataPlantao}
                    turno={turno}
                    ehNotaDestePlantao={notaEDestePlantao(evolucao, dataPlantao, turno)}
                    diasInternacao={leito.dias_internacao ?? null}
                    deltaSofa24h={leito.delta_sofa_24h ?? null}
                    agoraISO={agora.toISOString()}
                />
            </main>
        </>
    );
}

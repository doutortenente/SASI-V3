/**
 * Rota /fechamento — ESCOLHER DE QUEM FECHAR A NOTA, e o atalho da passagem.
 *
 * Server Component: a mesma consulta triada do Meu plantão (`lerLeitosOcupados`,
 * mais grave primeiro) mais UMA consulta de resumo das notas
 * (`lerResumoDasNotas`) — os 7 sistemas de cada paciente não são carregados
 * aqui, porque esta lista não os mostra.
 *
 * O QUE A LISTA RESPONDE, paciente a paciente:
 *  - há nota DESTE plantão? (compara os dois relógios: `data_plantao` +
 *    `turno`, a mesma chave que `fn_evolucao_relogios` deriva no banco);
 *  - ela está finalizada? (`evolucoes.finalizada_em`);
 *  - sem nota nenhuma, a coluna mostra TRAVESSÃO — nunca "0 notas" nem
 *    "pendente": paciente recém-admitido sem nota é um fato, não um atraso.
 *
 * `force-dynamic`: lista de paciente guardada em cache pode oferecer leito que
 * já teve alta, e abrir a ficha do paciente errado é o pior erro desta tela.
 */
import {ChevronRight, FileText} from 'lucide-react';
import Link from 'next/link';
import type {Metadata} from 'next';

import {GravityBadge} from '@/components/clinical/GravityBadge';
import {lerLeitosOcupados} from '@/features/beds/services/leitos';
import {derivarRelogiosDaNota} from '@/features/fechamento/services/ficha';
import {lerResumoDasNotas, type ResumoDeNota} from '@/features/fechamento/services/pacientes';
import {getSupabaseServer} from '@/lib/supabase/server';
import {numeroDoLeito, SEM_DADO, txt} from '@/lib/formatters/clinico';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {title: 'Fechamento'};

/** O que a linha da lista diz sobre a nota — texto e cor, sem sigla crua. */
function estadoDaNota(
    resumo: ResumoDeNota | undefined,
    dataPlantaoISO: string,
    turno: string,
): {rotulo: string; classe: string} {
    // Sem nota NENHUMA: travessão. É ausência de registro, não atraso julgado.
    if (!resumo) return {rotulo: SEM_DADO, classe: 'text-texto-tenue'};

    const desteplantao = resumo.data_plantao === dataPlantaoISO && resumo.turno === turno;
    if (!desteplantao) {
        const dia = resumo.data_plantao.split('-').reverse().join('/');
        return {
            rotulo: `última nota ${dia} (${resumo.turno})`,
            classe: 'text-texto-suave',
        };
    }
    if (resumo.finalizada_em !== null) {
        return {rotulo: 'nota finalizada', classe: 'text-gravidade-estavel'};
    }
    return {rotulo: 'rascunho aberto', classe: 'text-gravidade-watcher'};
}

export default async function FechamentoPage() {
    const leitos = await lerLeitosOcupados();
    const supabase = await getSupabaseServer();
    // Uma consulta só para a lista inteira (6–12 pacientes) — ver o cabeçalho
    // de `lerResumoDasNotas`. Falha de leitura LANÇA e cai no error.tsx.
    const resumos = await lerResumoDasNotas(
        supabase,
        leitos.map((l) => l.paciente_id),
    );

    // Os dois relógios do plantão CORRENTE, derivados no servidor: o relógio do
    // navegador não decide fuso nem virada de turno.
    const {dataPlantao, turno} = derivarRelogiosDaNota(new Date());
    const rotuloDoPlantao = `${dataPlantao.split('-').reverse().join('/')} · ${turno}`;

    return (
        <>
            <header className="sasi-chrome sticky top-0 z-10">
                <div className="mx-auto flex max-w-[1600px] items-baseline gap-3 px-4 py-3 pr-14 sm:px-6 sm:pr-14">
                    <span className="text-md font-bold tracking-tight text-chrome-texto">SASI</span>
                    <span className="text-xs font-medium tracking-wide text-chrome-suave uppercase">
                        Fechamento · fim do turno
                    </span>
                </div>
            </header>

            <main className="mx-auto max-w-2xl p-4 sm:p-6">
                <p className="sasi-eyebrow">Plantão {rotuloDoPlantao}</p>

                {/* A passagem é o produto final do turno — botão destacado, antes
                    da lista, porque é o que se abre com a mão na maçaneta. */}
                <Link
                    href="/fechamento/passagem"
                    className="mt-2 flex min-h-14 items-center justify-center gap-2 rounded-xl bg-acento text-base font-semibold text-(--texto-sobre-acento) shadow-card hover:bg-(--acento-hover)"
                >
                    <FileText aria-hidden size={18} />
                    Passagem do plantão
                </Link>

                {leitos.length === 0 && (
                    <p className="mt-4 rounded-lg border border-borda-padrao bg-superficie-card p-4 text-sm text-texto-suave">
                        Nenhum leito ocupado no painel — não há nota a fechar. Se isso não bate com o plantão
                        real, o problema é de ingestão, não desta tela.
                    </p>
                )}

                {/* Ordem da triagem (mais grave primeiro), a mesma do Meu plantão. */}
                <ul className="mt-4 space-y-2">
                    {leitos.map((l) => {
                        const estado = estadoDaNota(resumos[l.paciente_id], dataPlantao, turno);
                        return (
                            <li key={l.paciente_id}>
                                <Link
                                    href={`/fechamento/${l.paciente_id}`}
                                    className="flex min-h-16 items-center gap-3 rounded-xl border border-borda-padrao bg-superficie-card p-3 shadow-card transition-shadow duration-(--dur-fast) hover:shadow-elevada"
                                >
                                    <div className="w-14 shrink-0">
                                        <p className="sasi-eyebrow">{l.uti}</p>
                                        <p
                                            data-clinical-number
                                            className="text-2xl leading-none font-bold text-texto-titulo"
                                        >
                                            {numeroDoLeito(l.leito)}
                                        </p>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-texto-titulo">
                                            {txt(l.nome)}
                                        </p>
                                        <p className={`truncate text-xs font-medium ${estado.classe}`}>
                                            {estado.rotulo}
                                        </p>
                                    </div>
                                    <GravityBadge nivel={l.acuidade} tamanho="sm" />
                                    <ChevronRight
                                        aria-hidden
                                        size={18}
                                        className="shrink-0 text-texto-tenue"
                                    />
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </main>
        </>
    );
}

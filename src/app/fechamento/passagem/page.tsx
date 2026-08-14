/**
 * Rota /fechamento/passagem — A PASSAGEM DO PLANTÃO INTEIRA, pronta para copiar.
 *
 * Server Component que monta o Formato A da skill (`references/05-export-passagem-turno.md`)
 * para CADA paciente do plantão, na ordem da triagem — mais grave primeiro. A
 * ordem é decisão do chamador (aqui), nunca do formatter.
 *
 * NÃO tem Formato B nem SBAR: o B desenha a unidade inteira (34 leitos) e o
 * rótulo SBAR foi vetado pelo operador. A contagem desta tela é a do PLANTÃO
 * dele, 6 a 12 pacientes — leito fora do painel não é "vago", está fora do
 * sistema.
 *
 * CUSTO, medido em consultas: 1 (painel) + 1 (cadastros) + N × 9 fontes. Para
 * 6–12 pacientes são ~60–110 consultas em paralelo, uma vez por abertura da
 * tela. É o preço de a passagem ler as MESMAS fontes da evolução; montar um
 * atalho próprio criaria uma segunda verdade — o defeito clássico deste repo.
 *
 * `force-dynamic`: passagem servida de cache é passagem do turno passado.
 */
import {ArrowLeft} from 'lucide-react';
import Link from 'next/link';
import type {Metadata} from 'next';

import {lerLeitosOcupados} from '@/features/beds/services/leitos';
import {PassagemCopiavel, type BlocoDaPassagem} from '@/features/fechamento/components/PassagemCopiavel';
import {insumosDaPassagem} from '@/features/fechamento/lib/paraTexto';
import {derivarRelogiosDaNota} from '@/features/fechamento/services/ficha';
import {lerEvolucaoCorrente, lerInsumosDoFechamento} from '@/features/fechamento/services/insumos';
import {lerPacientesParaFicha} from '@/features/fechamento/services/pacientes';
import {getSupabaseServer} from '@/lib/supabase/server';
import {montarPassagem} from '@/lib/formatters/fechamento';
import {numeroDoLeito} from '@/lib/formatters/clinico';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {title: 'Passagem do plantão'};

export default async function PassagemPage() {
    const leitos = await lerLeitosOcupados();
    const supabase = await getSupabaseServer();
    const ids = leitos.map((l) => l.paciente_id);

    // `lerPacientesParaFicha` devolve na ORDEM dos ids pedidos — a triagem do
    // painel (mais grave primeiro) atravessa até o texto final.
    const pacientes = await lerPacientesParaFicha(supabase, ids);

    const agora = new Date();
    const {dataPlantao, turno} = derivarRelogiosDaNota(agora);

    // Um paciente por vez seria N × 9 idas em série; em paralelo a espera é a
    // da fonte mais lenta. Falha em qualquer uma derruba a página inteira, de
    // propósito: passagem sem a seção que falhou é passagem que mente.
    const blocosDeInsumos = await Promise.all(
        pacientes.map(async (paciente) => {
            const leito = leitos.find((l) => l.paciente_id === paciente.id);
            const [evolucao, insumos] = await Promise.all([
                lerEvolucaoCorrente(supabase, paciente.id),
                lerInsumosDoFechamento(supabase, paciente.id),
            ]);
            return {
                paciente,
                insumos: insumosDaPassagem({
                    paciente,
                    diasInternacao: leito?.dias_internacao ?? null,
                    deltaSofa24h: leito?.delta_sofa_24h ?? null,
                    gravidade: leito?.gravidade ?? null,
                    dataPlantaoISO: dataPlantao,
                    turno,
                    evolucao,
                    insumos,
                    agora,
                }),
            };
        }),
    );

    // O texto completo é `montarPassagem` da lista inteira; cada bloco é a
    // mesma função com um paciente só. Mesma função, mesma saída — o "copiar
    // tudo" é a junção exata dos blocos exibidos.
    const textoCompleto = montarPassagem(blocosDeInsumos.map((b) => b.insumos));
    const blocos: BlocoDaPassagem[] = blocosDeInsumos.map((b) => ({
        pacienteId: b.paciente.id,
        titulo: `${b.paciente.uti} ${numeroDoLeito(b.paciente.leito)} · ${b.paciente.nome}`,
        texto: montarPassagem([b.insumos]),
    }));

    return (
        <>
            <div className="sticky top-0 z-10">
                <header className="sasi-chrome">
                    <div className="mx-auto flex max-w-[1600px] items-baseline gap-3 px-4 py-3 pr-14 sm:px-6 sm:pr-14">
                        <span className="text-md font-bold tracking-tight text-chrome-texto">SASI</span>
                        <span className="text-xs font-medium tracking-wide text-chrome-suave uppercase">
                            Passagem · {dataPlantao.split('-').reverse().join('/')} {turno}
                        </span>
                    </div>
                </header>
            </div>

            <main className="mx-auto max-w-4xl p-4 sm:p-6">
                <Link
                    href="/fechamento"
                    className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm text-texto-suave hover:text-texto-titulo"
                >
                    <ArrowLeft aria-hidden size={16} />
                    Voltar ao fechamento
                </Link>

                {blocos.length === 0 ? (
                    <p className="rounded-lg border border-borda-padrao bg-superficie-card p-4 text-sm text-texto-suave">
                        Nenhum leito ocupado no painel — não há plantão a passar. Se isso não bate com o
                        plantão real, o problema é de ingestão, não desta tela.
                    </p>
                ) : (
                    <PassagemCopiavel blocos={blocos} textoCompleto={textoCompleto} />
                )}
            </main>
        </>
    );
}

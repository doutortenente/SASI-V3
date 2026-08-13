'use client';
/**
 * A ilha client do Fechamento — a ficha à esquerda, o texto à direita.
 *
 * ---------------------------------------------------------------------------
 * POR QUE OS DOIS PAINÉIS FICAM LADO A LADO
 * ---------------------------------------------------------------------------
 * Esta é a tela do FIM DO TURNO, em tela grande — não é a captura andando pelo
 * corredor. O médico corrige a ficha e vê a nota mudar no mesmo instante: é o
 * que substitui o ciclo "escrever no papel, transcrever, conferir". No celular
 * os painéis empilham (ficha em cima, texto embaixo), porque coluna dupla em
 * 390px vira duas colunas ilegíveis.
 *
 * ---------------------------------------------------------------------------
 * O QUE CHEGA PRONTO DO SERVIDOR (e não é reconsultado aqui)
 * ---------------------------------------------------------------------------
 * Paciente, nota corrente, insumos das 8 fontes e os dois relógios do plantão
 * vêm do Server Component. Reconsultar no navegador daria uma segunda verdade,
 * chegando num instante diferente. O que é AO VIVO aqui é só a lista de
 * pendências (fonte única, canal próprio) — porque ela muda enquanto a nota é
 * escrita, inclusive por outra tela.
 *
 * ---------------------------------------------------------------------------
 * A REGRA QUE PROTEGE A NOTA DE ONTEM
 * ---------------------------------------------------------------------------
 * `evolucaoId` só começa preenchido quando a nota carregada é DESTE plantão
 * (mesma `data_plantao` e mesmo `turno`). Sendo de outro plantão, ela serve de
 * ponto de partida na tela, mas a gravação CRIA nota nova — gravar por cima
 * apagaria o registro do turno anterior, que é prontuário, não rascunho.
 */
import {useRouter} from 'next/navigation';
import {useMemo, useState} from 'react';

import {
    AvisoDeFalhaDeLeitura,
    ConfirmacaoDeGravacao,
    ErroDeGravacao,
} from '@/features/captura/components/Mensagens';
import {PainelDaFicha} from '@/features/fechamento/components/PainelDaFicha';
import {PainelDoTexto} from '@/features/fechamento/components/PainelDoTexto';
import {useSalvarFicha} from '@/features/fechamento/hooks/useSalvarFicha';
import {
    estadoInicialDaFicha,
    evolucaoDaFicha,
    fichaParaTexto,
    type EstadoDaFicha,
} from '@/features/fechamento/lib/estado';
import {insumosDaEvolucao, sofaDaFicha} from '@/features/fechamento/lib/paraTexto';
import type {PacienteParaFicha} from '@/features/fechamento/services/pacientes';
import type {
    CamposComplementares,
    EntradaDeFicha,
    EvolucaoCorrente,
    InsumosDoFechamento,
    TurnoDaNota,
} from '@/features/fechamento/types';
import {usePendencias} from '@/features/pendencias/hooks/usePendencias';
import {datetimeLocalEmSaoPaulo} from '@/features/captura/lib/plantao';
import {montarEvolucao} from '@/lib/formatters/fechamento';
import {SEM_DADO} from '@/lib/formatters/clinico';

/** ISO -> "13/08 04:12" no relógio do hospital. Ilegível vira travessão. */
function carimboBR(iso: string | null): string {
    if (iso === null) return SEM_DADO;
    const s = datetimeLocalEmSaoPaulo(iso);
    if (s === '') return SEM_DADO;
    return `${s.slice(8, 10)}/${s.slice(5, 7)} ${s.slice(11, 16)}`;
}

export function FechamentoDoPaciente({
    paciente,
    evolucao,
    insumos,
    dataPlantaoISO,
    turno,
    ehNotaDestePlantao,
    diasInternacao,
    deltaSofa24h,
    agoraISO,
}: {
    paciente: PacienteParaFicha;
    /** A nota mais recente. `null` = paciente ainda sem nota nenhuma. */
    evolucao: EvolucaoCorrente | null;
    insumos: InsumosDoFechamento;
    dataPlantaoISO: string;
    turno: TurnoDaNota;
    ehNotaDestePlantao: boolean;
    diasInternacao: number | null;
    deltaSofa24h: number | null;
    /** Relógio do SERVIDOR — o do navegador não decide fuso nem carimbo. */
    agoraISO: string;
}) {
    const router = useRouter();
    const [estado, setEstado] = useState<EstadoDaFicha>(() => estadoInicialDaFicha(evolucao));
    const [evolucaoId, setEvolucaoId] = useState<string | null>(
        ehNotaDestePlantao && evolucao ? evolucao.id : null,
    );
    const [finalizadaEm, setFinalizadaEm] = useState<string | null>(
        ehNotaDestePlantao ? (evolucao?.finalizada_em ?? null) : null,
    );
    const [confirmandoFim, setConfirmandoFim] = useState(false);
    const [sucesso, setSucesso] = useState<string | null>(null);

    const salvar = useSalvarFicha();
    const {pendenciasPorPaciente, erro: erroPendencias} = usePendencias();

    // Pendências AO VIVO quando a consulta já respondeu; enquanto não responde,
    // o retrato lido no servidor (mesma tabela, mesma fonte única). O que não
    // pode acontecer é a nota sair sem a seção porque a consulta ainda não
    // voltou — "não perguntei ainda" viraria "não tem pendência".
    // O `useMemo` não é enfeite: sem ele o array nasceria novo a cada render e
    // a nota inteira seria remontada a cada tecla digitada na ficha.
    const pendenciasAbertas = useMemo(
        () =>
            pendenciasPorPaciente
                ? (pendenciasPorPaciente[paciente.id] ?? [])
                : insumos.pendencias.filter((p) => !p.concluida),
        [pendenciasPorPaciente, paciente.id, insumos.pendencias],
    );

    const ficha = useMemo(() => fichaParaTexto(estado), [estado]);

    // O SOFA sai da ficha EM EDIÇÃO, não do banco: é o escore do que está
    // escrito agora. `agoraISO` mantém o cálculo determinístico entre servidor
    // e navegador (o resultado carrega `calculadoEm`).
    const sofa = useMemo(
        () =>
            sofaDaFicha(
                {hemo: ficha.hemo, hemato: ficha.hemato, renal: ficha.renal, dvas: ficha.dvas},
                paciente.peso,
                new Date(agoraISO),
            ),
        [ficha, paciente.peso, agoraISO],
    );

    const texto = useMemo(
        () =>
            montarEvolucao(
                insumosDaEvolucao({
                    paciente,
                    diasInternacao,
                    deltaSofa24h,
                    dataPlantaoISO,
                    turno,
                    ficha,
                    insumos,
                    pendenciasAbertas,
                    sofa: sofa.resultado,
                    autorNome: evolucao?.autor_nome ?? null,
                }),
            ),
        [
            paciente,
            diasInternacao,
            deltaSofa24h,
            dataPlantaoISO,
            turno,
            ficha,
            insumos,
            pendenciasAbertas,
            sofa.resultado,
            evolucao,
        ],
    );

    function gravar(finalizar: boolean) {
        const entrada: EntradaDeFicha = {
            paciente_id: paciente.id,
            evolucao_id: evolucaoId,
            turno,
            // Os 5 campos da armadilha do `save_ficha` (gravam SEM coalesce)
            // são REENVIADOS como vieram da carga — não mandar apagaria o
            // valor no banco. Não são editáveis nesta tela.
            paciente: {
                hd: paciente.hd,
                alergias: paciente.alergias,
                idade: paciente.idade,
                peso: paciente.peso,
                altura: paciente.altura,
            },
            evolucao: evolucaoDaFicha(estado),
        };

        const complemento: CamposComplementares = {
            dataPlantao: dataPlantaoISO,
            turno,
            tipoNota: estado.tipoNota,
            illnessSeverity: estado.illnessSeverity,
            intercorrencias: ficha.intercorrencias,
        };
        // SOFA sem NENHUM componente apurável não vai no patch: sobrescrever o
        // snapshot anterior com nada apagaria a última transparência conhecida.
        if (sofa.resultado !== null) complemento.sofa = sofa.resultado;
        if (finalizar) complemento.finalizadaEm = new Date().toISOString();

        setSucesso(null);
        salvar.mutate(
            {entrada, complemento},
            {
                onSuccess: (resultado) => {
                    // A nota nova vira o alvo das próximas gravações da sessão:
                    // sem isto, o segundo "Salvar" criaria uma segunda nota.
                    setEvolucaoId(resultado.evolucaoId);
                    setConfirmandoFim(false);
                    if (finalizar) {
                        const agora = new Date().toISOString();
                        setFinalizadaEm(agora);
                        setSucesso(`Nota finalizada às ${carimboBR(agora)}.`);
                    } else {
                        setSucesso('Ficha salva.');
                    }
                    // O cabeçalho do servidor (estado da nota) volta a bater
                    // com o banco sem recarregar a página inteira.
                    router.refresh();
                },
            },
        );
    }

    return (
        <div className="space-y-4">
            {/* Estado da nota — dito em palavra, antes de qualquer edição. */}
            <div className="flex flex-wrap items-center gap-2">
                <p className="text-texto-suave text-xs">
                    {evolucaoId === null
                        ? 'Salvar vai CRIAR a nota deste plantão.'
                        : `Editando a nota deste plantão${finalizadaEm ? ` — finalizada às ${carimboBR(finalizadaEm)}` : ' (rascunho aberto)'}.`}
                </p>
            </div>

            {evolucao && !ehNotaDestePlantao && (
                <p className="bg-gravidade-watcher-bg text-gravidade-watcher-text rounded-md px-3 py-2 text-xs font-medium">
                    A ficha foi preenchida com a nota de{' '}
                    {evolucao.data_plantao.split('-').reverse().join('/')} ({evolucao.turno}) — a
                    mais recente deste paciente. Salvar CRIA uma nota nova deste plantão; a
                    anterior fica intacta. Revise sistema por sistema antes: o exame de ontem não
                    é o de hoje.
                </p>
            )}

            {erroPendencias && <AvisoDeFalhaDeLeitura mensagem={erroPendencias.message} />}

            <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-4">
                    <PainelDaFicha pacienteId={paciente.id} estado={estado} aoMudar={setEstado} />

                    {/*
                      Barra de ação grudada acima da navegação do rodapé: a ficha
                      é longa, e botão de salvar só no fim da página é botão que
                      não se acha às 6h da manhã.
                    */}
                    <div className="border-borda-padrao bg-superficie-card shadow-elevada sticky bottom-24 z-[5] space-y-2 rounded-lg border p-3">
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => gravar(false)}
                                disabled={salvar.isPending}
                                className="bg-acento min-h-12 flex-1 rounded-lg text-base font-semibold text-(--texto-sobre-acento) hover:bg-(--acento-hover) disabled:opacity-50"
                            >
                                {salvar.isPending ? 'Gravando…' : 'Salvar'}
                            </button>
                            {!confirmandoFim && finalizadaEm === null && (
                                <button
                                    type="button"
                                    onClick={() => setConfirmandoFim(true)}
                                    disabled={salvar.isPending}
                                    className="border-borda-padrao text-texto-corpo hover:bg-superficie-elevada min-h-12 flex-1 rounded-lg border text-sm font-semibold disabled:opacity-50"
                                >
                                    Finalizar nota
                                </button>
                            )}
                        </div>

                        {/*
                          Nota já finalizada NÃO oferece "finalizar de novo": o
                          segundo carimbo apagaria a hora real do fechamento —
                          a mesma doutrina do `concluida_at` das pendências, que
                          protege o carimbo com `.eq('concluida', false)`.
                          Correção posterior continua podendo ser salva.
                        */}
                        {finalizadaEm !== null && (
                            <p className="text-texto-suave text-2xs">
                                Nota finalizada às {carimboBR(finalizadaEm)}. Correção salva agora
                                atualiza o conteúdo e NÃO muda a hora de fechamento.
                            </p>
                        )}

                        {/* Confirmação INLINE, sem modal: janela que cobre a tela
                            esconde justamente a ficha que se quer conferir. */}
                        {confirmandoFim && (
                            <div className="border-gravidade-watcher bg-gravidade-watcher-bg rounded-md border p-2">
                                <p className="text-gravidade-watcher-text text-xs font-medium">
                                    Finalizar grava a ficha e carimba a hora de fechamento da nota.
                                    O texto continua sendo rascunho para revisão no prontuário.
                                </p>
                                <div className="mt-2 flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => gravar(true)}
                                        disabled={salvar.isPending}
                                        className="bg-acento min-h-11 flex-1 rounded-md text-sm font-semibold text-(--texto-sobre-acento) disabled:opacity-50"
                                    >
                                        {salvar.isPending ? 'Gravando…' : 'Confirmar e finalizar'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmandoFim(false)}
                                        className="border-borda-padrao text-texto-corpo min-h-11 flex-1 rounded-md border text-sm font-medium"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Falha NUNCA é engolida — a mensagem do serviço já diz
                            "o banco NÃO registrou a mudança". */}
                        {salvar.error && <ErroDeGravacao mensagem={salvar.error.message} />}
                        {sucesso && <ConfirmacaoDeGravacao>{sucesso}</ConfirmacaoDeGravacao>}
                    </div>
                </div>

                {/* O texto acompanha a rolagem da ficha em tela grande. */}
                <div className="lg:sticky lg:top-4 lg:self-start">
                    <PainelDoTexto
                        texto={texto}
                        sofa={sofa.resultado}
                        avisosDoSofa={sofa.avisos}
                        deltaSofa24h={deltaSofa24h}
                    />
                </div>
            </div>
        </div>
    );
}

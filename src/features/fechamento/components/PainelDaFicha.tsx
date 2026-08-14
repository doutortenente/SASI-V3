'use client';
/**
 * A FICHA editável — o lado esquerdo do Fechamento.
 *
 * ---------------------------------------------------------------------------
 * O QUE É EDITÁVEL AQUI E O QUE NÃO É (e por quê)
 * ---------------------------------------------------------------------------
 * Editável: os 7 sistemas, as drogas em infusão, as intercorrências das 24h, a
 * impressão, a conduta, o tipo da nota e a gravidade DA NOTA.
 *
 * NÃO editável, de propósito:
 * - dias de dispositivo e dias de antibiótico — derivados no banco
 *   (`vw_dispositivos_ativos`, `vw_dias_atb_ativo`). Campo digitável para eles
 *   criaria uma segunda contagem que diverge da primeira;
 * - as faixas de sinal vital do texto — vêm prontas de `vw_janelas_24h_render`,
 *   montadas no banco. Os campos Máx–Mín desta ficha ficam gravados no jsonb e
 *   alimentam o SOFA, mas não reescrevem a linha da nota;
 * - pendências não são digitadas na conduta: elas têm casa própria, a tabela
 *   `pendencias`, que é a fonte única da passagem de plantão. Por isso o bloco
 *   de pendências aqui é o MESMO formulário da Captura — importado, não
 *   recriado. Tarefa escrita na conduta E na pendência é tarefa que aparece
 *   duas vezes e é feita zero.
 */
import {FormPendencia} from '@/features/captura/components/FormPendencia';
import {CamposDoSistema} from '@/features/fechamento/components/CamposDoSistema';
import {ListaEditavel} from '@/features/fechamento/components/ListaEditavel';
import {PAINEIS_DOS_SISTEMAS, type ChaveSistema} from '@/features/fechamento/lib/campos';
import {GRAVIDADES_DA_NOTA, TIPOS_DE_NOTA, type EstadoDaFicha} from '@/features/fechamento/lib/estado';
import type {Gravidade} from '@/types';

/** Classe do botão de escolha única (tipo da nota, gravidade da nota). */
function classeEscolha(ativa: boolean, classeAtiva = ''): string {
    return ativa
        ? `font-semibold ${classeAtiva === '' ? 'border-acento bg-superficie-elevada text-texto-titulo' : classeAtiva}`
        : 'border-borda-padrao bg-superficie-card text-texto-corpo hover:bg-superficie-elevada font-medium';
}

/** Cor de cada gravidade — a mesma escala do semáforo dos leitos. */
const CLASSE_GRAVIDADE: Record<Gravidade, string> = {
    estavel: 'bg-gravidade-estavel-bg text-gravidade-estavel-text border-gravidade-estavel',
    watcher: 'bg-gravidade-watcher-bg text-gravidade-watcher-text border-gravidade-watcher',
    instavel: 'bg-gravidade-instavel-bg text-gravidade-instavel-text border-gravidade-instavel',
    critico: 'bg-gravidade-critico-bg text-gravidade-critico-text border-gravidade-critico',
};

export function PainelDaFicha({
    pacienteId,
    estado,
    aoMudar,
}: {
    pacienteId: string;
    estado: EstadoDaFicha;
    aoMudar: (mudanca: (anterior: EstadoDaFicha) => EstadoDaFicha) => void;
}) {
    function mudarCampoDoSistema(sistema: ChaveSistema, campo: string, valor: string) {
        aoMudar((anterior) => ({
            ...anterior,
            sistemas: {
                ...anterior.sistemas,
                [sistema]: {...anterior.sistemas[sistema], [campo]: valor},
            },
        }));
    }

    function mudarLista(chave: 'dvas' | 'sedativos' | 'intercorrencias' | 'impressao' | 'conduta') {
        return (itens: string[]) => aoMudar((anterior) => ({...anterior, [chave]: itens}));
    }

    const impressoesPreenchidas = estado.impressao.filter((l) => l.trim() !== '').length;
    const condutasPreenchidas = estado.conduta.filter((l) => l.trim() !== '').length;
    const desalinhado =
        impressoesPreenchidas > 0 && condutasPreenchidas > 0 && impressoesPreenchidas !== condutasPreenchidas;

    return (
        <div className="space-y-4">
            {/* 1. Que nota é esta, e quão grave ela classifica o paciente HOJE. */}
            <section
                aria-label="Identificação da nota"
                className="space-y-3 rounded-lg border border-borda-padrao bg-superficie-card p-3"
            >
                <div>
                    <h3 className="sasi-eyebrow">Tipo da nota</h3>
                    <div className="mt-1 grid grid-cols-4 gap-1.5">
                        {TIPOS_DE_NOTA.map((t) => (
                            <button
                                key={t.valor}
                                type="button"
                                aria-pressed={estado.tipoNota === t.valor}
                                onClick={() => aoMudar((a) => ({...a, tipoNota: t.valor}))}
                                className={`min-h-11 rounded-md border px-1 text-xs ${classeEscolha(estado.tipoNota === t.valor)}`}
                            >
                                {t.rotulo}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <h3 className="sasi-eyebrow">Gravidade desta nota</h3>
                    <p className="text-2xs text-texto-tenue">
                        É a gravidade que ESTA nota registra, não a do painel. Sem escolha, o campo fica em
                        branco — classificar por omissão seria inventar julgamento.
                    </p>
                    <div className="mt-1 grid grid-cols-4 gap-1.5">
                        {GRAVIDADES_DA_NOTA.map((g) => {
                            const ativa = estado.illnessSeverity === g.valor;
                            return (
                                <button
                                    key={g.valor}
                                    type="button"
                                    aria-pressed={ativa}
                                    onClick={() =>
                                        aoMudar((a) => ({
                                            ...a,
                                            // Tocar de novo na escolha ativa desmarca: errar o
                                            // dedo não deve prender uma classificação.
                                            illnessSeverity: ativa ? null : g.valor,
                                        }))
                                    }
                                    className={`min-h-11 rounded-md border px-1 text-xs ${classeEscolha(ativa, CLASSE_GRAVIDADE[g.valor])}`}
                                >
                                    {g.rotulo}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* 2. Os 7 sistemas, na ordem em que a nota os escreve. */}
            <section aria-label="Exame físico por sistemas" className="space-y-2">
                <h3 className="text-sm font-semibold text-texto-titulo">Exame por sistemas</h3>
                {PAINEIS_DOS_SISTEMAS.map((painel) => (
                    <CamposDoSistema
                        key={painel.chave}
                        painel={painel}
                        valores={estado.sistemas[painel.chave]}
                        aoMudar={(campo, valor) => mudarCampoDoSistema(painel.chave, campo, valor)}
                    />
                ))}
            </section>

            {/* 3. Infusões — TEXTO LIVRE, que é a forma do banco vivo. */}
            <section
                aria-label="Drogas em infusão"
                className="space-y-3 rounded-lg border border-borda-padrao bg-superficie-card p-3"
            >
                <ListaEditavel
                    rotulo="Drogas vasoativas"
                    itens={estado.dvas}
                    aoMudar={mudarLista('dvas')}
                    exemplo="Noradrenalina 12 mL/h"
                    ajuda={
                        'Uma droga por linha, com a vazão. Lista vazia não vira "Não" no texto: ' +
                        'sem registro, a linha é omitida.'
                    }
                    rotuloDeAdicionar="Adicionar droga"
                />
                <ListaEditavel
                    rotulo="Sedação e analgesia"
                    itens={estado.sedativos}
                    aoMudar={mudarLista('sedativos')}
                    exemplo="Fentanil 8 mL/h"
                    rotuloDeAdicionar="Adicionar droga"
                />
            </section>

            {/* 4. Intercorrências — SÓ o delta das 24h, não a história inteira. */}
            <section
                aria-label="Intercorrências das 24 horas"
                className="rounded-lg border border-borda-padrao bg-superficie-card p-3"
            >
                <ListaEditavel
                    rotulo="Intercorrências 24h"
                    itens={estado.intercorrencias}
                    aoMudar={mudarLista('intercorrencias')}
                    exemplo="Dessaturação às 03h20, revertida com aspiração"
                    ajuda="Só o que MUDOU nas últimas 24h. O que já estava na nota de ontem não se repete aqui."
                    rotuloDeAdicionar="Adicionar intercorrência"
                />
            </section>

            {/* 5. Impressão e conduta — 1:1, numeradas, como o template exige. */}
            <section
                aria-label="Impressão e conduta"
                className="space-y-3 rounded-lg border border-borda-padrao bg-superficie-card p-3"
            >
                <ListaEditavel
                    rotulo="Impressão"
                    itens={estado.impressao}
                    aoMudar={mudarLista('impressao')}
                    numerada
                    exemplo="Choque séptico de foco pulmonar, em resolução"
                    rotuloDeAdicionar="Adicionar impressão"
                />
                <ListaEditavel
                    rotulo="Conduta"
                    itens={estado.conduta}
                    aoMudar={mudarLista('conduta')}
                    numerada
                    exemplo="Reduzir noradrenalina mantendo PAM acima de 65"
                    ajuda="Uma conduta para cada impressão, na mesma ordem, com meta numérica. Linha sem fonte não existe — nada de conduta genérica de preenchimento."
                    rotuloDeAdicionar="Adicionar conduta"
                />
                {desalinhado && (
                    <p className="rounded-md bg-gravidade-watcher-bg px-3 py-2 text-xs font-medium text-gravidade-watcher-text">
                        {impressoesPreenchidas} impressões e {condutasPreenchidas} condutas. O template pede
                        1:1 — confira qual problema ficou sem plano. O texto sai assim mesmo, sem completar
                        nada por conta própria.
                    </p>
                )}
            </section>

            {/* 6. Pendências — casa própria, formulário reusado da Captura. */}
            <section
                aria-label="Pendências"
                className="rounded-lg border border-borda-padrao bg-superficie-card p-3"
            >
                <h3 className="text-sm font-semibold text-texto-titulo">Pendências</h3>
                <p className="mt-0.5 mb-2 text-2xs text-texto-tenue">
                    Fonte única da passagem de plantão. O que for tarefa entra aqui, não na conduta — escrito
                    nos dois lugares, aparece duas vezes e é feito zero.
                </p>
                <FormPendencia pacienteId={pacienteId} />
            </section>
        </div>
    );
}

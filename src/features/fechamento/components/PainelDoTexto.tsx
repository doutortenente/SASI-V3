'use client';
/**
 * O painel do TEXTO — a nota montada, viva, ao lado da ficha que a gera.
 *
 * ---------------------------------------------------------------------------
 * POR QUE PRÉ-VISUALIZAÇÃO E NÃO "GERAR TEXTO" NO BOTÃO
 * ---------------------------------------------------------------------------
 * O texto é montado por função pura e determinística (`montarEvolucao`): dada
 * a mesma ficha, sai sempre a mesma nota. Então não há nada a "gerar" — o
 * texto é uma vista da ficha, e mostrá-lo ao vivo faz o médico ver a
 * consequência do que digita, inclusive as OMISSÕES. Ver a linha do sistema
 * sair "não avaliado" enquanto se edita é o que impede a nota de sair pela
 * metade sem ninguém perceber.
 *
 * O bloco é `<pre>` em fonte mono com rolagem própria: o texto vai para o
 * prontuário com as quebras de linha exatas do template, e fonte de largura
 * variável desalinharia a coluna de números (é na coluna torta que o olho
 * perde a diferença entre 1,5 e 15).
 *
 * O SOFA aparece aqui com a MESMA frase do texto (`linhaSofa`, casa única) —
 * se a tela dissesse "4/6" e a nota "3/6", uma das duas estaria mentindo.
 */
import {AvisoAmarelo} from '@/features/captura/components/Mensagens';
import {BotaoCopiar} from '@/features/fechamento/components/BotaoCopiar';
import {SofaBadge} from '@/components/clinical/SofaBadge';
import type {ResultadoSofa} from '@/lib/clinical/sofa';
import {linhaSofa} from '@/lib/formatters/fechamento';

export function PainelDoTexto({
    texto,
    sofa,
    avisosDoSofa = [],
    deltaSofa24h = null,
}: {
    texto: string;
    /** `null` = nenhum componente apurável. O total NUNCA é somado por fora. */
    sofa: ResultadoSofa | null;
    avisosDoSofa?: string[];
    deltaSofa24h?: number | null;
}) {
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <p className="sasi-eyebrow">Texto da evolução</p>
                    <h2 className="text-texto-titulo text-base font-semibold">
                        TEMPLATE-BASE v2 — montado da ficha ao lado
                    </h2>
                </div>
                <BotaoCopiar texto={texto} rotulo="Copiar" variante="destaque" />
            </div>

            {/*
              AVISO FIXO, nunca dispensável: texto montado por máquina é
              rascunho. A regra da casa é que nada vira registro definitivo sem
              o médico aprovar — e o aviso some do lugar errado se for toast.
            */}
            <p
                role="note"
                className="bg-gravidade-watcher-bg text-gravidade-watcher-text rounded-md px-3 py-2 text-xs font-medium"
            >
                Rascunho a revisar. Leia linha a linha antes de colar no prontuário: o que não
                tinha fonte no banco saiu como &quot;não avaliado&quot; ou foi omitido — ausência
                aqui não é normalidade.
            </p>

            {/* SOFA com a transparência obrigatória: o número grande e, do lado,
                quantos dos 6 componentes foram apurados e o que falta colher. */}
            <div className="border-borda-padrao bg-superficie-elevada flex flex-wrap items-center gap-3 rounded-md border p-3">
                <SofaBadge escore={sofa?.total ?? null} delta={deltaSofa24h} tamanho="lg" />
                <p className="text-texto-suave min-w-0 flex-1 text-2xs">
                    {linhaSofa(sofa, deltaSofa24h)}
                </p>
            </div>

            {avisosDoSofa.map((aviso) => (
                <AvisoAmarelo key={aviso}>{aviso}</AvisoAmarelo>
            ))}

            <pre className="border-borda-padrao bg-superficie-afundada text-texto-corpo max-h-[70vh] overflow-auto rounded-lg border p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                {texto}
            </pre>
        </div>
    );
}

/**
 * Selo de terapia e dispositivo — drogas vasoativas, sedação, ventilação,
 * antibiótico, pendência, sepse.
 *
 * Portado do `sasi-design-system` do v2 (`components/clinical/TherapyBadge`).
 *
 * Cada terapia tem cor própria e fixa. Isso não é decoração: na grade de 33
 * leitos o olho aprende a cor antes de ler a palavra, e "quem está em DVA"
 * vira uma varredura de um segundo em vez de leitura leito a leito.
 *
 * A FORMA mora em `core/Badge`, junto com a do selo de gravidade. Aqui fica só
 * o que é clínico: os 7 pares de cor, os rótulos e o texto que explica a sigla.
 */
import {AlertTriangle, Droplets, Flame, Heart, Pill, Wind} from 'lucide-react';

import {Badge} from '@/components/core/Badge';

export type TipoTerapia = 'dva' | 'sed' | 'vm' | 'vni' | 'atb' | 'pend' | 'sepse';

/** Glifo por tipo — Lucide sempre, nunca SVG à mão (doutrina do design system). */
const ICONE: Record<TipoTerapia, typeof Heart> = {
    dva: Heart,
    sed: Droplets,
    vm: Wind,
    vni: Wind,
    atb: Pill,
    pend: AlertTriangle,
    sepse: Flame,
};

const ESTILO: Record<TipoTerapia, {classe: string; rotulo: string; titulo: string}> = {
    dva: {
        classe: 'bg-selo-dva-bg text-selo-dva-text',
        rotulo: 'DVA',
        titulo: 'Droga vasoativa em curso',
    },
    sed: {
        classe: 'bg-selo-sed-bg text-selo-sed-text',
        rotulo: 'SED',
        titulo: 'Sedação contínua',
    },
    vm: {
        classe: 'bg-selo-vm-bg text-selo-vm-text',
        rotulo: 'VM',
        titulo: 'Ventilação mecânica invasiva',
    },
    vni: {
        classe: 'bg-selo-vni-bg text-selo-vni-text',
        rotulo: 'VNI',
        titulo: 'Ventilação não invasiva ou cateter nasal de alto fluxo',
    },
    atb: {
        classe: 'bg-selo-atb-bg text-selo-atb-text',
        rotulo: 'ATB',
        titulo: 'Antibiótico em curso',
    },
    pend: {
        classe: 'bg-selo-pend-bg text-selo-pend-text',
        rotulo: 'PEND',
        titulo: 'Pendências abertas',
    },
    sepse: {
        classe: 'bg-selo-sepse-bg text-selo-sepse-text',
        rotulo: 'SEPSE-3',
        titulo: 'Critério de Sepsis-3 atingido',
    },
};

export function TherapyBadge({
    tipo,
    contagem,
    rotulo,
    pulsar = false,
}: {
    tipo: TipoTerapia;
    /** Número ao lado do rótulo, ex.: "DVA 2". */
    contagem?: number | null;
    /** Substitui o texto padrão. */
    rotulo?: string;
    /** Pulsação de atenção — só para crítico e sepse. */
    pulsar?: boolean;
}) {
    const e = ESTILO[tipo];
    const Icone = ICONE[tipo];
    const mostraContagem =
        contagem !== null && contagem !== undefined && Number.isFinite(contagem) && contagem > 0;

    return (
        // `tamanho="sm"` porque o selo de terapia é o menor degrau da escala: ele
        // aparece em fileira de 5 dentro do card, e um degrau acima quebraria a
        // linha no celular.
        <Badge classe={e.classe} tamanho="sm" titulo={e.titulo} pulsar={pulsar}>
            <Icone className="size-3 shrink-0" aria-hidden="true" />
            {rotulo ?? e.rotulo}
            {mostraContagem && (
                <span data-clinical-number className="font-bold">
                    {contagem}
                </span>
            )}
        </Badge>
    );
}

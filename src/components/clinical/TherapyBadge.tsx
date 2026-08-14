/**
 * Selo de terapia e dispositivo — drogas vasoativas, sedação, ventilação,
 * antibiótico, pendência, sepse.
 *
 * Portado do `sasi-design-system` do v2 (`components/clinical/TherapyBadge`).
 *
 * Cada terapia tem cor própria e fixa. Isso não é decoração: na grade de 33
 * leitos o olho aprende a cor antes de ler a palavra, e "quem está em DVA"
 * vira uma varredura de um segundo em vez de leitura leito a leito.
 */
export type TipoTerapia = 'dva' | 'sed' | 'vm' | 'vni' | 'atb' | 'pend' | 'sepse';

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
    const mostraContagem =
        contagem !== null && contagem !== undefined && Number.isFinite(contagem) && contagem > 0;

    return (
        <span
            title={e.titulo}
            className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-2xs font-semibold tracking-wide ${e.classe} ${pulsar ? 'sasi-critical-pulse' : ''}`}
        >
            {rotulo ?? e.rotulo}
            {mostraContagem && (
                <span data-clinical-number className="font-bold">
                    {contagem}
                </span>
            )}
        </span>
    );
}

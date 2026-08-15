/**
 * As 3 telas do app — casa única da lista. `NavPrincipal` (barra do celular)
 * e `Sidebar` (rail do desktop) leem daqui; nenhuma das duas duplica a lista.
 */
import {FileText, LayoutGrid, PenLine} from 'lucide-react';

export interface Destino {
    href: string;
    rotulo: string;
    Icone: typeof LayoutGrid;
    /** `true` = só acende com a rota exata (caso da raiz `/`). */
    exato: boolean;
}

export const DESTINOS: Destino[] = [
    {href: '/', rotulo: 'Meu plantão', Icone: LayoutGrid, exato: true},
    {href: '/captura', rotulo: 'Captura', Icone: PenLine, exato: false},
    {href: '/fechamento', rotulo: 'Fechamento', Icone: FileText, exato: false},
];

/** Rota ativa: exata para `/` (senão casaria com tudo), por prefixo nas outras
 *  (assim `/captura/abc123` continua acendendo "Captura"). */
export function estaAtivo(pathname: string, destino: Destino): boolean {
    if (destino.exato) return pathname === destino.href;
    return pathname === destino.href || pathname.startsWith(`${destino.href}/`);
}

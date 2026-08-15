/**
 * Os 4 destinos do rail — casa única da lista. `NavPrincipal` (barra do
 * celular) e `Sidebar` (rail do desktop) leem daqui; nenhuma das duas
 * duplica a lista.
 *
 * Os 4 nomes são os do pacote de design (`templates/*.dc.html`): War Room ·
 * Pacientes · Round · Passagem — literais, não traduzidos para os nomes
 * antigos do produto.
 */
import {ClipboardList, FileText, LayoutGrid, Users} from 'lucide-react';

export interface Destino {
    href: string;
    rotulo: string;
    Icone: typeof LayoutGrid;
    /** `true` = só acende com a rota exata (caso da raiz `/`). */
    exato: boolean;
}

export const DESTINOS: Destino[] = [
    {href: '/', rotulo: 'War Room', Icone: LayoutGrid, exato: true},
    {href: '/pacientes', rotulo: 'Pacientes', Icone: Users, exato: false},
    {href: '/round', rotulo: 'Round', Icone: ClipboardList, exato: false},
    {href: '/fechamento/passagem', rotulo: 'Passagem', Icone: FileText, exato: false},
];

/** Rota ativa: exata para `/` (senão casaria com tudo), por prefixo nas outras
 *  (assim `/captura/abc123` continua acendendo "Captura"). */
export function estaAtivo(pathname: string, destino: Destino): boolean {
    if (destino.exato) return pathname === destino.href;
    return pathname === destino.href || pathname.startsWith(`${destino.href}/`);
}

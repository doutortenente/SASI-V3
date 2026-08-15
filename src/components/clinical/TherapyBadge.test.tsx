/**
 * Congela o selo de terapia — cor por tipo, contagem e rótulo livre.
 *
 * Escrito ANTES de o selo passar a montar em cima do `Badge`. A refatoração só
 * vale se estes testes continuarem passando: o olho do plantão aprende a cor
 * antes da palavra, então trocar par de cor é trocar a linguagem da tela.
 */
import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

import type {TipoTerapia} from './TherapyBadge';
import {TherapyBadge} from './TherapyBadge';

const TIPOS: TipoTerapia[] = ['dva', 'sed', 'vm', 'vni', 'atb', 'pend', 'sepse'];

/** Rótulo e par de cor de cada tipo, como estão em produção. */
const ESPERADO: Record<TipoTerapia, {rotulo: string; fundo: string; texto: string}> = {
    dva: {rotulo: 'DVA', fundo: 'bg-selo-dva-bg', texto: 'text-selo-dva-text'},
    sed: {rotulo: 'SED', fundo: 'bg-selo-sed-bg', texto: 'text-selo-sed-text'},
    vm: {rotulo: 'VM', fundo: 'bg-selo-vm-bg', texto: 'text-selo-vm-text'},
    vni: {rotulo: 'VNI', fundo: 'bg-selo-vni-bg', texto: 'text-selo-vni-text'},
    atb: {rotulo: 'ATB', fundo: 'bg-selo-atb-bg', texto: 'text-selo-atb-text'},
    pend: {rotulo: 'PEND', fundo: 'bg-selo-pend-bg', texto: 'text-selo-pend-text'},
    sepse: {rotulo: 'SEPSE-3', fundo: 'bg-selo-sepse-bg', texto: 'text-selo-sepse-text'},
};

describe('TherapyBadge — cor e rótulo por tipo', () => {
    it.each(TIPOS)('%s tem rótulo fixo e par de cor próprio', (tipo) => {
        const {container} = render(<TherapyBadge tipo={tipo} />);
        const selo = container.firstElementChild;
        expect(selo?.textContent).toContain(ESPERADO[tipo].rotulo);
        expect(selo).toHaveClass(ESPERADO[tipo].fundo);
        expect(selo).toHaveClass(ESPERADO[tipo].texto);
    });

    it('cada tipo tem título que explica a sigla ao passar o mouse', () => {
        const {container} = render(<TherapyBadge tipo="vni" />);
        expect(container.firstElementChild).toHaveAttribute(
            'title',
            'Ventilação não invasiva ou cateter nasal de alto fluxo',
        );
    });
});

describe('TherapyBadge — contagem', () => {
    it('contagem maior que zero aparece ao lado do rótulo, em mono tabular', () => {
        const {container} = render(<TherapyBadge tipo="dva" contagem={2} />);
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(container.querySelector('[data-clinical-number]')).not.toBeNull();
    });

    it.each<number | null>([0, null, Number.NaN])(
        'contagem %s não vira número na tela — "DVA 0" seria afirmar o que não há',
        (contagem) => {
            const {container} = render(<TherapyBadge tipo="dva" contagem={contagem} />);
            expect(container.querySelector('[data-clinical-number]')).toBeNull();
            expect(container.textContent).toBe('DVA');
        },
    );

    it('sem contagem nenhuma, o selo é só a sigla', () => {
        const {container} = render(<TherapyBadge tipo="dva" />);
        expect(container.querySelector('[data-clinical-number]')).toBeNull();
        expect(container.textContent).toBe('DVA');
    });
});

describe('TherapyBadge — rótulo livre', () => {
    it('rótulo dado pelo chamador substitui o padrão', () => {
        const {container} = render(<TherapyBadge tipo="pend" rotulo="Isolamento Contato" />);
        expect(container.textContent).toBe('Isolamento Contato');
    });

    it('NÃO força caixa alta: "Isolamento Contato" chega à tela como foi escrito', () => {
        const {container} = render(<TherapyBadge tipo="pend" rotulo="Isolamento Contato" />);
        expect(container.firstElementChild).not.toHaveClass('uppercase');
    });
});

describe('TherapyBadge — pulsação de atenção', () => {
    it('pulsar liga a única animação de atenção do app', () => {
        const {container} = render(<TherapyBadge tipo="sepse" pulsar />);
        expect(container.firstElementChild).toHaveClass('sasi-critical-pulse');
    });

    it('sem pulsar, nada pisca — se tudo pulsa, nada chama atenção', () => {
        const {container} = render(<TherapyBadge tipo="sepse" />);
        expect(container.firstElementChild).not.toHaveClass('sasi-critical-pulse');
    });
});

describe('TherapyBadge — ícone', () => {
    it.each(TIPOS)('%s carrega um glifo Lucide, nunca SVG à mão', (tipo) => {
        const {container} = render(<TherapyBadge tipo={tipo} />);
        expect(container.querySelector('svg')).not.toBeNull();
    });

    it('ícone não muda o texto — continua só a sigla', () => {
        const {container} = render(<TherapyBadge tipo="dva" />);
        expect(container.textContent).toBe('DVA');
    });
});

describe('TherapyBadge — forma', () => {
    it('mantém a escala de selo pequeno do painel', () => {
        const {container} = render(<TherapyBadge tipo="atb" />);
        const selo = container.firstElementChild;
        expect(selo).toHaveClass('inline-flex');
        expect(selo).toHaveClass('rounded-sm');
        expect(selo).toHaveClass('text-2xs');
        expect(selo).toHaveClass('px-1.5');
        expect(selo).toHaveClass('py-0.5');
        expect(selo).toHaveClass('font-semibold');
        expect(selo).toHaveClass('tracking-wide');
    });

    it.each(TIPOS)('%s não escreve seta', (tipo) => {
        const {container} = render(<TherapyBadge tipo={tipo} contagem={3} />);
        expect(container.textContent ?? '').not.toMatch(/[↑↓→←]/);
    });
});

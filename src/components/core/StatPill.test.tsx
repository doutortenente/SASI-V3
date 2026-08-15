/**
 * Congela a estatística do cabeçalho.
 *
 * Esta peça DIVERGE de propósito do `StatPill` do `sasi-design-system`: lá ela
 * é uma linha (ícone, número, rótulo, Δ) e clicável como filtro; aqui é um
 * quadro com o rótulo em sobrancelha e o número embaixo. O motivo está no
 * cabeçalho do componente — no cabeçalho antigo os números eram texto corrido
 * e o olho tinha que ler para achar. O Δ do design system também não entrou:
 * ele é desenhado com seta, e seta é proibida em texto clínico neste repo.
 */
import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

import type {TomEstatistica} from './StatPill';
import {StatPill} from './StatPill';

const TONS: TomEstatistica[] = ['neutro', 'critico', 'instavel', 'vigilancia', 'estavel', 'acento'];

const COR: Record<TomEstatistica, {valor: string; borda: string}> = {
    neutro: {valor: 'text-texto-titulo', borda: 'border-borda-padrao'},
    critico: {valor: 'text-gravidade-critico', borda: 'border-gravidade-critico/35'},
    instavel: {valor: 'text-gravidade-instavel', borda: 'border-gravidade-instavel/35'},
    vigilancia: {valor: 'text-gravidade-watcher', borda: 'border-gravidade-watcher/35'},
    estavel: {valor: 'text-gravidade-estavel', borda: 'border-gravidade-estavel/35'},
    acento: {valor: 'text-acento-texto', borda: 'border-acento/35'},
};

describe('StatPill — tom', () => {
    it.each(TONS)('%s pinta o número e a borda com o token dele', (tom) => {
        const {container} = render(<StatPill valor={4} rotulo="Críticos" tom={tom} />);
        const quadro = container.firstElementChild;
        expect(quadro).toHaveClass(COR[tom].borda);
        expect(container.querySelector('[data-clinical-number]')).toHaveClass(COR[tom].valor);
    });

    it('sem tom, o padrão é neutro', () => {
        const {container} = render(<StatPill valor={4} rotulo="Leitos" />);
        expect(container.firstElementChild).toHaveClass('border-borda-padrao');
    });
});

describe('StatPill — conteúdo', () => {
    it('o número domina a peça e o rótulo é sobrancelha', () => {
        const {container} = render(<StatPill valor={12} rotulo="Pendências" />);
        expect(screen.getByText('12')).toBeInTheDocument();
        expect(screen.getByText('Pendências')).toHaveClass('sasi-eyebrow');
        expect(container.querySelector('[data-clinical-number]')?.textContent).toBe('12');
    });

    it('aceita travessão como valor — dado ausente não vira zero', () => {
        render(<StatPill valor="—" rotulo="SOFA médio" />);
        expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('não escreve seta de tendência', () => {
        const {container} = render(<StatPill valor={7} rotulo="Instáveis" tom="instavel" />);
        expect(container.textContent ?? '').not.toMatch(/[↑↓→←]/);
    });
});

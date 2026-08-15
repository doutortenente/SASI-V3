/**
 * Testa a peça de FORMA do selo.
 *
 * Os testes de `GravityBadge` e `TherapyBadge` já provam que a aparência dos
 * dois não mudou ao passarem a montar aqui. Este arquivo cobre o que só o
 * `Badge` decide: escala de tamanho, caixa alta, balão de título e pulsação.
 */
import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

import {Badge} from './Badge';

const COR = 'bg-selo-atb-bg text-selo-atb-text';

describe('Badge — forma comum', () => {
    it('a receita de linha, canto e peso é sempre a mesma', () => {
        const {container} = render(<Badge classe={COR}>ATB</Badge>);
        const selo = container.firstElementChild;
        expect(selo).toHaveClass('inline-flex');
        expect(selo).toHaveClass('items-center');
        expect(selo).toHaveClass('gap-1');
        expect(selo).toHaveClass('rounded-sm');
        expect(selo).toHaveClass('font-semibold');
        expect(selo).toHaveClass('tracking-wide');
    });

    it('a cor vem de quem chama — o Badge não conhece domínio clínico', () => {
        const {container} = render(<Badge classe={COR}>ATB</Badge>);
        expect(container.firstElementChild).toHaveClass('bg-selo-atb-bg');
        expect(container.firstElementChild).toHaveClass('text-selo-atb-text');
    });
});

describe('Badge — escala de tamanho', () => {
    it.each([
        ['sm', ['text-2xs', 'px-1.5', 'py-0.5']],
        ['md', ['text-xs', 'px-2', 'py-0.5']],
        ['lg', ['text-sm', 'px-2.5', 'py-1']],
    ] as const)('%s tem o degrau dele', (tamanho, classes) => {
        const {container} = render(
            <Badge classe={COR} tamanho={tamanho}>
                ATB
            </Badge>,
        );
        for (const c of classes) expect(container.firstElementChild).toHaveClass(c);
    });

    it('sem tamanho, o padrão é md', () => {
        const {container} = render(<Badge classe={COR}>ATB</Badge>);
        expect(container.firstElementChild).toHaveClass('text-xs');
    });
});

describe('Badge — caixa alta', () => {
    it('caixaAlta liga o uppercase', () => {
        const {container} = render(
            <Badge classe={COR} caixaAlta>
                Crítico
            </Badge>,
        );
        expect(container.firstElementChild).toHaveClass('uppercase');
    });

    it('sem caixaAlta o texto sai como foi escrito — rótulo livre não é sigla', () => {
        const {container} = render(<Badge classe={COR}>Isolamento Contato</Badge>);
        expect(container.firstElementChild).not.toHaveClass('uppercase');
        expect(container.textContent).toBe('Isolamento Contato');
    });
});

describe('Badge — título e pulsação', () => {
    it('o título vira balão ao passar o mouse, onde a sigla é explicada', () => {
        render(
            <Badge classe={COR} titulo="Antibiótico em curso">
                ATB
            </Badge>,
        );
        expect(screen.getByTitle('Antibiótico em curso')).toBeInTheDocument();
    });

    it('sem título, nenhum atributo title é inventado', () => {
        const {container} = render(<Badge classe={COR}>ATB</Badge>);
        expect(container.firstElementChild).not.toHaveAttribute('title');
    });

    it('pulsar liga a única animação de atenção do app', () => {
        const {container} = render(
            <Badge classe={COR} pulsar>
                SEPSE-3
            </Badge>,
        );
        expect(container.firstElementChild).toHaveClass('sasi-critical-pulse');
    });

    it('sem pulsar, nada pisca', () => {
        const {container} = render(<Badge classe={COR}>ATB</Badge>);
        expect(container.firstElementChild).not.toHaveClass('sasi-critical-pulse');
    });
});

describe('Badge — higiene da lista de classes', () => {
    it('não sobra espaço duplicado quando as opções estão desligadas', () => {
        const {container} = render(<Badge classe={COR}>ATB</Badge>);
        const classes = container.firstElementChild?.getAttribute('class') ?? '';
        expect(classes).not.toMatch(/\s{2}|^\s|\s$/);
    });
});

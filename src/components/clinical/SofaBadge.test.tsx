/**
 * Congela o chip do SOFA — número, ausência e variação.
 *
 * Os CORTES DE COR abaixo são os que o app já usava e estão em produção. Eles
 * DIVERGEM da rampa do `sasi-design-system` (que corta em 3/7/11); o app corta
 * em 7/10/13 e cita a fonte do escore no cabeçalho do arquivo. Mexer em corte
 * clínico não é trabalho de encaixe de design system — o teste existe
 * justamente para que ninguém o faça sem perceber.
 */
import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

import {SEM_DADO} from '@/lib/formatters/clinico';

import {corDoSofa, SofaBadge} from './SofaBadge';

describe('SofaBadge — ausência é ausência', () => {
    it.each([null, undefined])('escore %s vira travessão, NUNCA zero', (escore) => {
        render(<SofaBadge escore={escore} />);
        expect(screen.getByText(SEM_DADO)).toBeInTheDocument();
        expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('NaN também vira travessão — "NaN" na tela do médico não é dado', () => {
        render(<SofaBadge escore={Number.NaN} />);
        expect(screen.getByText(SEM_DADO)).toBeInTheDocument();
    });

    it('zero é um VALOR MEDIDO e aparece como 0', () => {
        render(<SofaBadge escore={0} />);
        expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('quem lê por leitor de tela ouve a diferença entre ausente e calculado', () => {
        const {unmount} = render(<SofaBadge escore={null} />);
        expect(screen.getByLabelText('SOFA não calculado')).toBeInTheDocument();
        unmount();
        render(<SofaBadge escore={9} />);
        expect(screen.getByLabelText('SOFA 9')).toBeInTheDocument();
    });
});

describe('corDoSofa — os cortes em produção', () => {
    it('ausente não tem cor de faixa', () => {
        expect(corDoSofa(null)).toBe('text-texto-tenue');
        expect(corDoSofa(undefined)).toBe('text-texto-tenue');
        expect(corDoSofa(Number.NaN)).toBe('text-texto-tenue');
    });

    it.each([
        [0, 'text-sofa-baixo'],
        [6, 'text-sofa-baixo'],
        [7, 'text-sofa-medio'],
        [9, 'text-sofa-medio'],
        [10, 'text-sofa-alto'],
        [12, 'text-sofa-alto'],
        [13, 'text-sofa-critico'],
        [24, 'text-sofa-critico'],
    ])('escore %i cai na faixa %s', (escore, classe) => {
        expect(corDoSofa(escore)).toBe(classe);
    });
});

describe('SofaBadge — variação em 24 h', () => {
    it('a direção vai em PALAVRA: subindo é piora', () => {
        render(<SofaBadge escore={8} delta={3} />);
        expect(screen.getByText(/subindo/)).toBeInTheDocument();
        expect(screen.getByText(/3/)).toBeInTheDocument();
    });

    it('a direção vai em PALAVRA: em queda é melhora, e o número sai em módulo', () => {
        const {container} = render(<SofaBadge escore={4} delta={-2} />);
        expect(screen.getByText(/em queda/)).toBeInTheDocument();
        expect(container.textContent).toContain('2');
        expect(container.textContent).not.toContain('-2');
    });

    it('delta zero é "estável", não some nem vira travessão', () => {
        render(<SofaBadge escore={5} delta={0} />);
        expect(screen.getByText('estável')).toBeInTheDocument();
    });

    it('sem delta, nada de variação é afirmado', () => {
        const {container} = render(<SofaBadge escore={5} />);
        expect(container.textContent).not.toContain('subindo');
        expect(container.textContent).not.toContain('em queda');
        expect(container.textContent).not.toContain('estável');
    });

    it.each([3, -3, 0])('delta %i NUNCA sai como seta', (delta) => {
        const {container} = render(<SofaBadge escore={8} delta={delta} />);
        expect(container.textContent ?? '').not.toMatch(/[↑↓→←]/);
    });
});

describe('SofaBadge — forma', () => {
    it('o número é mono tabular: dígito ambíguo em dado clínico não passa', () => {
        const {container} = render(<SofaBadge escore={11} />);
        expect(container.querySelector('[data-clinical-number]')).not.toBeNull();
    });

    it('tamanho lg sobe o numeral herói de 24px para 32px', () => {
        const {container} = render(<SofaBadge escore={11} tamanho="lg" />);
        expect(container.querySelector('[data-clinical-number]')).toHaveClass('text-2xl');
    });

    it('sem tamanho, o padrão é md', () => {
        const {container} = render(<SofaBadge escore={11} />);
        expect(container.querySelector('[data-clinical-number]')).toHaveClass('text-xl');
    });
});

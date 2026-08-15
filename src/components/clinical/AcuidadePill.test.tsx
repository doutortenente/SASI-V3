/**
 * Congela a pílula de resumo: cor por nível, singular/plural certo, sem seta.
 */
import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

import {AcuidadePill} from './AcuidadePill';

describe('AcuidadePill — cor por nível', () => {
    it('crítico pinta com o token de crítico', () => {
        const {container} = render(<AcuidadePill nivel="CRITICO" contagem={1} />);
        expect(container.firstElementChild).toHaveClass(
            'bg-gravidade-critico-bg',
            'text-gravidade-critico-text',
        );
    });

    it('estável pinta com o token de estável', () => {
        const {container} = render(<AcuidadePill nivel="ESTAVEL" contagem={2} />);
        expect(container.firstElementChild).toHaveClass('bg-gravidade-estavel-bg', 'text-gravidade-estavel-text');
    });
});

describe('AcuidadePill — texto', () => {
    it('singular quando a contagem é 1', () => {
        render(<AcuidadePill nivel="CRITICO" contagem={1} />);
        expect(screen.getByText(/1 crítico/i)).toBeInTheDocument();
    });

    it('plural quando a contagem é maior que 1', () => {
        render(<AcuidadePill nivel="INSTAVEL" contagem={3} />);
        expect(screen.getByText(/3 instáveis/i)).toBeInTheDocument();
    });

    it('vigilância não pluraliza — "em vigilância" sempre', () => {
        render(<AcuidadePill nivel="VIGILANCIA" contagem={2} />);
        expect(screen.getByText(/2 em vigilância/i)).toBeInTheDocument();
    });

    it('não escreve seta de tendência', () => {
        const {container} = render(<AcuidadePill nivel="INSTAVEL" contagem={7} />);
        expect(container.textContent ?? '').not.toMatch(/[↑↓→←]/);
    });
});

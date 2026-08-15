/**
 * Congela a APARÊNCIA do selo de gravidade.
 *
 * Estes testes nasceram ANTES de o selo passar a montar em cima do `Badge`
 * (a peça de forma comum). A refatoração só pode ser aceita se eles
 * continuarem passando sem alteração: extrair a forma comum não é permissão
 * para mexer em cor, tamanho ou rótulo.
 *
 * O que é considerado aparência aqui: par de cor por nível, escala de
 * tamanho, caixa alta e o rótulo em português. Classe sem efeito visual
 * (ex.: `gap` num selo de filho único) não é congelada de propósito.
 */
import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

import type {Acuidade} from '@/lib/clinical/sasi';

import {GravityBadge, ROTULO_ACUIDADE, SOLIDO_ACUIDADE} from './GravityBadge';

const NIVEIS: Acuidade[] = ['ESTAVEL', 'VIGILANCIA', 'INSTAVEL', 'CRITICO', 'OBITO'];

/** Par preenchimento/texto de cada nível — o mesmo do `sasi-design-system`. */
const COR: Record<Acuidade, {fundo: string; texto: string}> = {
    ESTAVEL: {fundo: 'bg-gravidade-estavel-bg', texto: 'text-gravidade-estavel-text'},
    VIGILANCIA: {fundo: 'bg-gravidade-watcher-bg', texto: 'text-gravidade-watcher-text'},
    INSTAVEL: {fundo: 'bg-gravidade-instavel-bg', texto: 'text-gravidade-instavel-text'},
    CRITICO: {fundo: 'bg-gravidade-critico-bg', texto: 'text-gravidade-critico-text'},
    OBITO: {fundo: 'bg-gravidade-obito-bg', texto: 'text-gravidade-obito-text'},
};

describe('GravityBadge — rótulo', () => {
    it.each(NIVEIS)('%s sai em português, sempre com a mesma grafia', (nivel) => {
        render(<GravityBadge nivel={nivel} />);
        expect(screen.getByText(ROTULO_ACUIDADE[nivel])).toBeInTheDocument();
    });

    it('traduz watcher para Vigilância — o design system usa o termo em inglês', () => {
        expect(ROTULO_ACUIDADE.VIGILANCIA).toBe('Vigilância');
    });
});

describe('GravityBadge — cor por nível', () => {
    it.each(NIVEIS)('%s usa o par de token dele, e só o dele', (nivel) => {
        const {container} = render(<GravityBadge nivel={nivel} />);
        const selo = container.firstElementChild;
        expect(selo).toHaveClass(COR[nivel].fundo);
        expect(selo).toHaveClass(COR[nivel].texto);
    });

    it('óbito é cinza, NUNCA verde: verde em tela de comando significa estável', () => {
        const {container} = render(<GravityBadge nivel="OBITO" />);
        const selo = container.firstElementChild;
        expect(selo?.className).toContain('obito');
        expect(selo?.className).not.toContain('estavel');
        expect(SOLIDO_ACUIDADE.OBITO).toBe('bg-gravidade-obito');
    });
});

describe('GravityBadge — forma', () => {
    it('é caixa alta com espaçamento largo, o tratamento de sobrancelha do painel', () => {
        const {container} = render(<GravityBadge nivel="CRITICO" />);
        const selo = container.firstElementChild;
        expect(selo).toHaveClass('uppercase');
        expect(selo).toHaveClass('tracking-wide');
        expect(selo).toHaveClass('rounded-sm');
        expect(selo).toHaveClass('inline-flex');
        expect(selo).toHaveClass('font-semibold');
    });

    it.each([
        ['sm', ['text-2xs', 'px-1.5', 'py-0.5']],
        ['md', ['text-xs', 'px-2', 'py-0.5']],
        ['lg', ['text-sm', 'px-2.5', 'py-1']],
    ] as const)('tamanho %s mantém a escala medida', (tamanho, classes) => {
        const {container} = render(<GravityBadge nivel="ESTAVEL" tamanho={tamanho} />);
        const selo = container.firstElementChild;
        for (const c of classes) expect(selo).toHaveClass(c);
    });

    it('sem tamanho, o padrão é md', () => {
        const {container} = render(<GravityBadge nivel="ESTAVEL" />);
        expect(container.firstElementChild).toHaveClass('text-xs');
    });
});

describe('GravityBadge — forma de ponto', () => {
    it('o ponto leva a cor CHEIA e o selo perde o preenchimento', () => {
        const {container} = render(<GravityBadge nivel="INSTAVEL" ponto />);
        const selo = container.firstElementChild;
        expect(selo).not.toHaveClass('bg-gravidade-instavel-bg');
        const bolinha = selo?.firstElementChild;
        expect(bolinha).toHaveClass(SOLIDO_ACUIDADE.INSTAVEL);
        expect(bolinha).toHaveClass('rounded-full');
        // A bolinha é decoração: quem lê por leitor de tela já ouve o rótulo.
        expect(bolinha).toHaveAttribute('aria-hidden', 'true');
    });
});

describe('GravityBadge — regra do repo', () => {
    it.each(NIVEIS)('%s não escreve seta em lugar nenhum', (nivel) => {
        const {container} = render(<GravityBadge nivel={nivel} />);
        expect(container.textContent ?? '').not.toMatch(/[↑↓→←]/);
    });
});

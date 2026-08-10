import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';

/**
 * Vitest = o que roda os testes.
 * Regra do projeto: toda função de cálculo clínico (SOFA, PAM, P/F, dose de droga)
 * PRECISA de teste. Conta errada em UTI mata; teste é o contra-cheque.
 */
export default defineConfig({
    plugins: [react()],
    test: {
        // happy-dom simula um navegador em memória — mais leve que jsdom (importa: RAM é o gargalo aqui).
        environment: 'happy-dom',
        globals: true,
        setupFiles: ['./tests/setup.ts'],
        include: ['tests/unit/**/*.{test,spec}.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
        exclude: ['tests/e2e/**', 'node_modules/**', '_material/**'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            // A régua alta é só onde o número vira conduta.
            include: ['src/lib/clinical/**', 'src/features/**/services/**'],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 70,
                statements: 80,
            },
        },
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
});

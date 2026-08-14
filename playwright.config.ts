/**
 * Playwright = o robô que abre um navegador de verdade e clica no app.
 * Diferente do Vitest (que testa função pura em memória), ele prova que a
 * PÁGINA sobe: rota responde, HTML chega, navegação aparece.
 *
 * ESCOPO DELIBERADO: só fumaça (teste de fumaça = ligar o aparelho e ver se
 * sai fumaça). Nada aqui clica em "Salvar". O app aponta para o banco VIVO,
 * com paciente real — e2e que grava contaminaria prontuário.
 *
 * O servidor sobe com `pnpm build && pnpm start`, o mesmo caminho da produção.
 * O `build` reaproveita o cache de `.next/` quando nada mudou, então rodar os
 * dois em sequência custa segundos, não minutos. `reuseExistingServer` deixa
 * o desenvolvedor manter um `pnpm start` aberto ao lado sem o robô matá-lo.
 *
 * Navegador: o **Google Chrome já instalado na máquina** (`channel: 'chrome'`),
 * o mesmo em que o app é usado no plantão. Não se baixa Chromium e não se roda
 * `playwright install` — não há rede para baixar navegador, e testar num
 * navegador diferente do de uso real esconde justamente o defeito que só
 * aparece nele.
 */
import {defineConfig, devices} from '@playwright/test';

const PORTA = 3000;
const BASE_URL = `http://localhost:${PORTA}`;

export default defineConfig({
    testDir: './tests/e2e',
    // Fumaça é sequencial de propósito: 1 servidor, poucas rotas, e falha
    // paralela em suíte pequena só embaralha o relatório.
    fullyParallel: false,
    workers: 1,
    // Teste que só passa na segunda tentativa está escondendo instabilidade.
    retries: 0,
    reporter: [['list']],
    // O app lê do Supabase no servidor; a primeira renderização paga essa ida.
    timeout: 60_000,
    expect: {timeout: 15_000},

    use: {
        baseURL: BASE_URL,
        trace: 'on-first-retry',
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
    },

    projects: [
        {
            name: 'chrome',
            use: {
                ...devices['Desktop Chrome'],
                // `devices['Desktop Chrome']` só define viewport e user agent — o canal
                // não vem junto (conferido na API em 14-ago-2026). Sem esta linha o
                // Playwright procura o Chromium próprio dele, que não existe aqui.
                channel: 'chrome',
            },
        },
    ],

    webServer: {
        command: 'pnpm build && pnpm start',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        // Build a frio + subida do Next: 3 minutos é folga, não expectativa.
        timeout: 180_000,
        stdout: 'pipe',
        stderr: 'pipe',
    },
});

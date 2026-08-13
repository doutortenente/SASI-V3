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
 * Chromium: já instalado em `/opt/pw-browsers` e NÃO se roda
 * `playwright install` (não há rede para baixar). Medido em 13-ago-2026: o
 * navegador presente é o build 1194 e esta versão do Playwright pede o 1234,
 * então o caminho é apontado à mão — ver `acharChromium` abaixo.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { defineConfig, devices } from '@playwright/test';

const PORTA = 3000;
const BASE_URL = `http://localhost:${PORTA}`;

/**
 * Acha o Chromium já instalado na máquina, seja qual for o número do build.
 *
 * POR QUE existe: o Playwright procura uma pasta com o número de build exato
 * que ELE espera (`chromium_headless_shell-1234`). A máquina tem outro número
 * (`chromium-1194`). Sem este apontamento o robô manda rodar
 * `playwright install` — que aqui não funciona, porque não há rede para baixar
 * navegador. Fixar o número no código quebraria na próxima imagem; por isso a
 * pasta é procurada por prefixo.
 *
 * Devolve `undefined` quando não acha nada: aí o Playwright volta ao caminho
 * padrão dele e a mensagem de erro é a original, sem ficar mascarada por esta
 * função.
 */
function acharChromium(): string | undefined {
  const raiz = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  if (!existsSync(raiz)) return undefined;

  // Ordem decrescente = build mais novo primeiro. E o `chromium-` completo vem
  // antes do `chromium_headless_shell-` de propósito: o navegador completo roda
  // tanto com janela quanto sem.
  const pastas = readdirSync(raiz)
    .filter((nome) => nome.startsWith('chromium-'))
    .sort()
    .reverse();

  for (const pasta of pastas) {
    const binario = join(raiz, pasta, 'chrome-linux', 'chrome');
    if (existsSync(binario)) return binario;
  }
  return undefined;
}

const CHROMIUM = acharChromium();

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
  expect: { timeout: 15_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // `exactOptionalPropertyTypes` está ligado no tsconfig: passar
        // `executablePath: undefined` não compila. Ou a chave existe com
        // caminho, ou não existe.
        ...(CHROMIUM === undefined ? {} : { launchOptions: { executablePath: CHROMIUM } }),
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

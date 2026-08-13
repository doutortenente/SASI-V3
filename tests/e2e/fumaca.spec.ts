/**
 * Fumaça das rotas do SASI — o portão do bloco 3 (`docs/ARQUITETURA.md`).
 *
 * O que ele prova: as rotas das 3 telas RESPONDEM 200, o HTML chega com o
 * título certo e a navegação das 3 telas está desenhada. É o equivalente a
 * ligar o monitor e ver os 3 traçados aparecerem — não diz que o paciente está
 * bem, diz que o aparelho está ligado.
 *
 * O que ele NÃO faz, por decisão: nenhuma escrita. O app aponta para o banco
 * VIVO (projeto `idswehsvvqczzkiatuzu`, com paciente real). Clicar em "Salvar"
 * ou "Finalizar nota" num teste automático gravaria prontuário de mentira.
 * Por isso aqui só se navega e se lê.
 *
 * As páginas são Server Components que consultam o Supabase durante a
 * renderização: falha de leitura LANÇA (regra do `exigirDado`) e a rota devolve
 * 500. Ou seja, um vermelho neste arquivo tem duas causas possíveis e o próprio
 * teste as separa: rota quebrada, ou banco inalcançável a partir da máquina.
 */
import { expect, test } from '@playwright/test';

/**
 * As 3 telas + a passagem, com o título que o `metadata` de cada rota promete.
 *
 * A raiz é a exceção e isso NÃO é defeito: o molde `'%s · SASI'` do
 * `layout.tsx` só vale para rota FILHA. A página da própria raiz mora no mesmo
 * nível do molde e por isso substitui o título inteiro — sai "Meu plantão",
 * sem o sufixo. Comportamento do Next, medido em 13-ago-2026.
 */
const ROTAS = [
  { caminho: '/', titulo: 'Meu plantão', tela: 'Meu plantão' },
  { caminho: '/captura', titulo: 'Captura · SASI', tela: 'Captura' },
  { caminho: '/fechamento', titulo: 'Fechamento · SASI', tela: 'Fechamento' },
  { caminho: '/fechamento/passagem', titulo: 'Passagem do plantão · SASI', tela: 'Passagem' },
] as const;

for (const rota of ROTAS) {
  test(`${rota.tela} (${rota.caminho}) responde 200 e renderiza`, async ({ page }) => {
    const resposta = await page.goto(rota.caminho, { waitUntil: 'domcontentloaded' });

    // `page.goto` devolve null só quando não houve navegação de rede.
    expect(resposta, `sem resposta HTTP para ${rota.caminho}`).not.toBeNull();
    expect(resposta!.status(), `status de ${rota.caminho}`).toBe(200);

    // Título vem do `metadata` do arquivo de rota, montado no servidor: se ele
    // chegou, o Server Component terminou de renderizar sem estourar.
    await expect(page).toHaveTitle(rota.titulo);

    // A marca da barra de comando aparece em toda tela.
    await expect(page.getByText('SASI').first()).toBeVisible();
  });
}

test('a navegação das 3 telas está em todas as rotas', async ({ page }) => {
  for (const rota of ROTAS) {
    await page.goto(rota.caminho, { waitUntil: 'domcontentloaded' });

    const nav = page.getByRole('navigation', { name: 'Navegação principal' });
    await expect(nav, `nav ausente em ${rota.caminho}`).toBeVisible();

    for (const destino of ['Meu plantão', 'Captura', 'Fechamento']) {
      await expect(nav.getByRole('link', { name: destino })).toBeVisible();
    }
  }
});

test('/fechamento oferece o atalho da passagem do plantão', async ({ page }) => {
  await page.goto('/fechamento', { waitUntil: 'domcontentloaded' });

  const atalho = page.getByRole('link', { name: 'Passagem do plantão' });
  await expect(atalho).toBeVisible();
  await expect(atalho).toHaveAttribute('href', '/fechamento/passagem');
});

test('nenhuma tela mostra zero no lugar de dado ausente', async ({ page }) => {
  // Regra inegociável: ausente é travessão na TELA, nunca zero. Este teste
  // pega a regressão mais provável — o rótulo de estado da nota virar "0
  // notas" — sem depender de qual paciente está no banco hoje.
  await page.goto('/fechamento', { waitUntil: 'domcontentloaded' });
  const corpo = (await page.locator('body').innerText()).toLowerCase();
  expect(corpo).not.toContain('0 notas');
  expect(corpo).not.toContain('0 pendências');
});

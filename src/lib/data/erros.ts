/**
 * Erro de leitura do banco — casa única.
 *
 * INCIDENTE REAL (v2): uma queda de rede aparecia na tela como "nenhum sinal
 * vital lançado". O médico leu ausência de dado onde havia ausência de CONEXÃO.
 * São coisas clinicamente opostas: a primeira diz "não mediram", a segunda diz
 * "não sei". Confundir as duas à beira do leito é o pior erro que esta tela
 * pode cometer.
 *
 * Regra: falha de leitura SEMPRE lança. Nunca devolve lista vazia, nunca
 * devolve null "por segurança". Quem chama não precisa lembrar de checar —
 * a exceção sobe até `app/error.tsx` e a tela mostra a falha, não um vazio.
 */
export class FalhaDeLeitura extends Error {
  readonly fonte: string;
  readonly causaOriginal: string | undefined;

  constructor(fonte: string, causaOriginal?: string) {
    super(
      `Falha ao ler ${fonte} do banco. A tela NÃO tem dado para mostrar — ` +
        `isto não significa que o dado não existe.` +
        (causaOriginal ? ` Causa: ${causaOriginal}` : ''),
    );
    this.name = 'FalhaDeLeitura';
    this.fonte = fonte;
    this.causaOriginal = causaOriginal;
  }
}

/**
 * Converte a resposta do Supabase em dado ou exceção.
 *
 * `error` presente = lança. `data` null/undefined = lança (a view sempre
 * devolve array, mesmo vazio; null ali significa que a consulta não chegou).
 * Array vazio é resultado LEGÍTIMO: "nenhum leito ocupado" é um fato.
 */
export function exigirDado<T>(
  resposta: { data: T | null; error: { message: string } | null },
  fonte: string,
): T {
  if (resposta.error) throw new FalhaDeLeitura(fonte, resposta.error.message);
  if (resposta.data === null || resposta.data === undefined) throw new FalhaDeLeitura(fonte);
  return resposta.data;
}

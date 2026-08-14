/**
 * Mensagens de resultado da Captura — casa única do "gravou" e do "NÃO gravou".
 *
 * Regra 3 da tarefa da Tela 2: toda falha de gravação aparece com a MENSAGEM
 * REAL na tela — nunca engolida, nunca toast que some antes de ler. Por isso
 * são blocos fixos no fluxo do formulário (ficam até a próxima ação), não
 * notificação flutuante. `role="alert"`/`role="status"` avisam leitor de tela
 * sem roubar o foco do polegar.
 */

/** Falha de gravação — vermelho, com a mensagem do serviço ("o banco NÃO registrou…"). */
export function ErroDeGravacao({mensagem}: {mensagem: string}) {
    return (
        <p
            role="alert"
            className="rounded-md bg-gravidade-critico-bg px-3 py-2 text-xs font-medium text-gravidade-critico-text"
        >
            {mensagem}
        </p>
    );
}

/** Confirmação curta do que foi gravado ("PAM 90–56 gravada"). Verde, persistente. */
export function ConfirmacaoDeGravacao({children}: {children: React.ReactNode}) {
    return (
        <p
            role="status"
            className="rounded-md bg-gravidade-estavel-bg px-3 py-2 text-xs font-medium text-gravidade-estavel-text"
        >
            {children}
        </p>
    );
}

/** Aviso amarelo — a malha de faixas e a substituição de janela: SINALIZA, nunca bloqueia. */
export function AvisoAmarelo({children}: {children: React.ReactNode}) {
    return (
        <p className="rounded-md bg-gravidade-watcher-bg px-3 py-2 text-xs font-medium text-gravidade-watcher-text">
            {children}
        </p>
    );
}

/** Falha de LEITURA — "não sei" é diferente de "não tem", e exige aviso vermelho. */
export function AvisoDeFalhaDeLeitura({mensagem}: {mensagem: string}) {
    return (
        <p className="rounded-sm bg-gravidade-critico-bg px-2 py-1.5 text-2xs font-medium text-gravidade-critico-text">
            {mensagem}
        </p>
    );
}

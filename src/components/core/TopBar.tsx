/**
 * Barra de comando — casa única do cabeçalho `sasi-chrome` que as 3 telas
 * desenhavam cada uma na sua própria página (`page.tsx`, `captura/page.tsx`,
 * `fechamento/page.tsx`), com o mesmo JSX copiado 3 vezes. É o `TopBar` do
 * `Chrome.jsx` do `sasi-design-system`, sem o view-switcher/login do mockup —
 * este app não tem essas duas coisas.
 *
 * `pr-14`: reserva o canto direito pro `BotaoTema` fixo do layout (z-20, por
 * cima deste header z-10) — sem a folga, o carimbo de hora fica embaixo do
 * botão em tela estreita.
 *
 * Server Component — nenhuma das 3 telas precisa de interatividade aqui.
 */
interface PropsTopBar {
    /** Rótulo da tela, já com o separador `·` embutido quando há subtítulo
     *  (ex.: "Captura · escolha o paciente"). */
    rotulo: string;
    /** Carimbo de hora, só a tela "Meu plantão" mostra. */
    carimbo?: string;
}

export function TopBar({rotulo, carimbo}: PropsTopBar) {
    return (
        <header className="sasi-chrome sticky top-0 z-10">
            <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 pr-14 sm:px-6 sm:pr-14">
                <div className="flex items-baseline gap-3">
                    <span className="text-md font-bold tracking-tight text-chrome-texto">SASI</span>
                    <span className="text-xs font-medium tracking-wide text-chrome-suave uppercase">
                        {rotulo}
                    </span>
                </div>
                {carimbo && (
                    <p data-clinical-number className="text-xs text-chrome-suave">
                        {carimbo}
                    </p>
                )}
            </div>
        </header>
    );
}

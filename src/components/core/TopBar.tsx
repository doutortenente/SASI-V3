/**
 * Barra do topo — casa única do cabeçalho que as 3 telas desenhavam cada uma
 * na sua própria página (`page.tsx`, `captura/page.tsx`, `fechamento/page.tsx`),
 * com o mesmo JSX copiado 3 vezes. É o `TopBar` do `Chrome.jsx` do
 * `sasi-design-system`, sem o view-switcher/login do mockup.
 *
 * BRANCA, não navy: só o rail lateral (`Sidebar`/`NavPrincipal`, `sasi-chrome`)
 * é navy — é a marca. A barra do topo usa os tokens `topbar-*` próprios
 * (brancos no Clinical, slate no Tactical).
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
    /** Carimbo de hora, só a rota raiz mostra. */
    carimbo?: string;
}

export function TopBar({rotulo, carimbo}: PropsTopBar) {
    return (
        <header className="sticky top-0 z-10 border-b border-topbar-borda bg-topbar-bg">
            <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 pr-14 sm:px-6 sm:pr-14">
                <div className="flex items-baseline gap-3">
                    <span className="text-md font-bold tracking-tight text-topbar-titulo">SASI</span>
                    <span className="text-xs font-medium tracking-wide text-topbar-eyebrow uppercase">
                        {rotulo}
                    </span>
                </div>
                {carimbo && (
                    <p data-clinical-number className="text-xs text-topbar-eyebrow">
                        {carimbo}
                    </p>
                )}
            </div>
        </header>
    );
}

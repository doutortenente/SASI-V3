/**
 * Rota /captura — REGISTRO À BEIRA DO LEITO. Ainda em construção.
 *
 * Esta página existe para a navegação não apontar para um 404: o `NavPrincipal`
 * já lista os 3 destinos e link quebrado numa barra de plantão é pior do que
 * uma página que diz a verdade.
 *
 * O que ela VAI fazer (bloco 2 desta entrega, contrato em
 * `docs/ARQUITETURA.md` § Tela 2): registrar janela de vital (Máx–Mín),
 * evento com valor e pendência — poucos toques, uma mão, no corredor.
 * Nada disso está implementado aqui; não fingir funcionalidade.
 */
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Captura' };

export default function CapturaPage() {
  return (
    <>
      {/* Mesma barra de comando das outras telas: navy nos dois temas, grudada
          no topo. `pr-14` reserva o canto direito para o BotaoTema fixo do layout. */}
      <header className="sasi-chrome sticky top-0 z-10">
        <div className="mx-auto flex max-w-[1600px] items-baseline gap-3 px-4 py-3 pr-14 sm:px-6 sm:pr-14">
          <span className="text-md font-bold tracking-tight text-chrome-texto">SASI</span>
          <span className="text-xs font-medium tracking-wide text-chrome-suave uppercase">
            Captura · beira do leito
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] p-4 sm:p-6">
        <section
          aria-label="Tela em construção"
          className="rounded-lg border border-borda-padrao bg-superficie-card p-6 shadow-card"
        >
          <p className="sasi-eyebrow">Em construção</p>
          <h1 className="text-lg font-semibold text-texto-titulo">
            Captura chega no bloco 2 desta entrega
          </h1>
          <p className="mt-2 max-w-prose text-sm text-texto-suave">
            Aqui será o registro à beira do leito: janela de sinal vital, evento clínico e
            pendência, em poucos toques e com uma mão. Por enquanto esta página não registra nada —
            o registro continua pelo fluxo atual.
          </p>
        </section>
      </main>
    </>
  );
}

/**
 * Rota /fechamento — EVOLUÇÃO E PASSAGEM DE PLANTÃO. Ainda em construção.
 *
 * Esta página existe para a navegação não apontar para um 404: o `NavPrincipal`
 * já lista os 3 destinos e link quebrado numa barra de plantão é pior do que
 * uma página que diz a verdade.
 *
 * O que ela VAI fazer (bloco 3 desta entrega, contrato em
 * `docs/ARQUITETURA.md` § Tela 3): ficha por sistemas, montagem determinística
 * da evolução no TEMPLATE-BASE v2 e passagem só dos pacientes do plantão, tudo
 * para revisar e copiar. Nada disso está implementado aqui; não fingir
 * funcionalidade.
 */
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Fechamento' };

export default function FechamentoPage() {
  return (
    <>
      {/* Mesma barra de comando das outras telas: navy nos dois temas, grudada
          no topo. `pr-14` reserva o canto direito para o BotaoTema fixo do layout. */}
      <header className="sasi-chrome sticky top-0 z-10">
        <div className="mx-auto flex max-w-[1600px] items-baseline gap-3 px-4 py-3 pr-14 sm:px-6 sm:pr-14">
          <span className="text-md font-bold tracking-tight text-chrome-texto">SASI</span>
          <span className="text-xs font-medium tracking-wide text-chrome-suave uppercase">
            Fechamento · fim do turno
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
            Fechamento chega no bloco 3 desta entrega
          </h1>
          <p className="mt-2 max-w-prose text-sm text-texto-suave">
            Aqui será o fim do turno: a ficha por sistemas, a evolução montada no template e a
            passagem de plantão dos seus pacientes, prontas para revisar e copiar. Por enquanto esta
            página não monta nada — a evolução continua pelo fluxo atual.
          </p>
        </section>
      </main>
    </>
  );
}

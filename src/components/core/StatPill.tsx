/**
 * Estatística inline do painel — o número grande do cabeçalho do War Room.
 *
 * Portado do `sasi-design-system` do v2 (`components/core/StatPill`).
 *
 * O cabeçalho antigo listava os números como texto corrido ("Críticos 3"), e
 * o olho tinha que ler para achar. Aqui o número domina a peça e o rótulo é
 * sobrancelha: dá para contar críticos sem ler nada.
 */
export type TomEstatistica = 'neutro' | 'critico' | 'instavel' | 'vigilancia' | 'estavel' | 'acento';

const TOM: Record<TomEstatistica, { valor: string; borda: string }> = {
  neutro: { valor: 'text-texto-titulo', borda: 'border-borda-padrao' },
  critico: { valor: 'text-gravidade-critico', borda: 'border-gravidade-critico/35' },
  instavel: { valor: 'text-gravidade-instavel', borda: 'border-gravidade-instavel/35' },
  vigilancia: { valor: 'text-gravidade-watcher', borda: 'border-gravidade-watcher/35' },
  estavel: { valor: 'text-gravidade-estavel', borda: 'border-gravidade-estavel/35' },
  acento: { valor: 'text-acento-texto', borda: 'border-acento/35' },
};

export function StatPill({
  valor,
  rotulo,
  tom = 'neutro',
}: {
  valor: React.ReactNode;
  rotulo: string;
  tom?: TomEstatistica;
}) {
  const t = TOM[tom];
  return (
    <div
      className={`bg-superficie-card shadow-card flex min-w-[104px] flex-col gap-0.5 rounded-lg border px-3 py-2 ${t.borda}`}
    >
      <span className="sasi-eyebrow">{rotulo}</span>
      <span data-clinical-number className={`text-xl leading-none font-semibold ${t.valor}`}>
        {valor}
      </span>
    </div>
  );
}

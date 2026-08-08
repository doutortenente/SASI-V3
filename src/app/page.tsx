/**
 * Rota raiz — War Room.
 *
 * Server Component: a consulta roda no servidor e o navegador recebe HTML pronto.
 * Nenhum cálculo clínico aqui — a triagem vem de `lib/clinical/sasi.ts`.
 *
 * `dynamic = 'force-dynamic'`: tela de comando não pode servir página guardada em
 * cache. Um leito que mudou de gravidade há 30 segundos tem que aparecer mudado.
 */
import { GradeDeLeitos } from '@/features/beds/components/GradeDeLeitos';
import { lerLeitosOcupados } from '@/features/beds/services/leitos';

export const dynamic = 'force-dynamic';

export default async function WarRoomPage() {
  const leitos = await lerLeitosOcupados();

  const criticos = leitos.filter((l) => l.acuidade === 'CRITICO').length;
  const instaveis = leitos.filter((l) => l.acuidade === 'INSTAVEL').length;
  const pendencias = leitos.reduce((s, l) => s + (l.pendencias_abertas ?? 0), 0);
  const divergencias = leitos.filter((l) => l.divergenciaDeSemaforo).length;

  return (
    <main className="mx-auto max-w-[1600px] p-4 sm:p-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">War Room</h1>
        <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 font-mono text-sm tabular-nums">
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">Ocupados</dt>
            <dd className="font-semibold">{leitos.length}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">Críticos</dt>
            <dd className="text-gravidade-critico font-semibold">{criticos}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">Instáveis</dt>
            <dd className="text-gravidade-instavel font-semibold">{instaveis}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">Pendências abertas</dt>
            <dd className="font-semibold">{pendencias}</dd>
          </div>
        </dl>

        {/* Aviso de qualidade de dado, não de estado clínico. */}
        {divergencias > 0 && (
          <p className="text-destructive mt-3 text-sm">
            {divergencias} leito(s) com semáforo gravado em desacordo com a gravidade. A tela mostra o
            valor derivado da gravidade e marca o card. O banco não foi alterado — a correção é sua.
          </p>
        )}
      </header>

      <GradeDeLeitos leitos={leitos} />
    </main>
  );
}

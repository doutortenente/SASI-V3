/**
 * Rota raiz — War Room.
 * Server Component: roda no servidor, busca dados direto do Supabase
 * antes de mandar HTML pronto pro navegador.
 */
export default function WarRoomPage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">SASI v3 — War Room</h1>
      <p className="text-muted-foreground mt-2">
        Esqueleto de pé. Próxima fase: grid de leitos alimentado por{' '}
        <code className="font-mono">vw_dashboard_uti</code>.
      </p>
    </main>
  );
}

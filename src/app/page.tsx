/**
 * Rota raiz — War Room.
 *
 * Server Component: a consulta roda no servidor e o navegador recebe HTML pronto.
 * Nenhum cálculo clínico aqui — a triagem vem de `lib/clinical/sasi.ts`.
 *
 * `dynamic = 'force-dynamic'`: tela de comando não pode servir página guardada em
 * cache. Um leito que mudou de gravidade há 30 segundos tem que aparecer mudado.
 */
import { StatPill } from '@/components/core/StatPill';
import { GradeDeLeitos } from '@/features/beds/components/GradeDeLeitos';
import { lerLeitosOcupados } from '@/features/beds/services/leitos';

export const dynamic = 'force-dynamic';

export default async function WarRoomPage() {
  const leitos = await lerLeitosOcupados();
  // Um relógio só para toda a grade, passado para baixo: os componentes ficam
  // puros e testáveis, e a idade das infusões é medida contra o mesmo instante.
  const agoraISO = new Date().toISOString();

  const criticos = leitos.filter((l) => l.acuidade === 'CRITICO').length;
  const instaveis = leitos.filter((l) => l.acuidade === 'INSTAVEL').length;
  const pendencias = leitos.reduce((s, l) => s + (l.pendencias_abertas ?? 0), 0);
  const divergencias = leitos.filter((l) => l.divergenciaDeSemaforo).length;

  const carimbo = new Date(agoraISO).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <>
      {/*
        Barra de comando — navy nos dois temas, porque é a marca e não o tema.
        Fica grudada no topo: rolando 33 leitos, a contagem de críticos não
        pode sair da tela.
      */}
      <header className="sasi-chrome sticky top-0 z-10">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-baseline gap-3">
            <span className="text-chrome-texto text-md font-bold tracking-tight">SASI</span>
            <span className="text-chrome-suave text-xs font-medium tracking-wide uppercase">
              War Room · UTI
            </span>
          </div>
          <p data-clinical-number className="text-chrome-suave text-xs">
            {carimbo}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] p-4 sm:p-6">
        <section aria-label="Resumo do plantão" className="mb-6">
          {/*
            A contagem é do PLANTÃO, não da unidade: o operador assume 6 a 12
            pacientes, não os 33 leitos do serviço. Uma tentativa de desenhar a
            planta inteira foi descartada por isso — leito que ele não assumiu
            não está "vago", está fora do sistema, e pintar de vago seria
            afirmar uma coisa que a tela não sabe.
          */}
          <dl className="flex flex-wrap gap-2">
            <StatPill rotulo="Pacientes" valor={leitos.length} />
            <StatPill rotulo="Críticos" valor={criticos} tom={criticos > 0 ? 'critico' : 'neutro'} />
            <StatPill rotulo="Instáveis" valor={instaveis} tom={instaveis > 0 ? 'instavel' : 'neutro'} />
            <StatPill
              rotulo="Pendências"
              valor={pendencias}
              tom={pendencias > 0 ? 'vigilancia' : 'neutro'}
            />
          </dl>

          {/* Aviso de qualidade de dado, não de estado clínico. */}
          {divergencias > 0 && (
            <p className="bg-gravidade-critico-bg text-gravidade-critico-text mt-3 rounded-md px-3 py-2 text-xs font-medium">
              {divergencias} leito(s) com semáforo gravado em desacordo com a gravidade. A tela mostra o
              valor derivado da gravidade e marca o card. O banco não foi alterado — a correção é sua.
            </p>
          )}
        </section>

        <GradeDeLeitos leitos={leitos} agoraISO={agoraISO} />
      </main>
    </>
  );
}

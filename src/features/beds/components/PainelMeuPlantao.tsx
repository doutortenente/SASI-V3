'use client';
/**
 * A ilha client do Meu plantão — filtros + dado ao vivo em cima da carga do servidor.
 *
 * DIVISÃO DE TRABALHO (contrato da Tela 1, `docs/ARQUITETURA.md`):
 * - O SERVIDOR carrega os leitos (`lerLeitosOcupados` em `app/page.tsx`) e os
 *   entrega prontos por prop, junto do relógio único `agoraISO`. Este
 *   componente NÃO refaz essa consulta.
 * - AQUI (navegador) mora o que muda durante o plantão sem recarregar a
 *   página: contagem de alertas (`useAlertas`, canal ao vivo em `alerts_log`),
 *   pendências (`usePendencias`, canal PRÓPRIO em `pendencias`) e dispositivos
 *   (`useDispositivos`, sem canal — cadência de ingestão). Cada um invalida só
 *   a própria query: atomicidade > acoplamento.
 * - Filtro é estado de UI → `bedStore` (Zustand); dado do banco → TanStack
 *   Query. Nunca misturar as duas casas.
 *
 * HONESTIDADE DE FALHA: leitura que falhou vira FAIXA DE AVISO, nunca lista
 * vazia — "nenhum alerta" e "não consegui perguntar" são clinicamente opostos.
 * Canal caído vira aviso de dado possivelmente velho.
 */
import { useAlertas } from '@/features/alerts/hooks/useAlertas';
import { useDispositivos } from '@/features/devices/hooks/useDispositivos';
import { usePendencias } from '@/features/pendencias/hooks/usePendencias';
import { useFiltroLeitos, useTemFiltroAtivo } from '@/stores/bedStore';
import { FiltroDeLeitos } from '@/features/beds/components/FiltroDeLeitos';
import { GradeDeLeitos } from '@/features/beds/components/GradeDeLeitos';
import { filtrarLeitos } from '@/features/beds/lib/filtrar';
import type { DadosVivosDoPlantao, LeitoNaGrade } from '@/features/beds/types';

/** Faixa de aviso de qualidade de dado — mesma linguagem do aviso de semáforo. */
function FaixaDeAviso({ children }: { children: React.ReactNode }) {
  return (
    <p className="bg-gravidade-critico-bg text-gravidade-critico-text mb-3 rounded-md px-3 py-2 text-xs font-medium">
      {children}
    </p>
  );
}

export function PainelMeuPlantao({
  leitos,
  agoraISO,
}: {
  /** Leitos já triados pelo servidor (mais grave primeiro). */
  leitos: LeitoNaGrade[];
  /** Relógio único da renderização, vindo do servidor. */
  agoraISO: string;
}) {
  const alertas = useAlertas();
  const pendencias = usePendencias();
  const dispositivos = useDispositivos();

  const filtro = useFiltroLeitos();
  const temFiltroAtivo = useTemFiltroAtivo();

  // "Só com alerta" precisa da resposta do banco; sem ela o critério não se
  // aplica (a barra desabilita o botão — ver `filtrarLeitos`).
  const alertasProntos = !alertas.carregando && alertas.erro === null;
  const pacientesComAlerta = alertasProntos
    ? new Set(alertas.alertas.map((a) => a.paciente_id))
    : undefined;

  const filtrados = filtrarLeitos(leitos, filtro, pacientesComAlerta);

  const vivos: DadosVivosDoPlantao = {
    alertasPorPaciente: alertas.porPaciente,
    pendenciasPorPaciente: pendencias.pendenciasPorPaciente,
    erroPendencias: pendencias.erro,
    dispositivosPorPaciente: dispositivos.dispositivosPorPaciente,
    erroDispositivos: dispositivos.erro,
  };

  return (
    <>
      <FiltroDeLeitos
        visiveis={filtrados.length}
        total={leitos.length}
        alertasProntos={alertasProntos}
      />

      {/* Falha de LEITURA nunca fica muda: o número que não chegou não é zero. */}
      {alertas.erro && (
        <FaixaDeAviso>
          Falha ao ler os alertas: os badges de alerta dos cards estão SEM DADO, não zerados.{' '}
          {alertas.erro.message}
        </FaixaDeAviso>
      )}
      {pendencias.erro && (
        <FaixaDeAviso>
          Falha ao ler as pendências ao vivo: os cards mostram o retrato da última carga da
          página. {pendencias.erro.message}
        </FaixaDeAviso>
      )}
      {dispositivos.erro && (
        <FaixaDeAviso>
          Falha ao ler os dispositivos: a lista de dias de uso está SEM DADO. {dispositivos.erro.message}
        </FaixaDeAviso>
      )}

      {/* Canal ao vivo caído: o dado pode estar velho e a tela tem que dizer. */}
      {(alertas.desatualizado || pendencias.desatualizado) && (
        <p className="bg-gravidade-watcher-bg text-gravidade-watcher-text mb-3 rounded-md px-3 py-2 text-xs font-medium">
          O canal ao vivo caiu ({[
            alertas.desatualizado ? 'alertas' : null,
            pendencias.desatualizado ? 'pendências' : null,
          ]
            .filter(Boolean)
            .join(' e ')}). Os números podem estar desatualizados até a conexão voltar.
        </p>
      )}

      <GradeDeLeitos
        leitos={filtrados}
        agoraISO={agoraISO}
        vivos={vivos}
        haFiltroAtivo={temFiltroAtivo}
      />
    </>
  );
}

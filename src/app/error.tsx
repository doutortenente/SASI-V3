'use client';
/**
 * Tela de falha do War Room.
 *
 * INCIDENTE REAL (v2): queda de rede aparecia como "nenhum sinal vital lançado".
 * O médico leu ausência de DADO onde havia ausência de CONEXÃO — coisas
 * clinicamente opostas ("não mediram" × "não sei").
 *
 * Por isso esta tela existe e diz a frase inteira: a falha é de LEITURA, e o
 * dado pode existir no banco. Nunca sugerir que o paciente não tem o dado.
 */
import { useEffect } from 'react';

export default function ErroDoWarRoom({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // console.log é erro de lint neste repo; console.error é o canal de falha.
    console.error('[SASI] falha ao carregar o War Room:', error);
  }, [error]);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="border-destructive bg-card rounded-xl border-2 p-6">
        <h1 className="text-destructive text-lg font-semibold">Não foi possível ler o painel de leitos</h1>

        <p className="mt-3 text-sm">
          Esta tela está <strong>sem dado para mostrar</strong>. Isto <strong>não</strong> significa que os
          leitos estão vazios nem que os pacientes estão sem registro — significa que a leitura do banco
          falhou. Não tire conclusão clínica desta tela.
        </p>

        <p className="text-muted-foreground mt-3 font-mono text-xs break-words">
          {error.message}
          {error.digest ? ` (referência: ${error.digest})` : ''}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="bg-primary text-primary-foreground focus-visible:ring-ring rounded-lg px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
          >
            Tentar ler de novo
          </button>
        </div>

        <p className="text-muted-foreground mt-4 text-xs">
          Enquanto isto não voltar, a fonte da verdade é o prontuário e a folha de enfermagem à beira do leito.
        </p>
      </div>
    </main>
  );
}

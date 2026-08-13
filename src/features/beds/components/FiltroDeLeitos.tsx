'use client';
/**
 * Barra de filtros da grade — compacta, acima dos leitos.
 *
 * A PERGUNTA (que UTI, que busca) mora no `bedStore` (Zustand, estado de UI);
 * a RESPOSTA é calculada por `filtrarLeitos` (função pura) sobre a lista que o
 * servidor entregou. Nada aqui consulta o banco.
 *
 * Mínimo pedido: UTI + busca. Entrou também "só com alerta" porque a contagem
 * já está na tela (useAlertas) e é a pergunta mais comum da ronda; o resto do
 * `FiltroLeitos` (gravidade, isolamento…) fica para quando tiver dono de UI.
 *
 * Alvos de toque ≥ 44px (min-h-11): celular, uma mão, corredor.
 */
import { Search, X } from 'lucide-react';
import { useState } from 'react';

import {
  OPCOES_UTI,
  ROTULO_UTI,
  useDefinirFiltro,
  useDefinirOpcaoUti,
  useFiltroLeitos,
  useLimparFiltros,
  useOpcaoUti,
  useTemFiltroAtivo,
} from '@/stores/bedStore';

export function FiltroDeLeitos({
  visiveis,
  total,
  alertasProntos,
}: {
  /** Quantos leitos passaram no filtro (para o "X de Y"). */
  visiveis: number;
  /** Quantos leitos o plantão tem ao todo. */
  total: number;
  /**
   * A contagem de alertas já respondeu? Sem ela o botão "só com alerta" fica
   * desabilitado: filtrar por um dado que não chegou seria afirmar "ninguém
   * tem alerta" sem fonte.
   */
  alertasProntos: boolean;
}) {
  const filtro = useFiltroLeitos();
  const definirFiltro = useDefinirFiltro();
  const opcaoUti = useOpcaoUti();
  const definirOpcaoUti = useDefinirOpcaoUti();
  const temFiltroAtivo = useTemFiltroAtivo();
  const limparFiltros = useLimparFiltros();

  // Estado local do texto: o store apara espaços e apaga busca vazia (regra do
  // remendo), então digitar "Silva " direto contra o store comeria o espaço no
  // meio da digitação. O input guarda o texto cru; o store, o filtro limpo.
  const [busca, setBusca] = useState(filtro.busca ?? '');

  const aoDigitar = (texto: string) => {
    setBusca(texto);
    definirFiltro({ busca: texto });
  };

  const aoLimpar = () => {
    limparFiltros();
    setBusca('');
  };

  const soComAlerta = filtro.somenteComAlerta === true;

  return (
    <section aria-label="Filtros da grade" className="mb-4 flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Filtrar por UTI" className="flex flex-wrap gap-1">
        {OPCOES_UTI.map((opcao) => {
          const ativa = opcaoUti === opcao;
          return (
            <button
              key={opcao}
              type="button"
              aria-pressed={ativa}
              onClick={() => definirOpcaoUti(opcao)}
              className={`min-h-11 rounded-md border px-3 text-xs font-medium transition-colors duration-(--dur-fast) ${
                ativa
                  ? 'border-acento/35 bg-acento-suave text-acento-texto font-semibold'
                  : 'border-borda-padrao bg-superficie-card text-texto-suave hover:text-texto-titulo'
              }`}
            >
              {ROTULO_UTI[opcao]}
            </button>
          );
        })}
      </div>

      <label className="relative min-w-40 flex-1 sm:max-w-64">
        <span className="sr-only">Buscar por nome ou leito</span>
        <Search
          aria-hidden
          size={14}
          className="text-texto-tenue pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
        />
        <input
          type="search"
          value={busca}
          onChange={(e) => aoDigitar(e.target.value)}
          placeholder="Nome ou leito"
          className="border-borda-padrao bg-superficie-card text-texto-corpo placeholder:text-texto-tenue focus-visible:ring-ring min-h-11 w-full rounded-md border pr-2.5 pl-8 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />
      </label>

      <button
        type="button"
        aria-pressed={soComAlerta}
        disabled={!alertasProntos}
        title={alertasProntos ? undefined : 'Aguardando a contagem de alertas do banco'}
        onClick={() => definirFiltro({ somenteComAlerta: soComAlerta ? undefined : true })}
        className={`min-h-11 rounded-md border px-3 text-xs font-medium transition-colors duration-(--dur-fast) disabled:opacity-50 ${
          soComAlerta
            ? 'border-acento/35 bg-acento-suave text-acento-texto font-semibold'
            : 'border-borda-padrao bg-superficie-card text-texto-suave hover:text-texto-titulo'
        }`}
      >
        Só com alerta
      </button>

      {temFiltroAtivo && (
        <button
          type="button"
          onClick={aoLimpar}
          className="text-texto-suave hover:text-texto-titulo flex min-h-11 items-center gap-1 rounded-md px-2 text-xs font-medium"
        >
          <X aria-hidden size={14} />
          Limpar
        </button>
      )}

      {/* Contagem medida do recorte — só aparece quando há recorte. */}
      {temFiltroAtivo && (
        <p aria-live="polite" data-clinical-number className="text-texto-suave text-xs">
          {visiveis} de {total} leitos
        </p>
      )}
    </section>
  );
}

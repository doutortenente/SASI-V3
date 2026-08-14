'use client';
/**
 * Providers — o "quadro de força" do app: tudo que precisa envolver TODAS as
 * telas de uma vez mora aqui, e o `layout.tsx` liga uma única chave.
 *
 * Hoje há um provedor só: o do TanStack Query (a biblioteca que guarda e
 * revalida dado vindo do banco). `useAlertas` documenta a exigência no
 * cabeçalho: "este hook exige um QueryClientProvider montado acima dele" —
 * medido em 08-ago-2026, o app não tinha nenhum. Este arquivo fecha esse furo.
 *
 * POR QUE O `QueryClient` NASCE DENTRO DE `useState`, E NÃO NO TOPO DO MÓDULO:
 * módulo é carregado UMA vez por processo. No servidor do Next, o mesmo
 * processo atende requisições de aberturas diferentes do app — um cache no
 * topo do módulo seria COMPARTILHADO entre elas, e dado de uma renderização
 * vazaria para a outra. Dentro de `useState` (com função, para criar uma vez
 * só e não a cada redesenho), cada montagem do app ganha o seu cache próprio.
 * É a recomendação oficial do TanStack Query para App Router.
 *
 * Estado de servidor = TanStack Query · estado de UI = Zustand (os stores de
 * `src/stores/` não precisam de provider — são importados direto).
 */
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {useState} from 'react';

export function Providers({children}: {children: React.ReactNode}) {
    // Sem defaultOptions globais de propósito: cada query define o próprio
    // staleTime junto de si (ex.: `useAlertas` usa 30s porque o canal ao vivo é
    // quem manda revalidar). Um padrão global aqui viraria configuração fantasma
    // que ninguém lembra de onde veio.
    const [queryClient] = useState(() => new QueryClient());

    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

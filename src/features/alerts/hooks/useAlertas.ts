'use client';
/**
 * Alertas abertos da UTI, ao vivo — contagem por leito para o badge do card e do cabeçalho.
 *
 * ## Por que os alertas têm CANAL PRÓPRIO, separado do canal dos pacientes
 *
 * Regra herdada do v2 (`src/hooks/useClinicalAlerts.ts`, hoje morto), citada do cabeçalho
 * original porque o motivo não estava escrito em nenhum outro lugar:
 *
 * > "alertas têm cadência distinta de pacientes. Acoplar no useSupabasePatients obrigaria
 * > re-renderizar a lista inteira quando só um badge mudou. Atomicidade > acoplamento."
 *
 * Traduzindo o termo de dev: **canal ao vivo** é a linha aberta pela qual o banco AVISA que
 * uma linha mudou (em vez de o navegador ficar perguntando de tempo em tempo). Um alerta
 * dispara muito mais vezes por plantão do que um paciente muda de leito. Se os dois viajassem
 * pelo mesmo canal, cada alerta novo mandaria a grade inteira de 33 leitos redesenhar só para
 * acender UM badge.
 *
 * Por isso: `alerts_log` tem a sua assinatura, com a sua chave de cache (`CHAVE_ALERTAS`).
 * Quem assina `pacientes` invalida `['pacientes']` e não encosta aqui — e vice-versa.
 *
 * ## O que mudou do v2 para cá
 *
 * O original recarregava a view inteira a cada evento (`event: '*'` -> `void load()`), com
 * `useState` na mão. Aqui o evento só marca a query como suja (`invalidateQueries`) e o
 * TanStack Query decide o resto: junta rajada de eventos num refetch só e não busca nada se
 * ninguém está com a tela aberta. Estado vindo do banco é TanStack Query, nunca Zustand.
 *
 * ## ARMADILHA — o canal pode ficar mudo SEM ERRO
 *
 * A assinatura respeita a RLS (o banco filtra linha a linha pelo dono). Se a linha não passa
 * pela RLS, o canal simplesmente não entrega nada: sem exceção, sem aviso no console.
 * Mesmo alerta está em `src/lib/supabase/realtime.ts`.
 *
 * Aqui isso é concreto: medido pela triagem em 08-ago-2026, as **14 linhas de `alerts_log`
 * têm `user_id` null** (a ingestão nunca preencheu — débito conhecido). Hoje passa, porque as
 * 11 policies `dev_bypass` (`using true`) estão ativas de propósito — uso solo, decisão do
 * operador registrada no `CLAUDE.md`. **Não remover a `dev_bypass`.**
 *
 * O risco é o inverso: aplicar `supabase/rollback/20260808_restaura_policies_de_dono.sql`
 * religa as policies de dono (`auth.uid() = user_id`), que com `user_id` null nunca são
 * verdadeiras — e o painel de alertas fica mudo em silêncio. Se um dia isso for aplicado,
 * preencher `alerts_log.user_id` ANTES, ou este hook para de atualizar sem ninguém perceber.
 *
 * ## Dependência que ainda não existe no app
 *
 * Este hook exige um `QueryClientProvider` montado acima dele. Medido em 08-ago-2026:
 * o app não tem nenhum — `@tanstack/react-query` está no `package.json` com ZERO uso em
 * `src/`. O hook está provado no teste ao lado, que monta o provider por conta própria; a
 * tela que for consumi-lo precisa do provider no `src/app/layout.tsx` primeiro.
 */
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useEffect, useState} from 'react';

import {exigirDado} from '@/lib/data/erros';
import {getSupabaseBrowser} from '@/lib/supabase/client';
import {assinarTabela} from '@/lib/supabase/realtime';
import type {Uti} from '@/types';

/**
 * Chave de cache desta query. Exportada de propósito: quem gravar um `ack` de alerta invalida
 * por esta constante, não por uma string solta que some no primeiro refactor.
 */
export const CHAVE_ALERTAS = ['alertas'] as const;

/** Contagem de alertas abertos de UM leito. Espelha a view `vw_alertas_abertos`. */
export interface AlertasDoLeito {
    paciente_id: string;
    leito: string;
    uti: Uti;
    nome: string | null;
    criticos: number;
    warnings: number;
    infos: number;
    total: number;
}

export interface RetornoUseAlertas {
    /** Uma linha por leito COM alerta aberto. Leito sem alerta não aparece na view. */
    alertas: AlertasDoLeito[];
    /** Busca direta por paciente, para o card não varrer a lista inteira. */
    porPaciente: Map<string, AlertasDoLeito>;
    totalCriticos: number;
    totalWarnings: number;
    carregando: boolean;
    /** Falha de LEITURA. Não é "nenhum alerta" — ver `FalhaDeLeitura` em `lib/data/erros.ts`. */
    erro: Error | null;
    /**
     * O canal ao vivo caiu. A tela precisa avisar que o número pode estar velho — alimenta a
     * prop `desatualizado` do `BedCard`.
     */
    desatualizado: boolean;
}

/**
 * Colunas pedidas uma a uma, como em `features/beds/services/leitos.ts`.
 * `select('*')` numa view de agregação é barato hoje, mas a view pode ganhar coluna e
 * ninguém revisa o que nunca foi escrito.
 */
const COLUNAS = [
    'paciente_id',
    'leito',
    'uti',
    'nome',
    'criticos',
    'warnings',
    'infos',
    'total',
].join(',');

/** Linha crua da view: o gerador de tipos marca TUDO como nullable porque é view. */
interface LinhaCrua {
    paciente_id: string | null;
    leito: string | null;
    uti: Uti | null;
    nome: string | null;
    criticos: number | null;
    warnings: number | null;
    infos: number | null;
    total: number | null;
}

/**
 * Lê a view das contagens de alerta aberto.
 *
 * Duas decisões sobre null, OPOSTAS de propósito:
 *
 * 1. **Identidade (`paciente_id`, `leito`, `uti`) null -> a linha é descartada.** Sem saber de
 *    quem é o alerta não há onde acender o badge. Mesmo tratamento de `lerLeitosOcupados`.
 * 2. **Contagem null -> 0.** Aqui o null NÃO é dado clínico faltando: `count()` do Postgres
 *    devolve 0, nunca null, para um grupo que existe. O null vem do gerador de tipos, que não
 *    declara NOT NULL em coluna de view. Se a linha existe, a contagem foi medida.
 *
 * Falha de leitura LANÇA (não vira lista vazia). "Nenhum alerta" e "não consegui perguntar"
 * são clinicamente opostos — o TanStack Query recolhe a exceção em `erro`.
 */
export async function lerAlertasAbertos(): Promise<AlertasDoLeito[]> {
    const supabase = getSupabaseBrowser();
    const resposta = await supabase.from('vw_alertas_abertos').select(COLUNAS);
    const linhas = exigirDado(resposta, 'vw_alertas_abertos (badge de alertas)');

    return (linhas as unknown as LinhaCrua[])
        .filter(
            (l): l is LinhaCrua & { paciente_id: string; leito: string; uti: Uti } =>
                l.paciente_id != null && l.leito != null && l.uti != null,
        )
        .map((l) => ({
            paciente_id: l.paciente_id,
            leito: l.leito,
            uti: l.uti,
            nome: l.nome,
            criticos: l.criticos ?? 0,
            warnings: l.warnings ?? 0,
            infos: l.infos ?? 0,
            total: l.total ?? 0,
        }));
}

/** Alertas abertos, mantidos vivos por uma assinatura só de `alerts_log`. */
export function useAlertas(): RetornoUseAlertas {
    const queryClient = useQueryClient();
    const [desatualizado, setDesatualizado] = useState(false);

    const consulta = useQuery({
        queryKey: CHAVE_ALERTAS,
        queryFn: lerAlertasAbertos,
        // O canal ao vivo é quem manda buscar de novo. O staleTime só evita refetch à toa quando
        // a aba volta ao foco ou o componente remonta — `invalidateQueries` fura ele.
        staleTime: 30_000,
    });

    useEffect(() => {
        const cancelar = assinarTabela({
            tabela: 'alerts_log',
            aoMudar: () => {
                // Só marca ESTA query como suja. A grade de leitos não é redesenhada:
                // é exatamente a "atomicidade > acoplamento" do cabeçalho.
                void queryClient.invalidateQueries({queryKey: CHAVE_ALERTAS});
                // Chegou evento = o canal está de pé de novo.
                setDesatualizado(false);
            },
            aoPerderConexao: () => setDesatualizado(true),
        });
        // Canal não fechado vaza conexão e o Supabase corta o projeto por excesso de canais.
        return cancelar;
    }, [queryClient]);

    const alertas = consulta.data ?? [];

    return {
        alertas,
        porPaciente: new Map(alertas.map((a) => [a.paciente_id, a])),
        totalCriticos: alertas.reduce((soma, a) => soma + a.criticos, 0),
        totalWarnings: alertas.reduce((soma, a) => soma + a.warnings, 0),
        carregando: consulta.isPending,
        erro: consulta.error,
        desatualizado,
    };
}

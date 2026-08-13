/**
 * Filtro da grade de leitos — função PURA, testável sem tela.
 *
 * A pergunta ("mostre a UTI3, busque por 'silva'") mora no `bedStore` (Zustand,
 * estado de UI). A resposta — quais leitos passam — é calculada aqui, fora do
 * componente, para o teste provar o comportamento sem montar React.
 *
 * Decisão importante: o critério `severidade` filtra pelo semáforo DERIVADO
 * (`leito.semaforo`, calculado da gravidade pela triagem), não pela coluna
 * `severidade_visual` do banco. Motivo medido em `lib/clinical/sasi.ts`: a
 * coluna pode estar em desacordo com a gravidade (6 pacientes no banco vivo em
 * 08-ago-2026), e filtrar pelo valor errado esconderia exatamente o paciente
 * que a tela marcou como divergente.
 */
import {passaFiltroUti} from '@/stores/bedStore';
import type {FiltroLeitos, LeitoNaGrade} from '@/features/beds/types';

/**
 * Busca sem acento e sem caixa: "joao" acha "JOÃO", "l03" acha "UTI3-L03".
 * NFD separa a letra do acento; a faixa U+0300–U+036F é só o acento, que sai.
 */
function normalizar(texto: string): string {
    return texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

/**
 * Aplica o filtro do `bedStore` à lista já triada.
 *
 * `pacientesComAlerta`: o conjunto de `paciente_id` com alerta aberto, vindo de
 * `useAlertas`. Quando `undefined` (contagem de alertas ainda sem resposta ou
 * com falha de leitura), o critério `somenteComAlerta` é IGNORADO em vez de
 * esconder a grade inteira: sem a resposta do banco, "não tem alerta" seria uma
 * afirmação inventada — a barra de filtros desabilita o botão nesse estado.
 */
export function filtrarLeitos(
    leitos: LeitoNaGrade[],
    filtro: FiltroLeitos,
    pacientesComAlerta?: ReadonlySet<string>,
): LeitoNaGrade[] {
    const busca = filtro.busca === undefined ? null : normalizar(filtro.busca);

    return leitos.filter((l) => {
        if (!passaFiltroUti(filtro.uti, l.uti)) return false;
        if (filtro.gravidade !== undefined && l.gravidade !== filtro.gravidade) return false;
        // Semáforo DERIVADO, nunca a coluna do banco — ver cabeçalho.
        if (filtro.severidade !== undefined && l.semaforo !== filtro.severidade) return false;
        if (filtro.isolamento !== undefined && l.isolation !== filtro.isolamento) return false;
        if (filtro.status !== undefined && l.status_leito !== filtro.status) return false;
        if (busca !== null) {
            const alvo = normalizar(`${l.nome ?? ''} ${l.leito ?? ''}`);
            if (!alvo.includes(busca)) return false;
        }
        if (filtro.somenteComAlerta === true && pacientesComAlerta !== undefined) {
            if (!pacientesComAlerta.has(l.paciente_id)) return false;
        }
        return true;
    });
}

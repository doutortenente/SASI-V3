/**
 * Relógio do plantão — a janela padrão da Captura, derivada NO SERVIDOR.
 *
 * ---------------------------------------------------------------------------
 * POR QUE O FUSO É FIXO EM America/Sao_Paulo E NÃO NO RELÓGIO DO APARELHO
 * ---------------------------------------------------------------------------
 * A granularidade de tempo do SASI é o plantão (regra do `CLAUDE.md`): diurno
 * 07h–19h, noturno 19h–07h, no horário DO HOSPITAL. O relógio do celular pode
 * estar em outro fuso (viagem, ajuste manual) — e uma janela de 24h gravada
 * com o fuso errado cairia em OUTRA chave única (`paciente+tipo+janela_fim`)
 * e viraria uma segunda verdade na nota. Por isso tudo aqui converte por
 * `Intl` com o fuso explícito, nunca pelo relógio local do runtime.
 *
 * Funções PURAS (recebem o instante, devolvem valores), com teste ao lado —
 * mesma doutrina de `src/lib/clinical/`: conta de data não se faz no
 * componente.
 */

const FUSO_PLANTAO = 'America/Sao_Paulo';

/** O relógio de parede em São Paulo num dado instante. */
interface ParedeSP {
    ano: number;
    mes: number;
    dia: number;
    hora: number;
    minuto: number;
    segundo: number;
}

function paredeEmSaoPaulo(instante: Date): ParedeSP {
    const partes = new Intl.DateTimeFormat('en-CA', {
        timeZone: FUSO_PLANTAO,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(instante);
    const pega = (tipo: Intl.DateTimeFormatPartTypes) =>
        Number(partes.find((p) => p.type === tipo)?.value ?? Number.NaN);
    return {
        ano: pega('year'),
        mes: pega('month'),
        dia: pega('day'),
        // `hourCycle` de alguns runtimes devolve "24" à meia-noite — o módulo
        // normaliza para 0..23 em vez de confiar no formato.
        hora: pega('hour') % 24,
        minuto: pega('minute'),
        segundo: pega('second'),
    };
}

/**
 * O INSTANTE (UTC) em que o relógio de parede de São Paulo marca a data/hora
 * pedida. `Date.UTC` normaliza estouro de campo (dia 32 vira o mês seguinte),
 * o que deixa a aritmética de "ontem/amanhã" segura na virada de mês e de ano.
 *
 * Duas iterações porque o deslocamento do fuso só é conhecido DEPOIS de chutar
 * um instante — na segunda passada o chute converge (vale até para mudança de
 * horário de verão, se um dia ele voltar).
 */
function instanteDaParedeSP(ano: number, mes: number, dia: number, hora: number, minuto = 0): Date {
    const alvoComoUTC = Date.UTC(ano, mes - 1, dia, hora, minuto, 0, 0);
    let instante = alvoComoUTC;
    for (let i = 0; i < 2; i++) {
        const p = paredeEmSaoPaulo(new Date(instante));
        const obtidoComoUTC = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
        instante += alvoComoUTC - obtidoComoUTC;
    }
    return new Date(instante);
}

export type TurnoDePlantao = 'diurno' | 'noturno';

/** A janela de plantão corrente, pronta para virar `janela_inicio`/`janela_fim`. */
export interface JanelaDePlantao {
    turno: TurnoDePlantao;
    /** Início da janela, ISO em UTC. */
    inicioISO: string;
    /** Fim da janela, ISO em UTC — parte da chave única de `janelas_24h`. */
    fimISO: string;
    /** Texto humano: "Plantão diurno · 07h às 19h de 13/08". Sem seta — regra da casa. */
    rotulo: string;
}

/**
 * A janela do plantão CORRENTE no instante dado.
 *
 * Regra (contrato da Tela 2): 07h–19h é diurno; 19h–07h é noturno, e a
 * madrugada (antes das 07h) pertence ao plantão noturno INICIADO NA VÉSPERA —
 * a mesma regra dos dois relógios de `fn_evolucao_relogios` no banco.
 */
export function derivarJanelaDePlantao(agora: Date): JanelaDePlantao {
    const p = paredeEmSaoPaulo(agora);
    const diurno = p.hora >= 7 && p.hora < 19;

    let inicio: Date;
    let fim: Date;
    if (diurno) {
        inicio = instanteDaParedeSP(p.ano, p.mes, p.dia, 7);
        fim = instanteDaParedeSP(p.ano, p.mes, p.dia, 19);
    } else if (p.hora >= 19) {
        inicio = instanteDaParedeSP(p.ano, p.mes, p.dia, 19);
        fim = instanteDaParedeSP(p.ano, p.mes, p.dia + 1, 7);
    } else {
        // Madrugada: o plantão noturno começou ONTEM às 19h.
        inicio = instanteDaParedeSP(p.ano, p.mes, p.dia - 1, 19);
        fim = instanteDaParedeSP(p.ano, p.mes, p.dia, 7);
    }

    // O rótulo carrega o dia do INÍCIO: o plantão noturno "de 12/08" continua
    // sendo de 12/08 depois da meia-noite.
    const pi = paredeEmSaoPaulo(inicio);
    const dd = String(pi.dia).padStart(2, '0');
    const mm = String(pi.mes).padStart(2, '0');
    const rotulo = diurno
        ? `Plantão diurno · 07h às 19h de ${dd}/${mm}`
        : `Plantão noturno · 19h de ${dd}/${mm} às 07h`;

    return {
        turno: diurno ? 'diurno' : 'noturno',
        inicioISO: inicio.toISOString(),
        fimISO: fim.toISOString(),
        rotulo,
    };
}

/**
 * Um instante ISO no formato que o `<input type="datetime-local">` consome
 * ("YYYY-MM-DDTHH:mm"), no relógio de São Paulo. ISO inválido devolve '' —
 * o campo fica vazio em vez de mostrar data inventada.
 */
export function datetimeLocalEmSaoPaulo(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const p = paredeEmSaoPaulo(d);
    const dois = (n: number) => String(n).padStart(2, '0');
    return `${p.ano}-${dois(p.mes)}-${dois(p.dia)}T${dois(p.hora)}:${dois(p.minuto)}`;
}

/**
 * O caminho de volta: o valor do `<input type="datetime-local">` (lido como
 * relógio de parede de São Paulo) vira ISO UTC para o campo `ts` do banco.
 *
 * Devolve `null` quando o texto não é uma data/hora real — quem chama mostra
 * o erro e NÃO grava (ts é obrigatório em `eventos_clinicos`; hora inventada
 * mentiria a cronologia que o motor de tendência lê).
 */
export function isoDeDatetimeLocalSaoPaulo(valor: string): string | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(valor.trim());
    if (!m) return null;
    const [ano, mes, dia, hora, minuto] = m.slice(1).map(Number) as [
        number,
        number,
        number,
        number,
        number,
    ];
    const instante = instanteDaParedeSP(ano, mes, dia, hora, minuto);
    // Confere o caminho de volta: se o instante encontrado não marca exatamente
    // o que foi digitado (mês 13, dia 32, hora 25…), a entrada era inválida.
    const p = paredeEmSaoPaulo(instante);
    if (p.ano !== ano || p.mes !== mes || p.dia !== dia || p.hora !== hora || p.minuto !== minuto) {
        return null;
    }
    return instante.toISOString();
}

/**
 * "13/08 19h" — data e hora curtas no relógio de São Paulo, para a lista de
 * janelas já registradas. ISO inválido/ausente devolve `null` (a tela mostra
 * travessão via `txt`, nunca texto inventado).
 */
export function dataHoraCurtaEmSaoPaulo(iso: string | null | undefined): string | null {
    if (iso == null) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const p = paredeEmSaoPaulo(d);
    const dois = (n: number) => String(n).padStart(2, '0');
    const minutos = p.minuto === 0 ? '' : dois(p.minuto);
    return `${dois(p.dia)}/${dois(p.mes)} ${dois(p.hora)}h${minutos}`;
}

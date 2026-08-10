/**
 * Formatação de texto clínico — casa ÚNICA. Não redeclarar em componente.
 *
 * No v2 o travessão de "sem dado" estava declarado em 8 módulos e os helpers de
 * rótulo em 3 a 5 cópias cada. A deriva entre as cópias causou 3 defeitos reais:
 * dose que sumia da passagem, "µg" cru na tela e alergia sem destaque no índice.
 * Por isso aqui é o único lugar.
 */
import type {InfusaoOuTexto, SeveridadeVisual, Uti} from '@/types';

/**
 * O que a tela mostra quando o dado NÃO EXISTE.
 *
 * Nunca 0, nunca "N/A", nunca vazio: dado clínico ausente é ausente, e precisa
 * parecer ausente. Zero é um valor — dizer "PAM 0" quando ninguém mediu a PAM é
 * inventar dado, o que em prontuário é falsificação documental.
 */
export const SEM_DADO = '—';

/** Valor para a tela: número/texto quando existe, travessão quando não existe. */
export function txt(valor: string | number | null | undefined): string {
    if (valor === null || valor === undefined) return SEM_DADO;
    if (typeof valor === 'number' && !Number.isFinite(valor)) return SEM_DADO;
    const s = String(valor).trim();
    return s === '' ? SEM_DADO : s;
}

/** Número com vírgula decimal (padrão pt-BR). Ausente continua ausente. */
export function num(valor: number | null | undefined, casas = 0): string {
    if (valor === null || valor === undefined || !Number.isFinite(valor)) return SEM_DADO;
    return valor.toLocaleString('pt-BR', {minimumFractionDigits: casas, maximumFractionDigits: casas});
}

/**
 * INCIDENTE REAL: "µ" digitado em maiúscula vira "Μ" (mi grego, U+039C) e a
 * noradrenalina foi lida MIL VEZES maior do que a dose real.
 *
 * Normaliza toda variante de micro para a forma segura escrita em letra —
 * "mcg" —, que não tem gêmeo visual em nenhum alfabeto.
 *
 * Trata: U+00B5 (micro), U+03BC (mi minúsculo), U+039C (Mi MAIÚSCULO, o culpado),
 * e o "u" que gente digita quando não acha o µ no teclado.
 */
export function unidadeSegura(unidade: string | null | undefined): string {
    if (!unidade) return SEM_DADO;
    return unidade
        .replace(/[µμΜ]g/g, 'mcg')
        .replace(/\bug\b/g, 'mcg')
        .replace(/[µμΜ]/g, 'mcg')
        .trim();
}

/** Sinal vital no formato canônico Máx–Mín. SpO2 inclusa: "98–89%", nunca "89–98". */
export function maxMin(
    max: number | string | null | undefined,
    min: number | string | null | undefined,
    sufixo = '',
): string {
    const a = txt(max);
    const b = txt(min);
    if (a === SEM_DADO && b === SEM_DADO) return SEM_DADO;
    return `${a}–${b}${sufixo}`;
}

/** Só o número do leito, para o card não repetir a UTI que já está no cabeçalho. */
export function numeroDoLeito(leito: string): string {
    return /-(L\d{2})$/.exec(leito)?.[1] ?? leito;
}

/** Rótulo curto da UTI com a contagem de leitos que ela tem de verdade. */
export const LEITOS_POR_UTI: Record<Uti, number> = {UTI2: 12, UTI3: 13, UTI4: 8};

/**
 * Descrição de uma infusão contínua para a tela.
 *
 * Aceita as DUAS formas que o banco tem (ver `InfusaoOuTexto`): texto puro
 * ("Dobutamina 5 ml/h", herança do v2, o que está no banco hoje) e o objeto
 * rico que a ingestão grava. Tratar só o objeto fazia a tela descartar em
 * silêncio toda droga vasoativa.
 *
 * A dose NUNCA é omitida quando existe (defeito real do v2: dose numérica
 * desaparecia da passagem de plantão). Quando não existe, mostra o travessão —
 * não some, não vira "dose habitual", não é estimada.
 */
export function rotuloInfusao(inf: InfusaoOuTexto): string {
    // Forma texto: passa adiante como está, só normalizando a unidade insegura.
    // Não tentar extrair droga/dose por expressão regular: "Noradrenalina
    // suspensa" não tem dose, e adivinhar aqui seria inventar dado clínico.
    if (typeof inf === 'string') return unidadeSegura(inf.trim()) || SEM_DADO;

    const droga = txt(inf.droga);
    if (inf.vazao_mcg_h != null) return `${droga} ${num(inf.vazao_mcg_h)} mcg/h`;
    if (inf.vazao_mg_h != null) return `${droga} ${num(inf.vazao_mg_h, 1)} mg/h`;
    if (inf.vazao_ml_h != null) return `${droga} ${num(inf.vazao_ml_h, 1)} mL/h`;
    if (inf.dose != null && String(inf.dose).trim() !== '') {
        const u = inf.unidade ? ` ${unidadeSegura(inf.unidade)}` : '';
        return `${droga} ${txt(inf.dose)}${u}`;
    }
    return `${droga} ${SEM_DADO}`;
}

/**
 * Data curta de quando o dado foi lançado, com a idade em dias.
 *
 * Existe porque droga vasoativa sem data mente por omissão: "Noradrenalina
 * 0,3" numa tela de comando é lido como "está correndo AGORA". Se a última
 * evolução é de 7 dias atrás, é história, não conduta atual.
 *
 * `agoraISO` entra por parâmetro para a função ser pura e testável.
 */
export function dataComIdade(iso: string | null | undefined, agoraISO: string): string {
    if (!iso) return SEM_DADO;
    const t = new Date(iso).getTime();
    const agora = new Date(agoraISO).getTime();
    if (!Number.isFinite(t) || !Number.isFinite(agora)) return SEM_DADO;

    const dia = new Date(iso).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'});
    const dias = Math.floor((agora - t) / 86_400_000);
    if (dias <= 0) return `${dia} (hoje)`;
    if (dias === 1) return `${dia} (ontem)`;
    return `${dia} (há ${dias} dias)`;
}

/** Classe de cor do semáforo. Token do tema — jamais hex em componente. */
export const CLASSE_SEMAFORO: Record<SeveridadeVisual, string> = {
    red: 'bg-semaforo-red',
    yellow: 'bg-semaforo-yellow',
    green: 'bg-semaforo-green',
};

/**
 * Direção de tendência em PALAVRA, nunca em seta.
 *
 * Seta ↑ ↓ é proibida em texto clínico (doutrina do repo): em folha impressa,
 * fotocópia e leitor de tela a seta se perde ou se inverte. A palavra não.
 */
export function direcao(delta: number | null | undefined, sobe = 'subindo', desce = 'em queda'): string {
    if (delta === null || delta === undefined || !Number.isFinite(delta)) return SEM_DADO;
    if (delta === 0) return 'estável';
    return delta > 0 ? sobe : desce;
}

import 'server-only';
/**
 * Leitura do folhão de laboratório — `eventos_clinicos` filtrado pelos
 * códigos de `CODIGOS_DE_LAB`, para UM paciente.
 */
import {exigirDado} from '@/lib/data/erros';
import {getSupabaseServer} from '@/lib/supabase/server';
import {
    CODIGOS_DE_LAB,
    type EventoDeLab,
    type FolhaoDeLabs,
    montarFolhaoDeLabs
} from '@/features/pacientes/lib/labs';

export async function lerFolhaoDeLabs(pacienteId: string): Promise<FolhaoDeLabs> {
    const supabase = await getSupabaseServer();
    const codigos = CODIGOS_DE_LAB.map((c) => c.codigo);

    const resposta = await supabase
        .from('eventos_clinicos')
        .select('tipo,valor_num,ts')
        .eq('paciente_id', pacienteId)
        .in('tipo', codigos)
        .order('ts', {ascending: true});

    const linhas = exigirDado(resposta, 'eventos_clinicos (folhão de labs)');

    const eventos: EventoDeLab[] = (linhas as {tipo: string; valor_num: number | null; ts: string}[])
        .filter((l): l is {tipo: string; valor_num: number; ts: string} => l.valor_num !== null)
        .map((l) => ({tipo: l.tipo, valor: l.valor_num, dia: l.ts.slice(0, 10)}));

    return montarFolhaoDeLabs(eventos);
}

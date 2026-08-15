'use client';
/**
 * Ilha client da ficha do paciente (`/pacientes/[pacienteId]`) — mesma
 * doutrina do `PainelMeuPlantao`: hooks ao vivo de `pendencias` e
 * `dispositivos` (unidade inteira), indexados para UM paciente aqui, sem
 * recriar consulta. Alertas já são per-paciente dentro do `DetalheDoLeito`.
 */
import {useDispositivos} from '@/features/devices/hooks/useDispositivos';
import {usePendencias} from '@/features/pendencias/hooks/usePendencias';
import {DetalheDoLeito} from '@/features/beds/components/DetalheDoLeito';

export function PainelDoPaciente({
    pacienteId,
    deltaSofa24h,
    outOfRangeCount,
    agoraISO,
}: {
    pacienteId: string;
    deltaSofa24h: number | null;
    outOfRangeCount: number | null;
    agoraISO: string;
}) {
    const pendencias = usePendencias();
    const dispositivos = useDispositivos();

    return (
        <DetalheDoLeito
            pacienteId={pacienteId}
            deltaSofa24h={deltaSofa24h}
            outOfRangeCount={outOfRangeCount}
            agoraISO={agoraISO}
            pendencias={pendencias.pendenciasPorPaciente?.[pacienteId]}
            erroPendencias={pendencias.erro}
            dispositivos={dispositivos.dispositivosPorPaciente?.[pacienteId]}
            erroDispositivos={dispositivos.erro}
        />
    );
}

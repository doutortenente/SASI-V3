/**
 * Grade de laboratório — uma linha por exame, uma coluna por dia, agrupada
 * por seção. A tela "Paciente · Folhão" do pacote de design, com dado real
 * de `eventos_clinicos`. Server Component — o dado já chega pronto por prop.
 */
import {Fragment} from 'react';

import {num} from '@/lib/formatters/br';
import type {FolhaoDeLabs as TipoFolhao} from '@/features/pacientes/lib/labs';

function rotuloDoDia(dia: string): string {
    return new Date(`${dia}T00:00:00`).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'});
}

export function FolhaoDeLabs({folhao}: {folhao: TipoFolhao}) {
    if (folhao.secoes.length === 0) {
        return (
            <p className="p-3.5 text-xs text-texto-tenue">
                Nenhum exame de laboratório lançado para este paciente.
            </p>
        );
    }

    return (
        <div className="p-3.5">
            <div className="overflow-x-auto rounded-lg border border-borda-padrao">
                <table className="w-full min-w-max border-collapse text-xs">
                    <thead>
                        <tr>
                            <th className="sasi-eyebrow sticky left-0 z-[1] min-w-44 bg-superficie-card px-3 py-2 text-left">
                                Exame
                            </th>
                            {folhao.dias.map((dia) => (
                                <th
                                    key={dia}
                                    data-clinical-number
                                    className="border-l border-borda-sutil px-3 py-2 text-right text-2xs font-semibold text-texto-suave"
                                >
                                    {rotuloDoDia(dia)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {folhao.secoes.map((secao) => (
                            <Fragment key={secao.categoria}>
                                <tr>
                                    <td
                                        colSpan={folhao.dias.length + 1}
                                        className="sasi-eyebrow border-t border-borda-sutil bg-superficie-elevada px-3 py-1.5"
                                    >
                                        {secao.titulo}
                                    </td>
                                </tr>
                                {secao.linhas.map((linha) => (
                                    <tr key={linha.codigo} className="border-t border-borda-sutil">
                                        <td className="sticky left-0 z-[1] bg-superficie-card px-3 py-1.5 font-medium whitespace-nowrap text-texto-corpo">
                                            {linha.rotulo}
                                            {linha.unidade && (
                                                <span className="text-texto-tenue"> ({linha.unidade})</span>
                                            )}
                                        </td>
                                        {folhao.dias.map((dia) => {
                                            const valores = linha.porDia[dia];
                                            return (
                                                <td
                                                    key={dia}
                                                    data-clinical-number
                                                    className="border-l border-borda-sutil px-3 py-1.5 text-right text-texto-corpo"
                                                >
                                                    {valores ? valores.map((v) => num(v)).join(' / ') : num(null)}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="mt-2 text-2xs text-texto-tenue">
                — não coletado nesse dia (o valor do dia anterior nunca é repetido). Mais de uma coleta no
                mesmo dia aparece separada por &quot;/&quot;.
            </p>
        </div>
    );
}

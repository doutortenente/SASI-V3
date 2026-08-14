'use client';
/**
 * Copiar texto para a área de transferência — o gesto que fecha o turno.
 *
 * A missão do V4 é matar o papel: o texto montado aqui precisa chegar ao
 * prontuário do hospital, que é outro sistema. O caminho é copiar e colar, e
 * por isso este botão é a peça mais usada da tela.
 *
 * DUAS COISAS QUE ELE NÃO FAZ:
 * 1. Não some com o resultado. "Copiado" fica visível por alguns segundos —
 *    quem colou no lugar errado precisa saber que a cópia aconteceu.
 * 2. Não mente quando falha. `navigator.clipboard` exige contexto seguro
 *    (https ou localhost) e pode ser negado pelo navegador; nesse caso a
 *    mensagem diz para selecionar e copiar à mão, em vez de fingir sucesso —
 *    achar que copiou e colar o texto anterior no prontuário é o estrago real.
 */
import {Check, Copy} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';

type Estado = 'ocioso' | 'copiado' | 'falhou';

export function BotaoCopiar({
    texto,
    rotulo = 'Copiar',
    /** `destaque` = ação principal da tela (fundo de acento). */
    variante = 'discreta',
    className = '',
}: {
    texto: string;
    rotulo?: string;
    variante?: 'destaque' | 'discreta';
    className?: string;
}) {
    const [estado, setEstado] = useState<Estado>('ocioso');
    const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Timer não limpo continua batendo depois que o componente sai da tela e
    // tenta escrever em estado morto — vazamento clássico de React.
    useEffect(() => {
        return () => {
            if (relogio.current !== null) clearTimeout(relogio.current);
        };
    }, []);

    function marcar(novo: Estado) {
        setEstado(novo);
        if (relogio.current !== null) clearTimeout(relogio.current);
        relogio.current = setTimeout(() => setEstado('ocioso'), 6000);
    }

    async function copiar() {
        try {
            await navigator.clipboard.writeText(texto);
            marcar('copiado');
        } catch (erro) {
            // console.log é erro de lint neste repo; console.error é o canal de falha.
            console.error('[SASI] falha ao copiar para a área de transferência:', erro);
            marcar('falhou');
        }
    }

    const classeBase =
        variante === 'destaque'
            ? 'bg-acento text-(--texto-sobre-acento) hover:bg-(--acento-hover)'
            : 'border-borda-padrao text-texto-corpo hover:bg-superficie-elevada border';

    return (
        <span className={`inline-flex flex-col gap-1 ${className}`}>
            <button
                type="button"
                onClick={() => void copiar()}
                className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-semibold ${classeBase}`}
            >
                {estado === 'copiado' ? <Check aria-hidden size={16} /> : <Copy aria-hidden size={16} />}
                {estado === 'copiado' ? 'Copiado' : rotulo}
            </button>

            {/* `role="status"` avisa leitor de tela sem roubar o foco. */}
            {estado === 'copiado' && (
                <span role="status" className="text-2xs font-medium text-gravidade-estavel">
                    Copiado — cole no prontuário e revise antes de assinar.
                </span>
            )}
            {estado === 'falhou' && (
                <span role="alert" className="text-2xs font-medium text-gravidade-critico">
                    O navegador NÃO deixou copiar. Nada foi para a área de transferência — selecione o texto e
                    copie à mão.
                </span>
            )}
        </span>
    );
}

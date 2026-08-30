import {createServerClient} from '@supabase/ssr';
import {NextResponse, type NextRequest} from 'next/server';

import {SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL} from '@/lib/supabase/config';

/**
 * Sessão sem tela de login.
 *
 * POR QUE ISTO EXISTE. Até 30-ago-2026 o banco tinha uma policy `dev_bypass`
 * (`FOR ALL TO public USING (true)`) em 15 tabelas: a RLS estava ligada mas
 * liberava tudo, e o app funcionava sem sessão porque o role `anon` enxergava
 * o banco inteiro. Como a chave publicável vai no bundle do navegador, isso
 * valia para qualquer pessoa da internet, não só para este app. A policy caiu;
 * agora cada linha só aparece para o dono (`user_id = auth.uid()`).
 *
 * A DECISÃO DE PRODUTO CONTINUA A MESMA: uso solo, sem tela de login — ninguém
 * digita senha à beira do leito. O que muda é ONDE a credencial mora. Ela sai
 * do navegador e passa a viver só no ambiente do servidor (`SASI_SESSAO_*`,
 * sem `NEXT_PUBLIC_`): o proxy abre a sessão, devolve o cookie pronto e o
 * navegador recebe uma sessão válida sem nunca ver e-mail nem senha.
 *
 * O QUE PROTEGE O QUÊ, para não haver ilusão:
 * - a chave publicável, sozinha, não abre mais nada — a RLS barra;
 * - quem alcança o app publicado ganha sessão automática. Quem guarda a porta
 *   é a proteção de deployment da Vercel. Domínio próprio sem essa proteção
 *   ligada volta a ser porta aberta.
 *
 * FALHA FECHADA: sem as variáveis de ambiente não há sessão, e a RLS não
 * devolve linha nenhuma. Tela vazia é o sintoma correto — nunca dado exposto.
 */
export async function manterSessao(request: NextRequest) {
    let resposta = NextResponse.next({request});

    const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        cookies: {
            getAll: () => request.cookies.getAll(),
            setAll: (lista) => {
                lista.forEach(({name, value}) => request.cookies.set(name, value));
                resposta = NextResponse.next({request});
                lista.forEach(({name, value, options}) => resposta.cookies.set(name, value, options));
            },
        },
    });

    // Nada de código entre createServerClient e getClaims(): é ele que valida e,
    // quando o token está vencendo, RENOVA — e o cookie novo sai pelo setAll acima.
    // Mexer nessa ordem é a receita clássica de "o app desloga sozinho às vezes".
    const {data} = await supabase.auth.getClaims();
    if (data?.claims) return resposta;

    const email = process.env.SASI_SESSAO_EMAIL;
    const senha = process.env.SASI_SESSAO_SENHA;

    if (!email || !senha) {
        console.error(
            '[sasi] SASI_SESSAO_EMAIL/SASI_SESSAO_SENHA ausentes no ambiente do servidor: ' +
                'o app abre sem sessão e a RLS não devolve nenhuma linha.',
        );
        return resposta;
    }

    const {error} = await supabase.auth.signInWithPassword({email, password: senha});

    if (error) {
        // Mensagem do Supabase, nunca a credencial.
        console.error('[sasi] sessão automática falhou:', error.message);
    }

    return resposta;
}

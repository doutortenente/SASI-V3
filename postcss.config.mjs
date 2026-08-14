/**
 * Tailwind CSS 4 é um plugin de PostCSS — não existe mais `tailwind.config.ts`.
 * Toda a configuração de tema (cores, fontes, espaçamento) mora no CSS,
 * dentro do bloco `@theme` em src/styles/globals.css.
 */
const config = {
    plugins: {
        '@tailwindcss/postcss': {},
    },
};

export default config;

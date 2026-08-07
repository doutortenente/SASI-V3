// ESLint 10, "flat config": um array de blocos, lido de cima pra baixo.
// Lint = corretor automático de estilo e de erro bobo, antes de rodar o código.
// eslint-config-next 16 já exporta flat config nativo — sem adaptador de compatibilidade.
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Nada aqui é código nosso: build, dependência e material de referência.
    ignores: [
      '.next/**',
      'node_modules/**',
      '_material/**',
      'next-env.d.ts',
      'src/types/supabase.ts', // gerado pelo Supabase — não editar na mão
      'src/components/ui/**', // gerado pelo shadcn/ui
    ],
  },

  ...nextCoreWebVitals,
  ...nextTypescript,

  {
    rules: {
      // Variável não usada vira erro, MENOS quando prefixada com _ (descarte intencional).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // `any` desliga a checagem de tipo. Em dado clínico isso é prescrição em branco.
      '@typescript-eslint/no-explicit-any': 'error',
      // Import de tipo separado do import de valor (exigido por verbatimModuleSyntax).
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      // console.log esquecido em produção vaza dado de paciente pro navegador.
      'no-console': ['error', { allow: ['warn', 'error'] }],
      // `x != null` é permitido: é o idiom que pega null E undefined de uma vez.
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },

  {
    // Teste pode ser mais frouxo: mock exige any de vez em quando.
    files: ['tests/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },

  // Sempre por último: desliga regras de estilo que brigariam com o Prettier.
  prettier,
);

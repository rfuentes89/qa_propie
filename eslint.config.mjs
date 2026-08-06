import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';
import prettier from 'eslint-config-prettier';

/**
 * Config de ESLint (flat config, formato de ESLint 9+).
 *
 * El orden importa: `prettier` va último para apagar las reglas de estilo que
 * chocan con el formateador. ESLint acá se ocupa de correccion, no de formato.
 */
export default tseslint.config(
  {
    ignores: [
      'node_modules',
      'playwright-report',
      'test-results',
      'results',
      '.auth',
      '.playwright-mcp',
      'docs',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // La regla que más rinde en un repo Playwright: un `await` olvidado en un
      // `expect()` o un `.click()` es un test que pasa sin haber probado nada.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
    },
  },

  // Este archivo y cualquier otro `.mjs` quedan fuera del `include` del
  // tsconfig, así que no hay type info para lintearlos.
  {
    files: ['**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },

  {
    files: ['tests/**/*.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/no-wait-for-timeout': 'error',
      'playwright/no-force-option': 'error',
      'playwright/no-conditional-in-test': 'error',
      // Los Page Objects encapsulan aserciones en métodos `expectAlgo()`
      // (`expectLoaded`, `expectRoleLabel`, `expectSubmitDisabled`). Sin esto
      // la regla los toma por tests sin aserciones. El patrón cubre tanto la
      // llamada directa como la forma `pageObject.expectAlgo()`.
      'playwright/expect-expect': ['error', { assertFunctionPatterns: ['^expect[A-Z]'] }],
      'playwright/no-skipped-test': ['error', { allowConditional: true }],
    },
  },

  prettier,
);

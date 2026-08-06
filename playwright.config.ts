import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Carga las credenciales QA desde .env (no versionado; ver .env.example).
// Playwright no lee .env por su cuenta, hay que hacerlo acá.
dotenv.config();

/**
 * Configuración central del framework.
 * - baseURL para navegación relativa desde los Page Objects.
 * - Propie no expone data-testid: se usan locators por rol ARIA/texto visible
 *   (ver docs/TEST-STRATEGY.md §2), por eso NO se fija `testIdAttribute`.
 * - No hay un storageState único: hay 3 roles (client/owner/agent), así que
 *   cada storageState se aplica por describe/test con `test.use(...)`, no aquí.
 * - Trace / screenshot / video solo en fallo para acelerar la ejecución verde.
 * - `workers` se limita fuerte, y **en CI más que en local**: el baseURL es un
 *   sitio real desplegado en Vercel, no un servidor local. Dos motivos:
 *     1. Con el default de Playwright (~núcleos/2), varios workers golpeándolo
 *        a la vez producen timeouts de navegación que no son bugs ni de la app
 *        ni de los tests.
 *     2. Vercel activa una protección anti-bot (HTTP 403) ante volumen
 *        sostenido, y cuando salta hasta `auth.setup.ts` falla. En CI se usa
 *        1 worker: la suite completa tarda ~7 min, que para una corrida
 *        programada es irrelevante frente a un falso rojo (ver §11).
 */
export default defineConfig({
  testDir: './tests',
  // `seed.spec.ts` es la plantilla de referencia que copia el Generator, no
  // cobertura: su valor es existir y fijar el estilo de la casa. Se excluye de
  // la ejecución porque no verifica nada y sí puede tumbar una corrida entera:
  // en CI se lo llevó puesto el checkpoint anti-bot de Vercel mientras los 82
  // tests reales pasaban. Un rojo sin información entrena a ignorar los rojos.
  // Sigue compilando con `tsc`, que es lo que exige su cuerpo mínimo.
  testIgnore: '**/seed.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : 3,
  timeout: 30_000,
  expect: { timeout: 7_000 },

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'results/junit.xml' }],
  ],

  use: {
    baseURL: 'https://propie-weld.vercel.app',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    // Genera los 3 storageState (uno por rol) una sola vez.
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
      dependencies: ['setup'],
    },
  ],
});

import { test, expect } from '@playwright/test';

/**
 * Test base del que parte todo spec generado: fija el estilo de la casa
 * (navegación relativa a `baseURL` + aserción web-first) sin depender de
 * ningún Page Object ni rol.
 *
 * El cuerpo es mínimo pero real, no vacío: con `noUnusedLocals` activado un
 * seed sin usar `page` ni `expect` no typechequea, y la alternativa —
 * renombrar a `_page`— le enseñaría al Generator una convención que este
 * repo no usa. De paso sirve de canario: si esto falla, la app no responde
 * y el resto de los fallos de la corrida son de entorno, no de los tests.
 */
test.describe('Test group', () => {
  test('seed', async ({ page }) => {
    // generate code here.
    await page.goto('/');
    await expect(page).toHaveTitle(/Propie/);
  });
});

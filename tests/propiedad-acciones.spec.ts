import { test, expect } from '../src/fixtures/test-fixtures';
import { STORAGE_STATE } from '../src/data/users';

/**
 * PROP-BUG-09 — Botones de icono sin nombre accesible y sin efecto.
 * Ver TEST-STRATEGY.md §3.
 *
 * En la cabecera del detalle de una propiedad propia hay dos botones de icono
 * que no tienen `aria-label`, ni `title`, ni texto. Eso los hace:
 *  - invisibles para un lector de pantalla (se anuncian como "botón", sin más),
 *  - imposibles de descubrir con el mouse (no hay tooltip al pasar por encima),
 *  - inlocalizables por rol y nombre desde un test, que es el síntoma que
 *    delata el problema de accesibilidad.
 *
 * Y al menos uno de ellos no hace nada al pulsarlo: ni navega, ni abre un
 * diálogo, ni da feedback.
 */
test.describe('Detalle de propiedad — acciones de la cabecera', () => {
  test.use({ storageState: STORAGE_STATE.agent });

  /** Abre el detalle de la primera propiedad propia por navegación SPA. */
  async function abrirPrimeraPropiedadPropia(page: import('@playwright/test').Page) {
    await page.goto('/explorar');
    await page.getByRole('button', { name: 'Mis Props.', exact: true }).click();
    await expect(page).toHaveURL(/\/mis-propiedades$/);

    const propiedades = page.getByRole('button').filter({ has: page.getByRole('heading', { level: 2 }) });
    test.skip(
      (await propiedades.count()) === 0,
      'La cuenta qa.agent no tiene propiedades publicadas.',
    );

    await propiedades.first().click();
    await expect(page).toHaveURL(/\/propiedad\/[0-9a-f-]+$/);
  }

  test('los botones de la cabecera deben tener nombre accesible @regression', async ({ page }) => {
    test.fail(true, 'PROP-BUG-09: hay botones de icono sin aria-label, title ni texto.');

    await abrirPrimeraPropiedadPropia(page);

    const sinNombre = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll('button')).filter(
          (b) =>
            !b.getAttribute('aria-label') &&
            !b.getAttribute('title') &&
            !(b.textContent || '').trim(),
        ).length,
    );

    expect(sinNombre, `${sinNombre} botones no exponen ningún nombre accesible`).toBe(0);
  });

  test('el botón de estadísticas debe hacer algo al pulsarlo @regression', async ({ page }) => {
    test.fail(true, 'PROP-BUG-09: el botón no navega, no abre diálogo y no da feedback.');

    await abrirPrimeraPropiedadPropia(page);
    const urlAntes = page.url();

    // Se ancla por posición porque no hay nombre accesible por el que buscarlo
    // —justamente el defecto—. Cuando le agreguen aria-label, este locator
    // debe reemplazarse por un getByRole con nombre.
    const botonSinNombre = page
      .locator('button')
      .filter({ hasNot: page.locator('svg + *') })
      .nth(3);
    await botonSinNombre.click();

    const huboDialogo = await page
      .getByRole('dialog')
      .first()
      .waitFor({ state: 'visible', timeout: 2_000 })
      .then(() => true)
      .catch(() => false);

    expect(
      huboDialogo || page.url() !== urlAntes,
      'el click no produjo ninguna navegación ni ningún diálogo',
    ).toBe(true);
  });
});

import { test, expect } from '../src/fixtures/test-fixtures';

/**
 * /explorar es pública: no requiere login. Se prueba sin storageState.
 */
test.describe('Explorar (público)', () => {
  test('el listado de propiedades carga sin sesión @smoke', async ({ explorarPage }) => {
    await explorarPage.goto();
    await expect(explorarPage.propertyCards.first()).toBeVisible();
    expect(await explorarPage.propertyCount()).toBeGreaterThan(0);
  });

  test('los filtros Todos/Alquiler/Venta son visibles y clicables @smoke', async ({
    explorarPage,
  }) => {
    await explorarPage.goto();
    await expect(explorarPage.filterTodos).toBeVisible();
    await expect(explorarPage.filterAlquiler).toBeVisible();
    await expect(explorarPage.filterVenta).toBeVisible();
  });
});

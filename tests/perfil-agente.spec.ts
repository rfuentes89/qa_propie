import { test, expect } from '../src/fixtures/test-fixtures';
import { STORAGE_STATE } from '../src/data/users';

/**
 * Perfil del rol agente.
 *
 * Todos los tests entran por `gotoViaSpa()` en vez de `goto()`. No es un
 * capricho: una carga completa de /perfil como agente dispara `/auth/me`, que
 * responde 500 y expulsa al usuario (PROP-BUG-02 + PROP-BUG-06). Navegando por
 * la barra inferior no hay recarga y se puede probar el perfil sin chocar con
 * esos dos defectos. Esto además explica por qué la ronda manual pudo ver
 * estas pantallas: se llegaba a ellas navegando, no por deep link.
 */
test.describe('Perfil del agente', () => {
  test.use({ storageState: STORAGE_STATE.agent });

  test('guardar el teléfono no debe mostrar un error @regression', async ({ perfilPage, page }) => {
    // PROP-BUG-02, cuarto síntoma (ver TEST-STRATEGY.md §3). El PATCH del
    // perfil funciona —el teléfono queda guardado—, pero la app llama después
    // a /auth/me para refrescar el usuario, ese 500 revienta, y la UI muestra
    // "Error actualizando perfil". De ahí la contradicción que reportó la
    // ronda manual: "muestra mensaje de error. No obstante guardó el número".
    test.fail(true, 'PROP-BUG-02: el refresco post-guardado llama a /auth/me, que responde 500.');

    await perfilPage.gotoViaSpa();

    const nuevoTelefono = `+54935112${Date.now().toString().slice(-5)}`;
    await perfilPage.editProfileButton.click();
    await perfilPage.phoneInput.fill(nuevoTelefono);

    const authMeFallo = page
      .waitForResponse((r) => r.url().includes('/auth/me') && r.status() >= 500, { timeout: 10_000 })
      .catch(() => null);

    await perfilPage.saveProfileButton.click();
    await authMeFallo;

    await expect(
      page.getByText('Error actualizando perfil'),
      'se mostró un error aunque el guardado sí funcionó',
    ).toBeHidden();
  });

  test('el menú no debe enlazar a rutas que responden 404 @regression', async ({
    perfilPage,
    page,
  }) => {
    // PROP-BUG-07 (ver TEST-STRATEGY.md §3). En el perfil de `client` estos
    // dos accesos fueron removidos, pero en el de `agent` siguen presentes y
    // llevan a un 404. Por eso el defecto no está cerrado: depende del rol.
    test.fail(true, 'PROP-BUG-07: el perfil del agente sigue enlazando a /ayuda y /terminos (404).');

    await perfilPage.gotoViaSpa();
    await expect(perfilPage.helpMenuItem).toBeVisible();

    await perfilPage.helpMenuItem.click();
    await expect(page.getByText('404 Not Found')).toBeHidden();
  });
});

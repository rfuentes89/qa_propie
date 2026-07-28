import { test, expect } from '../src/fixtures/test-fixtures';
import { USERS, STORAGE_STATE } from '../src/data/users';

test.describe('Navegación inferior por rol', () => {
  test.describe('Explorador (client)', () => {
    test.use({ storageState: STORAGE_STATE.client });

    test('muestra Favoritos y Visitas, no Publicar @smoke', async ({ explorarPage }) => {
      await explorarPage.goto();
      await expect(explorarPage.nav.favoritos).toBeVisible();
      await expect(explorarPage.nav.visitas).toBeVisible();
      await expect(explorarPage.nav.publicar).toBeHidden();
      await expect(explorarPage.nav.misPropiedades).toBeHidden();
    });
  });

  test.describe(`${USERS.owner.roleLabel} (owner)`, () => {
    test.use({ storageState: STORAGE_STATE.owner });

    test('muestra Publicar y Mis Props., no Favoritos/Visitas @smoke', async ({
      explorarPage,
    }) => {
      await explorarPage.goto();
      await expect(explorarPage.nav.publicar).toBeVisible();
      await expect(explorarPage.nav.misPropiedades).toBeVisible();
      await expect(explorarPage.nav.favoritos).toBeHidden();
      await expect(explorarPage.nav.visitas).toBeHidden();
    });
  });

  test.describe(`${USERS.agent.roleLabel} (agent)`, () => {
    test.use({ storageState: STORAGE_STATE.agent });

    test('muestra Publicar y Mis Props. @smoke', async ({ explorarPage }) => {
      // Regresión de PROP-BUG-02, ya corregido (ver TEST-STRATEGY.md §5): el
      // 500 de `/auth/me` impedía que la nav renderizara como autenticada.
      await explorarPage.goto();
      await expect(explorarPage.nav.publicar).toBeVisible();
      await expect(explorarPage.nav.misPropiedades).toBeVisible();
    });
  });
});

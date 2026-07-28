import { test, expect } from '../src/fixtures/test-fixtures';
import { USERS, STORAGE_STATE } from '../src/data/users';

test.describe('Perfil', () => {
  // agent se excluye de este loop: PROP-BUG-02 lo rompe de forma consistente
  // y tiene su propio test.fail() dedicado más abajo (evita mezclar defectos
  // conocidos con las aserciones "felices" de client/owner).
  for (const user of [USERS.client, USERS.owner]) {
    test.describe(user.role, () => {
      test.use({ storageState: STORAGE_STATE[user.role] });

      test(`muestra la etiqueta de rol "${user.roleLabel}" @smoke`, async ({ perfilPage }) => {
        await perfilPage.goto();
        await perfilPage.expectRoleLabel(user.roleLabel);
      });

      test('cerrar sesión vuelve a /explorar sin sesión @smoke', async ({ perfilPage, page }) => {
        await perfilPage.goto();
        await perfilPage.logout();
        await expect(page).toHaveURL(/\/explorar$/);
        await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
      });
    });
  }

  test.describe('defecto conocido: banner de ubicación', () => {
    test.use({ storageState: STORAGE_STATE.owner });

    test('el aviso "Activá tu ubicación" bloquea el botón de logout @regression', async ({
      perfilPage,
      page,
    }) => {
      // PROP-BUG-03 (ver TEST-STRATEGY.md §2): igual que el banner de
      // instalación en login, este overlay intercepta pointer events en vez
      // de dejarlos pasar. Se prueba SIN el helper dismissOverlaysIfPresent()
      // (a diferencia de perfilPage.goto()) para dejarlo trazado.
      test.fail(true, 'PROP-BUG-03: el aviso de ubicación intercepta el click de logout.');

      await page.goto('/perfil');
      await perfilPage.logoutButton.click({ timeout: 3_000 });
      await expect(perfilPage.logoutDialog).toBeVisible();
    });
  });

  test.describe('defecto conocido: sesión de agente', () => {
    test.use({ storageState: STORAGE_STATE.agent });

    test('recargar /perfil no debe cerrar la sesión del agente @regression', async ({
      perfilPage,
      page,
    }) => {
      // PROP-BUG-02 (ver TEST-STRATEGY.md §2): GET /auth/me devuelve 500
      // ("column \"published_at\" does not exist") específicamente para el
      // rol agente en una carga completa de página, lo que expulsa al
      // usuario. Reproducido 3/3 veces solo con este rol; owner no lo sufre.
      test.fail(true, 'PROP-BUG-02: /auth/me 500 para el rol agente en full reload.');

      await page.goto('/perfil');
      await perfilPage.expectRoleLabel(USERS.agent.roleLabel);
    });
  });
});

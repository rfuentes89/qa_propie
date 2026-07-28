import { test as setup, expect } from '@playwright/test';
import { LoginPage } from '../src/pages/LoginPage';
import { USERS, STORAGE_STATE, PASSWORD, PASSWORD_ENV_VAR } from '../src/data/users';

/**
 * Sin credenciales no hay nada que probar: los 3 proyectos dependen de este
 * setup. Se corta acá con un mensaje claro en vez de dejar que cada test
 * falle con un timeout esperando la redirección a /explorar, que no daría
 * ninguna pista de cuál es el problema real.
 */
setup.beforeAll(() => {
  if (!PASSWORD) {
    throw new Error(
      `Falta la variable de entorno ${PASSWORD_ENV_VAR}.\n` +
        'Copiá .env.example a .env y completá la contraseña de las cuentas QA.',
    );
  }
});

/**
 * Autenticación única por rol: los 3 usuarios no pueden compartir sesión, así
 * que se generan 3 storageState. Los describe blocks de cada spec aplican el
 * que corresponda con `test.use({ storageState: STORAGE_STATE[...] })`.
 */
for (const user of Object.values(USERS)) {
  setup(`authenticate as ${user.role}`, async ({ page }) => {
    const login = new LoginPage(page);

    await login.goto();
    await login.login(user.email, user.password);

    await expect(page).toHaveURL(/\/explorar$/);
    await page.context().storageState({ path: STORAGE_STATE[user.role] });
  });
}

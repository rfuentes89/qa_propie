import { test, expect } from '../src/fixtures/test-fixtures';
import { USERS } from '../src/data/users';

test.describe('Login', () => {
  for (const user of Object.values(USERS)) {
    test(`login como ${user.role} entra a /explorar @smoke`, async ({ loginPage, page }) => {
      await loginPage.goto();
      await loginPage.login(user.email, user.password);
      await expect(page).toHaveURL(/\/explorar$/);
    });
  }

  test('el botón "Iniciar sesión" está deshabilitado con campos vacíos @regression', async ({
    loginPage,
  }) => {
    await loginPage.goto();
    await loginPage.expectSubmitDisabled();
  });

  test('el banner "Instalar Propie" no debe bloquear el botón de login @regression', async ({
    loginPage,
    page,
  }) => {
    // Defecto conocido (PROP-BUG-01, ver TEST-STRATEGY.md §2): el banner PWA
    // intercepta los clicks del botón "Iniciar sesión" mientras está abierto.
    // Este test lo prueba SIN descartar el banner primero (a diferencia del
    // helper login() que sí lo hace) para dejarlo trazado como regresión.
    // Se espera explícitamente a que el banner monte (aparece con un pequeño
    // retraso async, ver BasePage.dismissOverlaysIfPresent) para que el test
    // reproduzca la condición del bug de forma determinista, no por azar.
    test.fail(true, 'PROP-BUG-01: el banner de instalación intercepta el click de login.');

    await loginPage.goto();
    await loginPage.installBannerCloseButton.waitFor({ state: 'visible', timeout: 3_000 });
    await loginPage.emailInput.fill(USERS.client.email);
    await loginPage.passwordInput.fill(USERS.client.password);
    await loginPage.submitButton.click({ timeout: 3_000 });
    await expect(page).toHaveURL(/\/explorar$/);
  });
});

// spec: specs/login-negativo.md
// seed: tests/seed.spec.ts
import { test, expect } from '../src/fixtures/test-fixtures';

/**
 * Credenciales sintéticas: no existen en Propie y no mutan nada. El objetivo
 * es el mensaje de error, no la cuenta, así que no salen de src/data/users.
 */
const EMAIL_INEXISTENTE = 'qa-inexistente@example.com';
const PASSWORD_INVALIDA = 'contrasena-invalida-qa';
const EMAIL_MAL_FORMADO = 'no-es-un-email';

/**
 * El texto se verificó en vivo el 2026-08-02, no se dedujo: la app devuelve
 * el mensaje crudo de la API (401 de /auth/login) sin traducir, pese a estar
 * íntegramente en español. Se aserta tal cual porque es el comportamiento
 * real de hoy; el defecto de i18n está anotado en el plan (§Observations).
 */
const MENSAJE_CREDENCIALES_INVALIDAS = 'Invalid credentials';

test.describe('Login — casos negativos', () => {
  test('credenciales inválidas muestran el mensaje de error @regression', async ({
    loginPage,
    page,
  }) => {
    await loginPage.goto();

    // 1-3. Completar el formulario con credenciales inexistentes y enviarlo
    await loginPage.login(EMAIL_INEXISTENTE, PASSWORD_INVALIDA);

    await expect(
      loginPage.errorStatus,
      'el login fallido debería anunciar el error en una región role=status',
    ).toHaveText(MENSAJE_CREDENCIALES_INVALIDAS);

    // Un login rechazado no debe navegar: si la URL cambió, la app dejó
    // entrar a alguien con credenciales que no existen.
    await expect(page).toHaveURL(/\/ingresar$/);
  });

  test('el mensaje de error se limpia al corregir el formulario @regression', async ({
    loginPage,
  }) => {
    await loginPage.goto();

    // 1. Provocar el error
    await loginPage.login(EMAIL_INEXISTENTE, PASSWORD_INVALIDA);
    await expect(loginPage.errorStatus).toHaveText(MENSAJE_CREDENCIALES_INVALIDAS);

    // 2. Editar el email: el estado de error queda obsoleto y debe irse
    await loginPage.emailInput.fill('otro@example.com');
    await expect(
      loginPage.errorStatus,
      'el error de la petición anterior no debería sobrevivir a la edición del formulario',
    ).toBeHidden();
  });

  test('un email con formato inválido deshabilita el envío @regression', async ({ loginPage }) => {
    await loginPage.goto();

    // 1. Solo contraseña: falta el email, el botón sigue deshabilitado
    await loginPage.passwordInput.fill(PASSWORD_INVALIDA);
    await loginPage.expectSubmitDisabled();

    // 2. Email con formato inválido: ambos campos tienen contenido, así que
    // si el botón sigue deshabilitado es por validación de FORMATO, no por
    // campo vacío (ese caso ya lo cubre login.spec.ts).
    await loginPage.emailInput.fill(EMAIL_MAL_FORMADO);
    await loginPage.expectSubmitDisabled();
  });
});

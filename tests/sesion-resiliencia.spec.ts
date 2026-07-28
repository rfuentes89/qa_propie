import { test, expect } from '../src/fixtures/test-fixtures';
import { STORAGE_STATE } from '../src/data/users';
import { STORAGE_KEYS, readStorage } from '../src/utils/session';

/**
 * PROP-BUG-06 — El cliente trata un 5xx como si fuera un 401 y cierra la
 * sesión de forma destructiva. Ver TEST-STRATEGY.md §2.
 *
 * Verificado en vivo: ante `GET /auth/me → 500`, la app no solo deja de
 * mostrar la UI autenticada, sino que BORRA accessToken y refreshToken de
 * localStorage y redirige a /explorar. El usuario no puede recuperarse
 * recargando: tiene que volver a escribir sus credenciales.
 *
 * Por qué este es el defecto más importante de los tres relacionados:
 * PROP-BUG-02 (la migración faltante) es solo el disparador que se da HOY.
 * Mientras el cliente confunda "el servidor falló" con "tus credenciales no
 * valen", cualquier caída pasajera del backend —un deploy, un timeout de
 * Render, un pico de carga— desloguea a todos los usuarios conectados. Si se
 * arregla la migración y no esto, el problema vuelve con el próximo incidente.
 *
 * El 500 se simula con `page.route()` en vez de apoyarse en el bug real del
 * rol agente. Dos motivos:
 *  1. El día que arreglen la migración, este test debe seguir vigilando el
 *     manejo de errores, que es un defecto independiente.
 *  2. Usar el rol `client` demuestra que el problema no es específico de
 *     agentes: le pasa a cualquier usuario ante cualquier 5xx.
 */
/**
 * Devuelve 500 en `/auth/me` y una promesa que resuelve cuando ese 500 se
 * entregó de verdad.
 *
 * Esperar la respuesta es imprescindible: sin eso, la aserción puede correr
 * antes de que la app llegue a llamar al endpoint, la URL sigue intacta y el
 * test "pasa" sin haber reproducido nada. Eso hizo flaky a SES-02 en la
 * primera versión, alternando entre pasar y fallar sin que cambiara la app.
 */
async function simular500EnAuthMe(page: import('@playwright/test').Page) {
  await page.route('**/auth/me', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      // Mismo cuerpo que devuelve el backend real, para que el test
      // reproduzca la condición exacta observada en producción.
      body: JSON.stringify({
        statusCode: 500,
        code: '42703',
        error: 'Internal Server Error',
        message: 'column "published_at" does not exist',
      }),
    }),
  );

  return page.waitForResponse(
    (response) => response.url().includes('/auth/me') && response.status() === 500,
  );
}

test.describe('Resiliencia de sesión ante errores del backend', () => {
  test.use({ storageState: STORAGE_STATE.client });

  test('un 500 de /auth/me no debe borrar las credenciales @regression', async ({ page }) => {
    test.fail(true, 'PROP-BUG-06: un 5xx se maneja como 401 y dispara un logout destructivo.');

    const error500Entregado = await simular500EnAuthMe(page);

    await page.goto('/perfil');
    await error500Entregado;

    // Un fallo del servidor es transitorio: las credenciales del usuario
    // siguen siendo válidas y deben sobrevivir para poder reintentar.
    expect(
      await readStorage(page, STORAGE_KEYS.accessToken),
      'la app borró el accessToken ante un error del servidor',
    ).not.toBeNull();
    expect(
      await readStorage(page, STORAGE_KEYS.refreshToken),
      'la app borró el refreshToken, así que ni siquiera puede renovar la sesión sola',
    ).not.toBeNull();
  });

  test('un 500 de /auth/me no debe expulsar al usuario de /perfil @regression', async ({
    page,
  }) => {
    test.fail(true, 'PROP-BUG-06: el 5xx redirige a /explorar como si la sesión fuera inválida.');

    const error500Entregado = await simular500EnAuthMe(page);

    await page.goto('/perfil');
    await error500Entregado;

    await expect(page, 'el usuario fue expulsado a /explorar').toHaveURL(/\/perfil$/);
  });
});

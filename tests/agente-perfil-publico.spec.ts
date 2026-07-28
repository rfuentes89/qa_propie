import { test, expect } from '../src/fixtures/test-fixtures';
import { USERS } from '../src/data/users';
import { userIdFromStorageState } from '../src/utils/session';

/**
 * Perfil público del agente — regresión de PROP-BUG-02, **ya corregido**.
 * Ver TEST-STRATEGY.md §5.
 *
 * Estos casos nacieron como `test.fail()` documentando un defecto: el
 * endpoint respondía 500 con `column "published_at" does not exist`, y la UI
 * lo degradaba a un engañoso "Perfil no encontrado" que parecía un 404 de
 * datos. Era una migración faltante en el backend que rompía toda query sobre
 * la tabla de agentes.
 *
 * La suite detectó el arreglo sola: al aplicarse la migración, los casos
 * empezaron a "pasar inesperadamente" y se les quitó el `test.fail()`.
 * Ahora vigilan que el arreglo no se revierta.
 *
 * Se cubre en dos niveles a propósito:
 *  - API: fija el contrato del backend, sin depender del render.
 *  - UI: prueba lo que el usuario realmente ve.
 */
test.describe('Perfil público del agente', () => {
  // El id se decodifica del JWT del storageState en vez de hardcodearse: las
  // cuentas QA se recrean entre entornos y un UUID fijo haría fallar el test
  // por datos y no por el defecto que vigila.
  const agentId = () => userIdFromStorageState('agent');

  test('GET /agents/users/{id}/public debe responder 200 @regression', async ({ request }) => {
    const response = await request.get(
      `https://propie-api.onrender.com/agents/users/${agentId()}/public`,
    );

    expect(
      response.status(),
      `el backend respondió: ${await response.text()}`,
    ).toBe(200);
  });

  test('la ficha pública del agente no debe mostrar "Perfil no encontrado" @regression', async ({
    page,
  }) => {
    await page.goto(`/perfil/${agentId()}`);

    await expect(page.getByText('Perfil no encontrado.')).toBeHidden();
    await expect(page.getByText(USERS.agent.roleLabel, { exact: true })).toBeVisible();
  });
});

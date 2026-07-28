import { test, expect } from '../src/fixtures/test-fixtures';
import { USERS } from '../src/data/users';
import { userIdFromStorageState } from '../src/utils/session';

/**
 * PROP-BUG-02 (segundo síntoma) — El perfil público de un agente no carga.
 * Ver TEST-STRATEGY.md §2.
 *
 * La UI muestra "Perfil no encontrado", que se lee como un 404 de datos, pero
 * la causa real es un 500 del backend:
 *
 *   GET /agents/users/{id}/public → 500
 *   {"statusCode":500,"code":"42703","message":"column \"published_at\" does not exist"}
 *
 * Es el MISMO error (mismo código 42703, misma columna) que rompe /auth/me
 * para el rol agente. No son dos bugs: es una migración faltante en el
 * backend que revienta toda query que toque la tabla de agentes.
 *
 * Se cubre en dos niveles a propósito:
 *  - API: fija el contrato y captura el mensaje de error exacto para el
 *    reporte a desarrollo, sin depender del render.
 *  - UI: prueba lo que el usuario realmente sufre (el flujo roto).
 */
test.describe('Perfil público del agente', () => {
  // El id se decodifica del JWT del storageState en vez de hardcodearse: las
  // cuentas QA se recrean entre entornos y un UUID fijo haría fallar el test
  // por datos y no por el defecto que vigila.
  const agentId = () => userIdFromStorageState('agent');

  test('GET /agents/users/{id}/public debe responder 200 @regression', async ({ request }) => {
    test.fail(true, 'PROP-BUG-02: el endpoint responde 500 (column "published_at" does not exist).');

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
    test.fail(true, 'PROP-BUG-02: el 500 del backend se degrada a "Perfil no encontrado".');

    await page.goto(`/perfil/${agentId()}`);

    await expect(page.getByText('Perfil no encontrado.')).toBeHidden();
    await expect(page.getByText(USERS.agent.roleLabel, { exact: true })).toBeVisible();
  });
});

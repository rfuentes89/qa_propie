import { test, expect } from '../src/fixtures/test-fixtures';
import { STORAGE_STATE } from '../src/data/users';

/**
 * PROP-BUG-05 — Bucle de navegación entre la bandeja y el chat.
 * Ver TEST-STRATEGY.md §2.
 *
 * El botón "Volver" de la cabecera de /mensajes hace un `history.back()` ciego
 * en lugar de navegar a una ruta explícita. Si el usuario llegó a la bandeja
 * saliendo de un chat, ese back lo devuelve al chat, y el botón del chat lo
 * devuelve a la bandeja: queda atrapado. La única salida es la nav inferior.
 *
 * Reproducido manualmente 2/2 en verificación en vivo.
 */
test.describe('Mensajes — navegación', () => {
  test.use({ storageState: STORAGE_STATE.client });

  test('el botón "Volver" de la bandeja no debe devolver al chat @regression', async ({
    page,
    mensajesPage,
  }) => {
    test.fail(true, 'PROP-BUG-05: "Volver" hace history.back() y reentra al chat recién cerrado.');

    await mensajesPage.goto();

    // El bucle solo existe si hay al menos una conversación con la que entrar
    // y salir. Si la cuenta QA se queda sin datos, es un problema de datos y
    // no un defecto: se omite en vez de dar un falso resultado.
    test.skip(
      (await mensajesPage.conversationCount()) === 0,
      'La cuenta qa.client no tiene conversaciones; sin datos no se puede reproducir el bucle.',
    );

    // Ida: bandeja → chat.
    await mensajesPage.openFirstConversation();
    await expect(page).toHaveURL(/\/mensajes\/[0-9a-f-]+$/);

    // Vuelta: chat → bandeja (este botón sí funciona).
    await mensajesPage.chatBackButton.click();
    await expect(page).toHaveURL(/\/mensajes$/);

    // Aquí se dispara el defecto: "Volver" debería sacar de Mensajes, pero
    // reentra al chat que se acaba de cerrar.
    await mensajesPage.backButton.click();
    await expect(page, 'el botón "Volver" reentró al chat en vez de salir').not.toHaveURL(
      /\/mensajes\/[0-9a-f-]+$/,
    );
  });
});

import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object de la bandeja de mensajes (/mensajes) y del chat de una
 * conversación (/mensajes/{id}).
 *
 * Ojo con los dos botones de "volver", que son distintos y es justo lo que
 * prueba PROP-BUG-05 (ver TEST-STRATEGY.md §2):
 *  - `backButton`: el de la cabecera de la BANDEJA, con texto "Volver".
 *  - `chatBackButton`: el del CHAT, que es un icono sin nombre accesible
 *    (deuda de a11y: no tiene aria-label, así que no se puede localizar por
 *    rol+nombre y hay que anclarlo por posición dentro de la cabecera).
 */
export class MensajesPage extends BasePage {
  readonly path = '/mensajes';

  readonly backButton: Locator;
  readonly conversations: Locator;
  readonly chatBackButton: Locator;
  readonly chatHeading: Locator;
  readonly messageInput: Locator;

  constructor(page: Page) {
    super(page);
    this.backButton = page.getByRole('button', { name: 'Volver', exact: true });
    // Cada conversación es un botón que contiene un heading de nivel 3 con el
    // remitente ("Cliente · Consulta de propiedad").
    this.conversations = page
      .getByRole('button')
      .filter({ has: page.getByRole('heading', { level: 3 }) });
    this.chatHeading = page.getByRole('heading', { level: 1 });
    this.messageInput = page.getByRole('textbox', { name: 'Escribí tu mensaje...' });
    // Sin aria-label: es el primer botón del chat, a la izquierda del título.
    this.chatBackButton = page.locator('button').first();
  }

  async openFirstConversation(): Promise<void> {
    await this.conversations.first().click();
  }

  async conversationCount(): Promise<number> {
    return this.conversations.count();
  }
}

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/** Page Object de la pantalla de login (/ingresar). */
export class LoginPage extends BasePage {
  readonly path = '/ingresar';

  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly installBannerCloseButton: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.getByRole('textbox', { name: 'Email' });
    this.passwordInput = page.getByRole('textbox', { name: 'Contraseña' });
    this.submitButton = page.getByRole('button', { name: 'Iniciar sesión' });
    this.installBannerCloseButton = page.getByRole('button', { name: 'Cerrar' });
  }

  /**
   * El banner "Instalar Propie" (PWA) intercepta los clicks del botón de
   * login mientras está abierto (defecto real, ver TEST-STRATEGY.md §2 —
   * PROP-BUG-01). Se descarta aquí para que el resto de los tests no
   * dependan de ese defecto conocido; UX-01 lo prueba explícitamente.
   */
  private async dismissInstallBannerIfPresent(): Promise<void> {
    // Ver BasePage.dismissOverlaysIfPresent: el banner monta con un pequeño
    // retraso, así que un isVisible() inmediato puede dar un falso negativo.
    const appeared = await this.installBannerCloseButton
      .waitFor({ state: 'visible', timeout: 1_500 })
      .then(() => true)
      .catch(() => false);
    if (appeared) {
      await this.installBannerCloseButton.click().catch(() => {});
    }
  }

  async login(email: string, password: string): Promise<void> {
    await this.dismissInstallBannerIfPresent();
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectSubmitDisabled(): Promise<void> {
    await expect(this.submitButton).toBeDisabled();
  }
}

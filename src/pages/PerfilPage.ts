import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { BottomNavComponent } from './components/BottomNavComponent';

/** Page Object del perfil de usuario (/perfil). Su contenido varía por rol. */
export class PerfilPage extends BasePage {
  readonly path = '/perfil';

  readonly nav: BottomNavComponent;
  readonly logoutButton: Locator;
  readonly logoutDialog: Locator;
  readonly logoutConfirmButton: Locator;
  readonly logoutCancelButton: Locator;
  readonly editProfileButton: Locator;
  readonly saveProfileButton: Locator;
  readonly cancelEditButton: Locator;
  readonly phoneInput: Locator;
  readonly helpMenuItem: Locator;
  readonly termsMenuItem: Locator;

  constructor(page: Page) {
    super(page);
    this.nav = new BottomNavComponent(page);
    this.logoutButton = page.getByRole('button', { name: 'Cerrar sesión' });
    this.logoutDialog = page.getByRole('dialog', { name: '¿Cerrar sesión?' });
    this.logoutConfirmButton = this.logoutDialog.getByRole('button', { name: 'Cerrar sesión' });
    this.logoutCancelButton = this.logoutDialog.getByRole('button', { name: 'Cancelar' });
    this.editProfileButton = page.getByRole('button', { name: 'Editar perfil', exact: true });
    this.saveProfileButton = page.getByRole('button', { name: 'Guardar', exact: true });
    this.cancelEditButton = page.getByRole('button', { name: 'Cancelar', exact: true });
    this.phoneInput = page.getByRole('textbox', { name: 'Teléfono' });
    this.helpMenuItem = page.getByRole('button', { name: 'Ayuda y soporte', exact: true });
    this.termsMenuItem = page.getByRole('button', { name: 'Términos y privacidad', exact: true });
  }

  /**
   * Entra a /perfil por navegación SPA en vez de carga completa.
   *
   * Es imprescindible para el rol **agente**: un `page.goto('/perfil')` dispara
   * una carga completa, que llama a `/auth/me`, que responde 500 y expulsa al
   * usuario (PROP-BUG-02 + PROP-BUG-06). Entrando desde /explorar por la barra
   * inferior no hay recarga, la sesión sobrevive y se puede probar el perfil
   * del agente sin chocar con esos dos defectos.
   */
  async gotoViaSpa(): Promise<void> {
    await this.page.goto('/explorar');
    await this.dismissOverlaysIfPresent();
    await this.nav.goToPerfil();
    await expect(this.page).toHaveURL(/\/perfil$/);
  }

  /** No hay data-testid en la etiqueta de rol: se busca por el texto exacto (ver §2). */
  async expectRoleLabel(roleLabel: string): Promise<void> {
    await expect(this.page.getByText(roleLabel, { exact: true })).toBeVisible();
  }

  async logout(): Promise<void> {
    await this.logoutButton.click();
    await this.logoutConfirmButton.click();
  }
}

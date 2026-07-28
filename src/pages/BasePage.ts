import { Page, expect } from '@playwright/test';

/**
 * Clase base de todos los Page Objects.
 * Centraliza el acceso a `page` y la navegación para no repetir lógica.
 */
export abstract class BasePage {
  protected readonly page: Page;

  /** Ruta relativa a baseURL que identifica la página (para asserts de URL). */
  abstract readonly path: string;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await this.page.goto(this.path);
    await this.dismissOverlaysIfPresent();
  }

  /**
   * Propie tiene al menos 2 overlays dismissibles que interceptan clicks
   * mientras están abiertos en vez de dejar pasar el evento al contenido de
   * debajo: el banner "Instalar Propie" y el aviso de ubicación en /perfil
   * (PROP-BUG-01 / PROP-BUG-03, ver TEST-STRATEGY.md §2). Se descartan aquí
   * de forma centralizada para que los tests funcionales no dependan de
   * defectos conocidos; hay tests de regresión dedicados que sí los prueban
   * sin este helper.
   */
  protected async dismissOverlaysIfPresent(): Promise<void> {
    for (const label of ['Cerrar', 'Ahora no']) {
      const button = this.page.getByRole('button', { name: label, exact: true }).first();
      // El overlay monta unos cientos de ms después de la navegación (espera
      // async a la API de geolocalización antes de decidir si renderizarse).
      // Sin esta espera corta, el check llega antes de que exista y el
      // overlay queda vivo para interceptar el siguiente click del test.
      const appeared = await button
        .waitFor({ state: 'visible', timeout: 1_500 })
        .then(() => true)
        .catch(() => false);
      if (appeared) {
        await button.click().catch(() => {});
      }
    }
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`${this.path}$`));
  }
}

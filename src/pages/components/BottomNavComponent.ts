import { Page, Locator } from '@playwright/test';

/**
 * Barra de navegación inferior, presente en todas las pantallas autenticadas.
 * Sus botones cambian según el rol (ver TEST-STRATEGY.md §3):
 *  - Explorador:            Explorar, Favoritos, Visitas, Mensajes, Perfil
 *  - Propietario / Agente:  Explorar, Publicar, Mis Props., Mensajes, Perfil
 */
export class BottomNavComponent {
  readonly explorar: Locator;
  readonly favoritos: Locator;
  readonly visitas: Locator;
  readonly publicar: Locator;
  readonly misPropiedades: Locator;
  readonly mensajes: Locator;
  readonly perfil: Locator;

  constructor(page: Page) {
    // exact: true es obligatorio aquí: sin él, "Favoritos" matchea también el
    // botón "Agregar a favoritos" de cada tarjeta de propiedad (name es
    // substring por defecto en getByRole), rompiendo el conteo de elementos.
    this.explorar = page.getByRole('button', { name: 'Explorar', exact: true });
    this.favoritos = page.getByRole('button', { name: 'Favoritos', exact: true });
    this.visitas = page.getByRole('button', { name: 'Visitas', exact: true });
    this.publicar = page.getByRole('button', { name: 'Publicar', exact: true });
    this.misPropiedades = page.getByRole('button', { name: 'Mis Props.', exact: true });
    this.mensajes = page.getByRole('button', { name: 'Mensajes', exact: true });
    this.perfil = page.getByRole('button', { name: 'Perfil', exact: true });
  }

  async goToExplorar(): Promise<void> {
    await this.explorar.click();
  }

  async goToPerfil(): Promise<void> {
    await this.perfil.click();
  }
}

import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { BottomNavComponent } from './components/BottomNavComponent';

/** Page Object del listado de propiedades (/explorar), pantalla pública y de inicio. */
export class ExplorarPage extends BasePage {
  readonly path = '/explorar';

  readonly nav: BottomNavComponent;
  readonly searchBox: Locator;
  readonly locationButton: Locator;
  readonly filterTodos: Locator;
  readonly filterAlquiler: Locator;
  readonly filterVenta: Locator;
  readonly moreFiltersButton: Locator;
  readonly propertyCards: Locator;

  constructor(page: Page) {
    super(page);
    this.nav = new BottomNavComponent(page);
    this.searchBox = page.getByRole('searchbox', { name: 'Búsqueda global' });
    this.locationButton = page.getByRole('button', { name: 'Ubicación' });
    this.filterTodos = page.getByRole('button', { name: 'Todos' });
    this.filterAlquiler = page.getByRole('button', { name: 'Alquiler' });
    this.filterVenta = page.getByRole('button', { name: 'Venta' });
    this.moreFiltersButton = page.getByRole('button', { name: 'Más filtros' });
    // Cada tarjeta de propiedad es un link con un heading de nivel 3 dentro.
    this.propertyCards = page
      .getByRole('link')
      .filter({ has: page.getByRole('heading', { level: 3 }) });
  }

  async propertyCount(): Promise<number> {
    return this.propertyCards.count();
  }

  /** Botón "Agregar/Quitar de favoritos" de la tarjeta cuyo título contiene `title`. */
  favoriteButton(title: string): Locator {
    return this.propertyCards.filter({ hasText: title }).getByRole('button', { name: /favoritos/ });
  }

  async toggleFavorite(title: string): Promise<void> {
    await this.favoriteButton(title).click();
  }
}

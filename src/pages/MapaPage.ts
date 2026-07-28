import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object del mapa de propiedades (/mapa), pantalla pública.
 *
 * Los filtros son **dos ejes independientes** que se renderizan idénticos y
 * en la misma fila, lo que confunde a simple vista (ver TEST-STRATEGY.md §3,
 * PROP-BUG-08):
 *  - Operación: Todos · Alquiler · Venta
 *  - Tipo:      Casa · Depto · Terreno · Comercial
 *
 * Que "Todos" y "Casa" estén activos a la vez NO es un defecto: son ejes
 * distintos y el filtrado funciona. Lo que sí falta es exponer el estado de
 * forma accesible — los botones no tienen `aria-pressed`, así que la única
 * forma de leer si están activos es la clase `is-active`.
 */
export class MapaPage extends BasePage {
  readonly path = '/mapa';

  readonly resultsSummary: Locator;
  readonly clearFiltersButton: Locator;

  constructor(page: Page) {
    super(page);
    // El resumen ("N propiedades visibles" / "No hay propiedades visibles").
    this.resultsSummary = page.locator('strong').first();
    this.clearFiltersButton = page.getByRole('button', { name: 'Limpiar', exact: true });
  }

  filter(name: string): Locator {
    return this.page.getByRole('button', { name, exact: true });
  }

  /**
   * Si un filtro está activo. Se lee por clase porque la app no expone
   * `aria-pressed`; el día que lo agregue, este es el único punto a cambiar.
   */
  async isFilterActive(name: string): Promise<boolean> {
    return this.filter(name).evaluate((el) => el.classList.contains('is-active'));
  }

  /**
   * Cantidad de resultados que declara el resumen, o 0 si no hay ninguno.
   *
   * ⚠️ Este valor **no es estable**: depende del encuadre del mapa, cambia al
   * aplicar un filtro (el mapa se reencuadra) y pasa por un estado intermedio
   * "Actualizando mapa..." mientras recalcula. Quien escriba un test contra
   * este número tiene que esperar a que el resumen se estabilice; no sirve
   * para asertar un conteo exacto sin mockear la API.
   */
  async visibleCount(): Promise<number> {
    const text = (await this.resultsSummary.innerText()).trim();
    const match = text.match(/^(\d+)/);
    return match ? Number(match[1]) : 0;
  }
}

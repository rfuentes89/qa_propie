import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/** Medidas del mosaico de fotos del detalle de propiedad. */
export interface GalleryLayout {
  /** true si el mosaico se renderiza en dos columnas (escritorio). */
  twoColumns: boolean;
  /** Alto total del contenedor del mosaico, en px. */
  containerHeight: number;
  /** Espacio vacío bajo la última miniatura de la columna derecha, en px. */
  gapBelowThumbnails: number;
  thumbnailCount: number;
}

/** Estado de las capas cuando el visor de fotos está abierto. */
export interface LightboxLayers {
  /** Alpha del fondo del visor: 1 = totalmente opaco. */
  backdropAlpha: number;
  /** true si el mosaico de la página quedó oculto al abrir el visor. */
  pageContentHidden: boolean;
}

/**
 * Page Object del detalle de una propiedad (`/propiedad/{id}`).
 *
 * Esta pantalla **sí expone `data-testid`** (`property-gallery-carousel`,
 * `property-gallery-show-all`, `property-gallery-next`,
 * `property-gallery-lightbox-close`), a diferencia de la mayoría de la app.
 * Se usan donde existen. El contenedor del visor no tiene testid propio, así
 * que se localiza por su clase BEM `property-image-gallery__lightbox`.
 *
 * ⚠️ Ojo con `Foto siguiente`: hay **dos** botones con ese nombre accesible,
 * el del carrusel en línea y el del visor. Siempre hay que acotar al
 * contenedor correspondiente o el locator es ambiguo.
 */
export class PropiedadPage extends BasePage {
  /** Se fija al navegar; el detalle no tiene una ruta única. */
  readonly path = '/propiedad';

  readonly openGalleryButton: Locator;
  readonly shareButton: Locator;
  readonly lightbox: Locator;
  readonly lightboxClose: Locator;
  readonly lightboxNext: Locator;
  readonly lightboxPrev: Locator;
  readonly lightboxCounter: Locator;

  constructor(page: Page) {
    super(page);
    // Por testid y no por texto: en escritorio el botón dice "Ver las N fotos"
    // sobre el mosaico, pero en móvil el mosaico no se renderiza y el control
    // tiene otro nombre accesible. El testid es el mismo en ambos.
    this.openGalleryButton = page.getByTestId('property-gallery-show-all');
    this.shareButton = page.getByRole('button', { name: 'Compartir', exact: true });
    this.lightbox = page.locator('.property-image-gallery__lightbox');
    this.lightboxClose = page.getByTestId('property-gallery-lightbox-close');
    // Acotado al visor: el carrusel en línea tiene otro botón con el mismo nombre.
    this.lightboxNext = this.lightbox.getByRole('button', { name: 'Foto siguiente' });
    this.lightboxPrev = this.lightbox.getByRole('button', { name: 'Foto anterior' });
    // Prefer a stable test id when available; fall back to common class names.
    this.lightboxCounter = this.lightbox.locator(
      '[data-testid="property-gallery-lightbox-counter"], [data-test="lightbox-counter"], .lightbox__counter, .property-image-gallery__counter'
    );
  }

  /**
   * Abre el visor de fotos, funcione el layout que funcione.
   *
   * Las dos vías son distintas y **no intercambiables**:
   *  - Escritorio: el botón "Ver las N fotos" sobre el mosaico.
   *  - Móvil: el mosaico no se renderiza, así que ese botón queda en el DOM
   *    pero oculto (`display: none`). El visor se abre tocando la diapositiva
   *    del carrusel, que ocupa el ancho completo.
   *
   * Por eso no basta con localizar el botón por testid: hay que comprobar que
   * sea **visible** antes de usarlo. Un `click()` por JS sí activaría el botón
   * oculto, pero eso no es lo que puede hacer un usuario real.
   */
  async openLightbox(): Promise<void> {
    if (await this.openGalleryButton.isVisible()) {
      await this.openGalleryButton.click();
    } else {
      await this.page.locator('.property-image-gallery__carousel-slide').first().click();
    }
    await this.lightbox.waitFor({ state: 'visible' });
  }

  /**
   * Inspecciona las capas con el visor abierto.
   *
   * Se miden **dos** propiedades porque hay dos formas válidas de arreglar
   * PROP-BUG-15: volver el fondo del visor opaco, u ocultar el contenido de
   * la página mientras el visor está abierto. El test acepta cualquiera de
   * las dos, para no atarse a una implementación concreta.
   */
  async inspectLightboxLayers(): Promise<LightboxLayers> {
    return this.page.evaluate(() => {
      const lightbox = document.querySelector('.property-image-gallery__lightbox');
      if (!lightbox) throw new Error('El visor de fotos no está abierto.');

      // El alpha del color de fondo: rgba(r, g, b, a) → a. Sin alpha, es opaco.
      const background = getComputedStyle(lightbox).backgroundColor;
      const match = background.match(/rgba?\(([^)]+)\)/);
      const parts = match ? match[1].split(',').map((n) => Number(n.trim())) : [];
      const backdropAlpha = parts.length === 4 ? parts[3] : 1;

      // Se mira el `stage` y no el `mosaic`: el mosaico solo se renderiza en
      // escritorio, así que en móvil está oculto de todos modos y daría un
      // falso "contenido oculto" que haría pasar el test sin haber probado
      // nada. El `stage` es el contenedor que queda detrás del visor en los
      // dos layouts — mosaico en escritorio, carrusel en móvil — y no
      // contiene al visor.
      const stage = document.querySelector('.property-image-gallery__stage');
      let pageContentHidden = true;
      if (stage) {
        const style = getComputedStyle(stage);
        pageContentHidden =
          style.visibility === 'hidden' ||
          style.display === 'none' ||
          Number(style.opacity) === 0;
      }

      return { backdropAlpha, pageContentHidden };
    });
  }

  async gotoProperty(id: string): Promise<void> {
    await this.page.goto(`/propiedad/${id}`);
    await this.dismissOverlaysIfPresent();
  }

  /**
   * Mide el mosaico de fotos.
   *
   * Se mide por geometría (`getBoundingClientRect`) en vez de comparar
   * píxeles: el defecto que se vigila —PROP-BUG-14— es que la columna de
   * miniaturas no llena el alto del contenedor, y eso es una diferencia de
   * coordenadas, no de color. Así el test no necesita baselines de imagen ni
   * se rompe cuando cambian las fotos del catálogo.
   *
   * La columna derecha se identifica por posición horizontal: en escritorio
   * el mosaico es una foto grande a la izquierda y una grilla 2×2 a la
   * derecha. En móvil todo se apila en una sola columna y no hay dos
   * columnas que comparar, lo que se refleja en `twoColumns: false`.
   */
  async measureGallery(): Promise<GalleryLayout> {
    return this.page.evaluate(() => {
      const button = Array.from(document.querySelectorAll('button')).find((b) =>
        /^Ver las \d+ fotos$/.test((b.textContent || '').trim()),
      );
      if (!button) throw new Error('No se encontró el botón "Ver las N fotos".');

      // El contenedor del mosaico es el ancestro más cercano del botón que
      // agrupa la foto grande y las miniaturas.
      let container: HTMLElement | null = button;
      while (container && container.querySelectorAll('img').length < 3) {
        container = container.parentElement;
      }
      if (!container) {
        return {
          twoColumns: false,
          containerHeight: 0,
          gapBelowThumbnails: 0,
          thumbnailCount: 0,
        };
      }

      const box = container.getBoundingClientRect();
      const middle = box.left + box.width / 2;
      const images = Array.from(container.querySelectorAll('img')).map((img) =>
        img.getBoundingClientRect(),
      );
      const rightColumn = images.filter((r) => r.left >= middle);
      const leftColumn = images.filter((r) => r.left < middle);

      // Sin imágenes a ambos lados no hay mosaico de dos columnas (móvil).
      if (!rightColumn.length || !leftColumn.length) {
        return {
          twoColumns: false,
          containerHeight: Math.round(box.height),
          gapBelowThumbnails: 0,
          thumbnailCount: images.length,
        };
      }

      const bottomOfThumbnails = Math.max(...rightColumn.map((r) => r.bottom));
      return {
        twoColumns: true,
        containerHeight: Math.round(box.height),
        gapBelowThumbnails: Math.round(box.bottom - bottomOfThumbnails),
        thumbnailCount: rightColumn.length,
      };
    });
  }
}

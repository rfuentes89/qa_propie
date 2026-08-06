import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/** Tipos de propiedad tal como los guarda el wizard en su estado. */
export type PropertyType = 'HOUSE' | 'APARTMENT' | 'LAND' | 'STORE' | 'OFFICE';
export type ListingType = 'SALE' | 'RENT' | 'TEMPORARY';

/** Borrador del wizard que se siembra en localStorage antes de abrir un paso. */
export interface PublishDraft {
  propertyType: PropertyType;
  listingType: ListingType;
  title?: string;
  description?: string;
  country?: string;
  province?: string;
  city?: string;
}

/**
 * Page Object del wizard de publicación (5 pasos, una URL por paso).
 *
 * ## Por qué los tests NO recorren el wizard desde el paso 1
 *
 * Abrir `/publicar` **crea una propiedad real en el servidor** en el acto:
 * un registro con `status: "ACTIVE"` y `title: null` que queda asociado al
 * usuario, aparece en "Mis Propiedades" y **no se puede borrar** — la API no
 * expone `DELETE /properties/{id}` (responde 404) y la UI no ofrece control
 * de estado para esos registros. Ver PROP-BUG-13 en TEST-STRATEGY.md §3.
 *
 * Recorrer el wizard en cada corrida dejaría entonces una propiedad basura
 * por ejecución, en un entorno desplegado y compartido, de forma irreversible.
 *
 * La alternativa que usan estos tests: **sembrar el estado del wizard en
 * `localStorage` y entrar directamente al paso que interesa por su URL.** Se
 * verificó en vivo que así:
 *  - el paso renderiza correctamente y conserva el tipo de propiedad,
 *  - no se crea ningún `propertyId`, es decir, **cero escrituras al servidor**.
 *
 * El precio de esta decisión es que no se cubre la transición entre pasos.
 * Es un intercambio consciente: se pierde esa cobertura a cambio de que la
 * suite no genere datos irreversibles.
 */
export class PublicarPage extends BasePage {
  readonly path = '/publicar';

  /** Clave de localStorage donde el wizard persiste su borrador. */
  static readonly DRAFT_KEY = 'property-publish';

  /** Una URL por paso; solo se declaran los que la suite usa. */
  static readonly STEPS = {
    informacion: '/publicar/informacion',
    revision: '/publicar/revision',
  } as const;

  readonly progress: Locator;
  readonly continueButton: Locator;
  readonly validationNotice: Locator;

  // Paso 3 — Información
  readonly titleInput: Locator;
  readonly descriptionInput: Locator;
  readonly priceInput: Locator;
  readonly roomsInput: Locator;
  readonly bathsInput: Locator;
  readonly areaInput: Locator;

  // Paso 5 — Verificación y publicar
  readonly ownerCheckbox: Locator;
  readonly termsCheckbox: Locator;
  readonly publishButton: Locator;

  constructor(page: Page) {
    super(page);
    this.progress = page.getByRole('progressbar');
    // El wizard es la única parte de la app con data-testid (ver §8).
    this.continueButton = page.getByTestId('publish-wizard-cta');
    this.validationNotice = page.getByText(/^Completá /);

    this.titleInput = page.getByRole('textbox', { name: 'Título', exact: true });
    this.descriptionInput = page.getByRole('textbox', { name: 'Descripción', exact: true });
    this.priceInput = page.getByRole('textbox', { name: 'Precio', exact: true });
    this.roomsInput = page.getByRole('textbox', { name: 'Habitaciones', exact: true });
    this.bathsInput = page.getByRole('textbox', { name: 'Baños', exact: true });
    this.areaInput = page.getByRole('textbox', { name: 'm²', exact: true });

    this.ownerCheckbox = page.getByRole('checkbox', {
      name: 'Soy titular o estoy autorizado a publicar esta propiedad',
    });
    this.termsCheckbox = page.getByRole('checkbox', {
      name: 'Acepto los términos y condiciones de publicación',
    });
    this.publishButton = page.getByRole('button', { name: 'Publicar propiedad' });
  }

  /**
   * Siembra el borrador antes de que arranque la app.
   *
   * Se omite `propertyId` deliberadamente: sin él, el wizard no toca el
   * servidor. Si se agregara, la app trataría el borrador como una propiedad
   * existente y volvería a escribir.
   *
   * Debe llamarse ANTES de `openStep()`.
   */
  async seedDraft(draft: PublishDraft): Promise<void> {
    await this.page.addInitScript(
      ([key, value]) => {
        window.localStorage.setItem(key, JSON.stringify(value));
      },
      [
        PublicarPage.DRAFT_KEY,
        {
          publishMode: 'create',
          country: 'Argentina',
          province: 'Córdoba',
          city: 'Córdoba',
          title: '',
          description: '',
          ...draft,
        },
      ] as const,
    );
  }

  /** Abre un paso concreto por su URL. Requiere `seedDraft()` previo. */
  async openStep(step: keyof typeof PublicarPage.STEPS): Promise<void> {
    await this.page.goto(PublicarPage.STEPS[step]);
    await this.dismissOverlaysIfPresent();
  }

  /** El texto de validación que bloquea el avance, o null si no hay ninguno. */
  async validationText(): Promise<string | null> {
    const visible = await this.validationNotice
      .first()
      .waitFor({ state: 'visible', timeout: 3_000 })
      .then(() => true)
      .catch(() => false);
    return visible ? (await this.validationNotice.first().innerText()).trim() : null;
  }

  /** Si el wizard llegó a crear un registro en el servidor. */
  async createdPropertyId(): Promise<string | null> {
    return this.page.evaluate((key): string | null => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      const draft = JSON.parse(raw) as { propertyId?: string };
      return draft.propertyId ?? null;
    }, PublicarPage.DRAFT_KEY);
  }
}

import { test, expect } from '../src/fixtures/test-fixtures';
import { STORAGE_STATE } from '../src/data/users';
import { STORAGE_KEYS, readStorage, seedFavorites } from '../src/utils/session';

/**
 * PROP-BUG-04 — Los favoritos se guardan en una clave global de localStorage
 * (`propie_favorite_property_ids`) que no lleva el id del usuario y que el
 * logout no borra. Ver TEST-STRATEGY.md §2.
 *
 * Consecuencia real, verificada en vivo: en un navegador compartido los
 * favoritos de un usuario quedan visibles para el siguiente —incluso sin
 * sesión iniciada—. Es una fuga de datos entre usuarios, no un detalle
 * cosmético, y por eso es el defecto de mayor severidad de esta ronda.
 */

/** IDs sintéticos: estos tests verifican el ciclo de vida de la clave, no que
 *  las propiedades existan en el catálogo (así no dependen de datos reales). */
const FAVORITOS_SEMBRADOS = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
];

test.describe('Favoritos — aislamiento entre sesiones', () => {
  test.describe('client', () => {
    test.use({ storageState: STORAGE_STATE.client });

    test('cerrar sesión debe limpiar los favoritos locales @regression', async ({
      page,
      perfilPage,
    }) => {
      test.fail(
        true,
        'PROP-BUG-04: el logout borra los tokens pero deja propie_favorite_property_ids intacto.',
      );

      await seedFavorites(page, FAVORITOS_SEMBRADOS);
      await perfilPage.goto();
      await perfilPage.logout();
      await expect(page).toHaveURL(/\/explorar$/);

      // Control: el logout SÍ limpia las credenciales. Esta aserción pasa hoy
      // y demuestra que el fallo de abajo no es "el logout no hizo nada".
      expect(
        await readStorage(page, STORAGE_KEYS.accessToken),
        'el logout debería borrar el accessToken',
      ).toBeNull();

      // El defecto: los favoritos sobreviven a la sesión que los creó.
      expect(
        await readStorage(page, STORAGE_KEYS.favorites),
        'los favoritos sobrevivieron al cierre de sesión',
      ).toBeNull();
    });

    test('sin sesión, ninguna tarjeta debe figurar como favorita @regression', async ({
      page,
      perfilPage,
      explorarPage,
    }) => {
      test.fail(true, 'PROP-BUG-04: los favoritos del usuario anterior se renderizan sin sesión.');

      await seedFavorites(page, FAVORITOS_SEMBRADOS);
      await perfilPage.goto();
      await perfilPage.logout();
      await explorarPage.propertyCards.first().waitFor({ state: 'visible' });

      // "Quitar de favoritos" es el aria-label de una tarjeta YA marcada: una
      // sesión anónima limpia no debería mostrar ninguna.
      await expect(page.getByRole('button', { name: 'Quitar de favoritos' })).toHaveCount(0);
    });
  });

  test.describe('owner', () => {
    test.use({ storageState: STORAGE_STATE.owner });

    test('un usuario no debe heredar los favoritos de otro @regression', async ({
      page,
      explorarPage,
    }) => {
      test.fail(
        true,
        'PROP-BUG-04: la clave de favoritos es global, no está namespaced por usuario.',
      );

      // Simula el navegador compartido: la clave quedó de la sesión previa de
      // otro usuario y owner entra después con su propia sesión.
      await seedFavorites(page, FAVORITOS_SEMBRADOS);
      await explorarPage.goto();

      expect(
        await readStorage(page, STORAGE_KEYS.favorites),
        'owner arrancó su sesión viendo los favoritos que dejó otro usuario',
      ).toBeNull();
    });
  });
});

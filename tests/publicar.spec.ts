import { test, expect } from '../src/fixtures/test-fixtures';
import { STORAGE_STATE } from '../src/data/users';

/**
 * Wizard de publicación — validaciones de formulario.
 *
 * Estos tests **no recorren el wizard**: siembran su estado en localStorage y
 * abren directamente el paso que interesa. Abrir `/publicar` crea una
 * propiedad real e irreversible en el servidor (PROP-BUG-13), así que
 * recorrerlo en cada corrida dejaría basura permanente en un entorno
 * compartido. Ver el comentario de `PublicarPage` para el detalle.
 *
 * Todos los tests verifican además, como control, que no se creó ningún
 * registro: si un cambio futuro hiciera que el wizard escriba en el servidor
 * al abrir un paso, estos tests lo detectarían antes de generar residuo.
 */
test.describe('Publicar — validaciones', () => {
  test.use({ storageState: STORAGE_STATE.owner });

  test('un terreno no debe exigir habitaciones ni baños @regression', async ({ publicarPage }) => {
    // PROP-BUG-11 (ver TEST-STRATEGY.md §3): la validación del paso 3 es la
    // misma para todos los tipos de propiedad. Un terreno no tiene ni
    // habitaciones ni baños, pero el formulario los exige igual y bloquea la
    // publicación.
    test.fail(true, 'PROP-BUG-11: el paso 3 exige habitaciones y baños también para un terreno.');

    await publicarPage.seedDraft({ propertyType: 'LAND', listingType: 'SALE' });
    await publicarPage.openStep('informacion');
    await expect(publicarPage.progress).toHaveAccessibleName('Paso 3 de 5');

    // Todo lo que un terreno sí tiene. Habitaciones y baños quedan vacíos a
    // propósito: son los campos que no deberían aplicar.
    await publicarPage.titleInput.fill('Terreno en venta — validación QA');
    await publicarPage.descriptionInput.fill('Lote sin construir, apto para desarrollo.');
    await publicarPage.priceInput.fill('25000');
    await publicarPage.areaInput.fill('5000');

    await publicarPage.continueButton.click();

    const aviso = await publicarPage.validationText();
    expect(aviso, `la validación exige campos que no aplican a un terreno: "${aviso}"`).toBeNull();
  });

  test('abrir un paso del wizard no debe crear una propiedad @regression', async ({
    publicarPage,
  }) => {
    // Control de seguridad de la propia suite, no un defecto de la app: fija
    // la condición de la que dependen todos los tests de este archivo para no
    // dejar residuo. Si empieza a fallar, hay que revisar la estrategia de
    // siembra ANTES de volver a correr la suite completa.
    await publicarPage.seedDraft({ propertyType: 'LAND', listingType: 'SALE' });
    await publicarPage.openStep('informacion');

    expect(
      await publicarPage.createdPropertyId(),
      'el wizard creó una propiedad en el servidor, que no se puede borrar',
    ).toBeNull();
  });

  test('los términos y condiciones deben ser consultables @regression', async ({
    publicarPage,
    page,
  }) => {
    // PROP-BUG-12 (ver TEST-STRATEGY.md §3): el paso 5 pide aceptar unos
    // términos que no se pueden leer. No hay enlace, ni modal, ni texto: la
    // pantalla entera no contiene un solo elemento <a>.
    test.fail(true, 'PROP-BUG-12: no hay forma de consultar los términos que se piden aceptar.');

    await publicarPage.seedDraft({ propertyType: 'LAND', listingType: 'SALE' });
    await publicarPage.openStep('revision');
    await expect(publicarPage.progress).toHaveAccessibleName('Paso 5 de 5');
    await expect(publicarPage.termsCheckbox).toBeVisible();

    // Se busca cualquier vía de consulta: un enlace en la pantalla, o un
    // control que abra el contenido.
    const enlaces = await page.getByRole('link').count();
    expect(
      enlaces,
      'no hay ningún enlace desde el que leer los términos antes de aceptarlos',
    ).toBeGreaterThan(0);
  });
});

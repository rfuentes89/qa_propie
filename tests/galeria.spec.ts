import { test, expect } from '../src/fixtures/test-fixtures';
import { findPropertyWithImages } from '../src/utils/catalog';

/**
 * PROP-BUG-14 — Hueco negro en el mosaico de fotos.
 * Ver TEST-STRATEGY.md §3.
 *
 * Con 5 fotos o más, el detalle muestra una foto grande a la izquierda y una
 * grilla 2×2 de miniaturas a la derecha. La foto grande estira hasta el alto
 * del contenedor, pero la grilla no: queda un bloque vacío debajo de las
 * miniaturas que se ve como un rectángulo negro.
 *
 * Es un defecto **solo de escritorio**: en móvil el mosaico se apila en una
 * sola columna y el hueco no existe. De ahí el `skip` por viewport.
 */
test.describe('Detalle de propiedad — mosaico de fotos', () => {
  // El mosaico de dos columnas solo se renderiza en anchos de escritorio.
  // Con el viewport de Pixel 7 (412px) la galería se apila y no hay hueco
  // que medir, así que el caso no aplica.
  test.skip(
    ({ viewport }) => !viewport || viewport.width < 900,
    'PROP-BUG-14 es específico del mosaico de escritorio; en móvil la galería se apila.',
  );

  test('las miniaturas deben llenar el alto del mosaico @regression', async ({
    propiedadPage,
    request,
  }) => {
    test.fail(true, 'PROP-BUG-14: la grilla de miniaturas deja un hueco vacío bajo sí misma.');

    // El mosaico completo (1 grande + 4 miniaturas + "+N fotos") necesita al
    // menos 5 fotos; con menos, la columna derecha sí llena el alto.
    const property = await findPropertyWithImages(request, 5);
    test.skip(
      property === null,
      'No hay ninguna propiedad con 5+ fotos en el catálogo; sin datos no se puede reproducir.',
    );

    await propiedadPage.gotoProperty(property!.id);
    await expect(propiedadPage.openGalleryButton).toBeVisible();

    const layout = await propiedadPage.measureGallery();
    expect(layout.twoColumns, 'se esperaba el mosaico de dos columnas').toBe(true);

    // Tolerancia de 8px para absorber el gap de la grilla y redondeos.
    expect(
      layout.gapBelowThumbnails,
      `quedan ${layout.gapBelowThumbnails}px vacíos bajo las miniaturas ` +
        `(${Math.round((layout.gapBelowThumbnails / layout.containerHeight) * 100)}% del mosaico)`,
    ).toBeLessThanOrEqual(8);
  });
});

/**
 * PROP-BUG-15 — El contenido de la página se transparenta a través del visor.
 * Ver TEST-STRATEGY.md §3.
 *
 * Al abrir el visor de fotos, el mosaico de la página **sigue renderizado y
 * visible** detrás, y el fondo del visor es `rgba(0, 0, 0, 0.94)` en vez de
 * opaco. Ese 6% restante deja pasar el mosaico, cuya foto grande se ve como
 * una imagen fantasma fija detrás de cada diapositiva.
 *
 * Esto corrige el diagnóstico original del testing manual ("la primera imagen
 * queda de fondo"): no es que la primera foto se renderice bajo las demás
 * dentro del visor, es que **la página entera se transparenta**, y lo que más
 * se nota es la foto grande del mosaico por ser la de mayor superficie.
 *
 * A diferencia del mosaico (PROP-BUG-14), este defecto no depende del ancho:
 * se aserta en ambos proyectos.
 */
test.describe('Detalle de propiedad — visor de fotos', () => {
  test('el visor debe tapar por completo el contenido de la página @regression', async ({
    propiedadPage,
    request,
  }) => {
    test.fail(true, 'PROP-BUG-15: el fondo del visor es rgba(0,0,0,0.94) y deja ver la página.');

    const property = await findPropertyWithImages(request, 2);
    test.skip(property === null, 'No hay ninguna propiedad con fotos en el catálogo.');

    await propiedadPage.gotoProperty(property!.id);
    await propiedadPage.openLightbox();

    const layers = await propiedadPage.inspectLightboxLayers();

    // Cualquiera de las dos soluciones es válida: fondo opaco, u ocultar el
    // contenido de la página mientras el visor está abierto.
    expect(
      layers.backdropAlpha >= 0.99 || layers.pageContentHidden,
      `el fondo del visor tiene alpha ${layers.backdropAlpha} y el mosaico de la página ` +
        `${layers.pageContentHidden ? 'está oculto' : 'sigue visible detrás'}`,
    ).toBe(true);
  });

  test('avanzar de foto no debe mover el contenido de fondo @regression', async ({
    propiedadPage,
    request,
  }) => {
    test.fail(true, 'PROP-BUG-15: el mosaico de fondo queda fijo mientras el visor avanza.');

    const property = await findPropertyWithImages(request, 3);
    test.skip(property === null, 'No hay ninguna propiedad con 3+ fotos en el catálogo.');

    await propiedadPage.gotoProperty(property!.id);
    await propiedadPage.openLightbox();
    await expect(propiedadPage.lightboxCounter).toBeVisible({ timeout: 5000 });
    await expect(propiedadPage.lightboxCounter).toHaveText(new RegExp('^\\s*1\\s*/\\s*\\d+\\s*$'));

    await propiedadPage.lightboxNext.click();
    await expect(propiedadPage.lightboxCounter).toHaveText(new RegExp('^\\s*2\\s*/\\s*\\d+\\s*$'));

    // La diapositiva cambió; si el fondo sigue transparentando la página, el
    // usuario ve la foto nueva superpuesta sobre la misma imagen fantasma.
    const layers = await propiedadPage.inspectLightboxLayers();
    expect(
      layers.backdropAlpha >= 0.99 || layers.pageContentHidden,
      'tras avanzar de foto, la página sigue viéndose detrás del visor',
    ).toBe(true);
  });

  test('el visor debe recorrer las fotos en ciclo en ambos sentidos @smoke', async ({
    propiedadPage,
    request,
  }) => {
    const property = await findPropertyWithImages(request, 2);
    test.skip(property === null, 'No hay ninguna propiedad con 2+ fotos en el catálogo.');

    await propiedadPage.gotoProperty(property!.id);
    await propiedadPage.openLightbox();

    const total = property!.imageCount;
    await expect(propiedadPage.lightboxCounter).toBeVisible({ timeout: 5000 });
    await expect(propiedadPage.lightboxCounter).toHaveText(new RegExp(`^\\s*1\\s*/\\s*${total}\\s*$`));

    // Hasta la última foto.
    for (let i = 2; i <= total; i++) {
      await propiedadPage.lightboxNext.click();
      await expect(propiedadPage.lightboxCounter).toHaveText(new RegExp(`^\\s*${i}\\s*/\\s*${total}\\s*$`));
    }

    // Un paso más desde la última vuelve a la primera, sin deshabilitarse.
    await expect(propiedadPage.lightboxNext).toBeEnabled();
    await propiedadPage.lightboxNext.click();
    await expect(propiedadPage.lightboxCounter).toHaveText(new RegExp(`^\\s*1\\s*/\\s*${total}\\s*$`));

    // Y hacia atrás desde la primera lleva a la última.
    await expect(propiedadPage.lightboxPrev).toBeEnabled();
    await propiedadPage.lightboxPrev.click();
    await expect(propiedadPage.lightboxCounter).toHaveText(new RegExp(`^\\s*${total}\\s*/\\s*${total}\\s*$`));
  });
});

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
    await expect(propiedadPage.lightboxCounter).toHaveText(/^1 \/ \d+$/);

    await propiedadPage.lightboxNext.click();
    await expect(propiedadPage.lightboxCounter).toHaveText(/^2 \/ \d+$/);

    // La diapositiva cambió; si el fondo sigue transparentando la página, el
    // usuario ve la foto nueva superpuesta sobre la misma imagen fantasma.
    const layers = await propiedadPage.inspectLightboxLayers();
    expect(
      layers.backdropAlpha >= 0.99 || layers.pageContentHidden,
      'tras avanzar de foto, la página sigue viéndose detrás del visor',
    ).toBe(true);
  });

  /**
   * El recorrido circular del visor es **comportamiento correcto**, no un
   * defecto (ver TEST-STRATEGY.md §4, reclasificación del hallazgo #14).
   *
   * Este caso lo fija como regresión por la misma razón que MAP-01: el bucle
   * fue reportado como posible bug, y si alguien lo "arregla" deshabilitando
   * las flechas en los extremos, el cambio pasaría inadvertido.
   *
   * Además cumple un segundo papel: al no llevar `test.fail()`, recorre el
   * mismo setup que los dos casos de arriba y delata cualquier fallo al abrir
   * el visor que aquellos enmascararían (ver §8).
   *
   * **Se prueban solo los extremos, con dos clics.** Una versión anterior
   * recorría las N fotos en un bucle y resultó frágil: la propiedad de prueba
   * se elige dinámicamente, así que el número de clics cambiaba con el
   * catálogo —de 1 clic con 2 fotos a 8 con 9—, y en móvil el contador se
   * desincronizaba de los clics. El ciclo es una propiedad de los extremos,
   * no del recorrido: dar la vuelta en cada sentido lo demuestra igual, sin
   * depender de cuántas fotos tenga la propiedad.
   */
  test('el visor debe recorrer las fotos en ciclo en ambos sentidos @smoke', async ({
    propiedadPage,
    request,
    viewport,
  }) => {
    // Acotado a escritorio. En el viewport de Pixel 7 los clics sobre las
    // flechas del visor responden de forma no determinista: se reprodujo ~2 de
    // cada 6 ejecuciones que un clic se pierde (el contador no se mueve) o se
    // duplica (avanza dos posiciones). No es sincronización del test —una
    // espera a que el contador se estabilice no lo corrige— pero tampoco está
    // claro que le ocurra a un dedo real: Playwright emula el táctil enviando
    // eventos de mouse. Queda como PROP-BUG-29, pendiente de verificar a mano
    // en un dispositivo. Ver TEST-STRATEGY.md §3.
    test.skip(
      !viewport || viewport.width < 900,
      'Los clics del visor son inestables bajo emulación táctil; ver PROP-BUG-29.',
    );

    const property = await findPropertyWithImages(request, 2);
    test.skip(property === null, 'No hay ninguna propiedad con 2+ fotos en el catálogo.');

    await propiedadPage.gotoProperty(property!.id);
    await propiedadPage.openLightbox();

    const total = property!.imageCount;
    await expect(propiedadPage.lightboxCounter).toBeVisible({ timeout: 5000 });
    await expect(propiedadPage.lightboxCounter).toHaveText(`1 / ${total}`);

    // Hacia atrás desde la primera: debe dar la vuelta a la última.
    // Se espera a que el contador se estabilice antes de asertar y antes del
    // clic siguiente; en móvil un clic puede producir más de un avance (ver
    // `waitForCounterToSettle`).
    await expect(propiedadPage.lightboxPrev).toBeEnabled();
    await propiedadPage.lightboxPrev.click();
    expect(await propiedadPage.waitForCounterToSettle()).toBe(`${total} / ${total}`);

    // Y hacia adelante desde la última: vuelve a la primera.
    await expect(propiedadPage.lightboxNext).toBeEnabled();
    await propiedadPage.lightboxNext.click();
    expect(await propiedadPage.waitForCounterToSettle()).toBe(`1 / ${total}`);
  });
});

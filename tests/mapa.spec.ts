import { test, expect } from '../src/fixtures/test-fixtures';

/**
 * Cobertura del mapa (/mapa), pantalla pública.
 *
 * ⚠️ Nota sobre el hallazgo manual #6 ("revisar lógica de selección, ¿qué es
 * Todos?"): al verificarlo en vivo resultó **no ser un defecto funcional**.
 * "Todos" y "Casa" pueden estar activos a la vez porque son dos ejes de
 * filtrado independientes (operación × tipo), y el filtrado funciona bien:
 * seleccionar "Terreno" deselecciona "Casa" y el conteo cambia en
 * consecuencia. El "No hay propiedades visibles" de la captura original se
 * explica por el encuadre del mapa, no por los filtros.
 *
 * Lo que sí se encontró al investigarlo son dos defectos reales, cubiertos
 * abajo: la concordancia de plural y la falta de estado accesible.
 */
test.describe('Mapa — filtros', () => {
  test('los filtros de operación y tipo son ejes independientes @smoke', async ({ mapaPage }) => {
    await mapaPage.goto();

    // Comportamiento correcto, fijado como regresión: si alguien "arregla"
    // el falso positivo #6 haciendo los filtros mutuamente excluyentes,
    // rompería el filtrado combinado y este test lo detectaría.
    await expect(mapaPage.filter('Todos')).toBeVisible();
    expect(await mapaPage.isFilterActive('Todos')).toBe(true);

    await mapaPage.filter('Casa').click();
    expect(await mapaPage.isFilterActive('Casa')).toBe(true);
    expect(
      await mapaPage.isFilterActive('Todos'),
      '"Todos" es del eje de operación: no debería desactivarse al elegir un tipo',
    ).toBe(true);

    // Dentro del eje de tipo sí hay exclusión mutua.
    await mapaPage.filter('Terreno').click();
    expect(await mapaPage.isFilterActive('Terreno')).toBe(true);
    expect(await mapaPage.isFilterActive('Casa')).toBe(false);
  });

  test('los filtros deben exponer su estado de forma accesible @regression', async ({
    mapaPage,
  }) => {
    // PROP-BUG-10 (ver TEST-STRATEGY.md §3): el estado activo se comunica solo
    // por color (clase CSS `is-active`). Sin `aria-pressed`, un lector de
    // pantalla no puede saber qué filtros están aplicados.
    test.fail(true, 'PROP-BUG-10: los botones de filtro no exponen aria-pressed.');

    await mapaPage.goto();
    await expect(mapaPage.filter('Todos')).toHaveAttribute('aria-pressed', 'true');
  });

  /**
   * PROP-BUG-08 (concordancia de plural: "1 propiedades visibles") NO se
   * automatiza aquí a propósito. Ver TEST-STRATEGY.md §3.
   *
   * El defecto solo se ve con exactamente 1 resultado, y el conteo del mapa
   * depende del encuadre: al cargar da 1, tras aplicar un filtro el mapa se
   * reencuadra y salta a 16, pasando además por un estado intermedio
   * ("Actualizando mapa..."). Forzar el conteo a 1 exigiría mockear la API de
   * propiedades, cuyos endpoints no están documentados.
   *
   * Con `test.fail()` eso sería peor que no tener test: en las corridas donde
   * el conteo no fuera 1 el caso pasaría, Playwright lo reportaría como
   * "passed unexpectedly" y pondría la suite en rojo sin que nada se hubiera
   * roto. Para un defecto cosmético de severidad Baja, no compensa. Queda
   * como cobertura manual hasta que exista mocking de la API.
   */
});

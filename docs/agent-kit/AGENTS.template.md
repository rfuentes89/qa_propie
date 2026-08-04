# Project rules for AI agents

> **Plantilla.** Copiala a la raíz del proyecto como `AGENTS.md` y completá cada `<marcador>`.
> Leé primero [`README.md`](README.md): esto se escribe **después** de tener el esqueleto del
> framework andando, no antes. Toda regla que nombre un archivo debe apuntar a uno que exista.
> Borrá este bloque cuando termines.

Estás trabajando en un framework de QA automation con Playwright + TypeScript sobre
**<nombre de la app>** (`<url base>`). Seguí estas reglas en cada cambio.

Este archivo es la fuente de verdad y describe el repo tal como es hoy. Si un prompt de agente
(`.github/agents/*.agent.md`) lo contradice, gana este archivo.

## Lo primero que tenés que entender

<!-- Pregunta 1: ¿la app corre local o es un sitio ya desplegado?
     Si es local, describí cómo se levanta (webServer, docker, seed de datos).
     Si es desplegada, escribí las restricciones que impone. Ejemplo real de otro proyecto:

     - No hay servidor local ni `webServer`. No podés reiniciar ni sembrar la app.
     - El hosting activa protección anti-bot (HTTP 403) ante volumen sostenido: `workers` está
       limitado y CI serializa las corridas con `concurrency`.
     - Un 403 o un timeout de navegación es un problema de entorno, no un test roto.
-->

## Stack

- `@playwright/test` `<versión>` con TypeScript `<versión>`, `<ESM | CommonJS>`
- Node `<versión que usa CI>`
- Reporters: `<list / html / junit / allure — solo los que estén instalados>`
- Proyectos: `<setup → chromium, mobile-chrome, …>`
- CI: `<plataforma>` (`<ruta al workflow>`), `<workers>` workers, `<con | sin>` sharding

## Estructura de carpetas

- `src/pages/` — Page Objects (una clase por página), todos extienden `BasePage`
- `src/fixtures/<nombre real del archivo>.ts` — fixtures que inyectan los Page Objects
- `<ruta real>` — datos de prueba (`<JSON | TypeScript>`)
- `src/utils/` — helpers puros, sin lógica de test
- `tests/` — specs. Organización: `<plana | espeja la estructura de URLs>`
- `specs/` — salida del Planner (planes en Markdown)

<!-- Listá explícitamente las carpetas que NO existen y que un agente podría inventar
     por costumbre. Ej: "No existe `tests/data/`. No lo crees." -->

## Convenciones de código

- Importá `test` y `expect` desde `<ruta real del archivo de fixtures>`, **nunca** desde
  `@playwright/test` en un spec. Excepciones: `<ej. tests/auth.setup.ts>`
- Usá los **fixtures** en el argumento destructurado, no `new <Page>(page)`
- Un `test.describe` por área funcional
- `test.step` cuando un flujo tiene más de 3 acciones
- Nombres de archivo en kebab-case
- **Idioma de los comentarios: `<español | inglés>`**. Explican el *porqué*, no el *qué*
- Encabezá cada spec generado con su procedencia:

  ```ts
  // spec: specs/<plan>.md
  // seed: tests/seed.spec.ts
  ```

## Autenticación y roles

<!-- Pregunta 3. Ejemplos de los dos extremos:
     - Un solo usuario: `storageState` global en la config, sin proyecto setup.
     - Varios roles: proyecto `setup` que genera un storageState por rol, aplicado con
       `test.use({ storageState: ... })` por describe. Los demás proyectos dependen de él,
       y si el setup falla todo lo que sigue falla por arrastre.
-->

- Roles: `<lista>`
- Se generan en: `<ruta al setup>`
- Se aplican: `<cómo>`
- Credenciales: desde `.env` (`<VAR_1>`, `<VAR_2>`). Nunca en código.

## Prioridad de locators (ESTRICTA — no te desvíes)

1. `getByRole` con nombre accesible
2. `getByLabel` para campos de formulario
3. `getByPlaceholder` cuando no hay label
4. `getByTestId` — **atributo `<data-testid, o el que sea; si no es el default hay que fijar
   testIdAttribute en la config>`**
5. `getByText` solo para copy realmente estático
6. CSS / XPath / `.nth()` / `.first()` — prohibidos salvo comentario que lo justifique

<!-- Pregunta 2. Aclará acá si la app expone testids y en qué casos conviene usarlos por sobre el
     rol. Caso típico: cuando el nombre accesible cambia entre escritorio y móvil.
     Si la app NO expone testids, decilo y sacá el punto 4 de la lista. -->

Si nada resuelve de forma única, **pará y preguntá** antes de caer en CSS.

## Contrato de Page Object

- Una clase por página en `src/pages/`, extiende `BasePage`, con su fixture registrado
- El constructor recibe `page: Page` y nada más
- Todos los locators son `readonly`, inicializados en el constructor
- Los métodos de acción devuelven `Promise<void>` o el siguiente Page Object
- Cada página declara su ruta relativa a `baseURL` — nunca URLs absolutas
- **Sin `expect()` dentro de los Page Objects**: las aserciones viven en los tests
  <!-- Si BasePage tiene helpers con expect (ej. expectLoaded), listalos acá como las únicas
       excepciones. Si no los listás, los agentes van a "corregir" tu propio código base. -->
- Sin lógica de negocio en los tests: va en Page Objects o helpers

## Reglas de aserción

- Solo web-first assertions (`expect(locator).toBeVisible()`, `toHaveCount()`, `toHaveText()`)
- **Nunca** `waitForSelector` ni espera de `networkidle` — usá el auto-waiting de los locators
- **Nunca** un `waitForTimeout` como pausa fija antes de asertar
  <!-- Si tenés un uso legítimo (ej. intervalo de sondeo dentro de un bucle que espera un estado
       real), documentalo acá con el enlace. Una prohibición absoluta que el propio repo incumple
       enseña a los agentes que las reglas son negociables. -->
- Timeouts custom solo con un comentario que los justifique
- Pasá el mensaje de la aserción cuando el fallo sería críptico

## Defectos conocidos de la app

<!-- Pregunta 5. Elegí UNA convención y escribila explícita. Las dos habituales:

  A) Cobertura activa: `test.fail(true, '<TICKET-ID>: <qué pasa en vez de lo esperado>')`, con la
     aserción intacta y un comentario sobre la consecuencia real. Si un test así empieza a *pasar*,
     el bug se arregló upstream: se reporta, no se borra la anotación.

  B) Fuera de la suite: se quita el test, se abre ticket y se referencia desde el plan.

  Sin esta sección, los agentes usan `test.skip` para dejar CI en verde. -->

Convención elegida: `<A | B>`. Catálogo de bugs: `<ruta o enlace>`. No inventes ids nuevos sin
preguntar.

## Al agregar un test

- Ubicación del spec: `<regla>`
- Reusá los Page Objects existentes — no crees infraestructura paralela
- Cargá los datos desde `<ruta>`, no inline
  <!-- Aclará si admitís literales sintéticos en el spec (UUIDs falsos, input inválido) cuando
       prueban un mecanismo y no dependen de datos reales. -->
- Etiquetá el título con `@smoke`, `@regression`, `@critical` o `@flaky-risk`
- Los tests deben ser independientes y correr en cualquier orden
- Acordate de los proyectos extra: `<ej. mobile-chrome>`

## Prohibido

- No saltear ni comentar tests que fallan para que CI quede verde
- No agregar `test.skip` / `test.fixme` sin aprobación humana
- No debilitar una aserción para que un test flaky pase — reportá la inestabilidad
- No usar `page.evaluate` si existe una alternativa con las herramientas de Playwright
- No commitear `.env`, credenciales, `storageState` ni tokens
- No modificar `<lista de archivos protegidos>` sin preguntar
- No agregar dependencias npm sin preguntar
- No dejar `page.pause()` en código commiteado
- No hardcodear URLs absolutas — todo relativo a `baseURL`
- No subir workers, retries ni sharding para forzar un verde

## Cuando no estés seguro

- Preguntá antes de generar código
- Preferí un cambio chico y acotado a un refactor grande
- Si falta un archivo necesario, preguntá antes de crearlo
- Reportá, no maquilles: un test que pasa por el motivo equivocado es un agujero en la red

## Los tres agentes

| Agente | Entrada | Salida | Escribe en |
| --- | --- | --- | --- |
| Planner | La app en vivo | Plan numerado en Markdown | `specs/*.md` |
| Generator | Un escenario numerado del plan | Spec de Playwright | `tests/*.spec.ts` |
| Healer | Un test que falla | Diagnóstico + fix mínimo | El spec que falla |

El Planner numera los escenarios `<grupo>.<escenario>` (`1.1`, `1.2`, `2.1`). El Generator los
referencia **por número**, no por título. El Healer nunca cambia la intención de una aserción.

Los tres usan el servidor MCP `playwright-test` (`npx playwright run-test-mcp-server`), declarado en
el frontmatter de cada archivo de agente. El MCP no es una alternativa a los agentes: es el conjunto
de herramientas que los agentes llaman.

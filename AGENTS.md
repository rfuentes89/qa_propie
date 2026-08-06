# Project rules for AI agents

Estás trabajando en un framework de QA automation con Playwright + TypeScript sobre **Propie**
(`https://propie-weld.vercel.app`). Seguí estas reglas en cada cambio.

Este archivo es la fuente de verdad y describe el repo tal como es hoy. Si un prompt de agente
(`.github/agents/*.agent.md`) lo contradice, gana este archivo. El detalle técnico y el catálogo de
defectos conocidos están en [`docs/TEST-STRATEGY.md`](docs/TEST-STRATEGY.md), que manda sobre
locators y bugs conocidos.

> Una versión genérica y parametrizable de estas reglas, para arrancar otros proyectos, vive en
> [`docs/agent-kit/`](docs/agent-kit/). No la uses acá: este repo tiene convenciones propias.

## Lo primero que tenés que entender

**La app bajo prueba es un sitio de terceros ya desplegado, no código de este repo.** Eso cambia
casi todo:

- No hay servidor local ni `webServer` en la config. No podés reiniciar ni sembrar la app.
- Vercel activa una **protección anti-bot (HTTP 403)** ante volumen sostenido. Por eso `workers`
  está limitado (3 en local, **1 en CI**) y el workflow usa `concurrency` para no correr dos veces
  en paralelo. **Nunca subas workers, retries ni sharding para forzar un verde.**
- Un 403 o un timeout de navegación es un problema de entorno, no un test roto.
- La corrida principal es **programada (diaria, 06:00 UTC)**, no por cada push.

## Stack

- `@playwright/test` ^1.61 con TypeScript ^5.7, ESM (`"type": "module"`)
- Node 22 (el que usa CI)
- Reporters: `list` + HTML (`playwright-report/`) + JUnit (`results/junit.xml`)
- Proyectos: `setup` → `chromium` (Desktop Chrome) y `mobile-chrome` (Pixel 7)
- ESLint (flat config, con reglas type-checked) + Prettier + Husky/lint-staged en pre-commit
- CI: dos workflows separados. [`e2e.yml`](.github/workflows/e2e.yml) corre la suite (1 worker, sin
  sharding, programada). [`quality.yml`](.github/workflows/quality.yml) corre lint, formato y tipos
  en cada push y PR: son ~40s y no tocan el sitio desplegado

## Estructura de carpetas

- `src/pages/` — Page Objects (una clase por página), todos extienden `BasePage`
- `src/pages/components/` — componentes compartidos entre páginas (ej. `BottomNavComponent`)
- `src/fixtures/test-fixtures.ts` — fixtures que inyectan los Page Objects ya instanciados
- `src/data/` — datos de prueba en **TypeScript** (`users.ts`), con credenciales vía `process.env`
- `src/utils/` — helpers puros, sin lógica de test (`session.ts`, `catalog.ts`)
- `tests/` — specs, **planos** (`tests/<feature>.spec.ts`), sin subcarpetas
- `specs/` — salida del Planner (planes en Markdown)
- `docs/` — estrategia de testing, tarjetas de bugs y el kit portable de agentes

No existe `tests/data/` ni `src/fixtures/base.ts`. No los crees.

## Convenciones de código

- Importá `test` y `expect` desde `src/fixtures/test-fixtures`, **nunca** desde `@playwright/test`
  en un spec. La única excepción es `tests/auth.setup.ts`, que corre antes de que existan fixtures.
- Usá los **fixtures** (`async ({ page, perfilPage }) => ...`), no `new PerfilPage(page)`.
- Un `test.describe` por área funcional; anidá un segundo `describe` por rol cuando haga falta.
- `test.step` cuando un flujo tiene más de 3 acciones.
- Nombres de archivo en kebab-case (`propiedad-acciones.spec.ts`).
- **Los comentarios se escriben en español**, como el resto del repo, y explican el *porqué*, no el
  *qué*. Un locator raro sin comentario que lo justifique es deuda.
- Encabezá cada spec generado con su procedencia:

  ```ts
  // spec: specs/<plan>.md
  // seed: tests/seed.spec.ts
  ```

## Autenticación y roles

- Hay **tres roles**: `client`, `owner`, `agent`. Cada uno tiene su `storageState`, generado una
  sola vez por el proyecto `setup` ([`tests/auth.setup.ts`](tests/auth.setup.ts)).
- No hay un `storageState` global en la config. Se aplica por `describe`/`test` con
  `test.use({ storageState: STORAGE_STATE.<rol> })`, importando desde `src/data/users`.
- Las credenciales salen de `.env` (`PROPIE_QA_PASSWORD`) vía `dotenv`. Nunca las escribas en código.
- Si el proyecto `setup` falla, **todo** lo que sigue falla por arrastre. Revisalo primero.

## Prioridad de locators (ESTRICTA — no te desvíes)

1. `getByRole` con nombre accesible
2. `getByLabel` para campos de formulario
3. `getByPlaceholder` cuando no hay label
4. `getByTestId` — **atributo `data-testid`** (el default de Playwright: la config *no* fija
   `testIdAttribute`, y no hay que fijarlo)
5. `getByText` solo para copy realmente estático
6. CSS / XPath / `.nth()` / `.first()` — prohibidos salvo comentario que lo justifique

Propie expone testids solo en unos pocos controles. Úsalos cuando el nombre accesible **cambia
entre escritorio y móvil**: ese es el caso real que resuelven hoy
([`PropiedadPage.ts:50-53`](src/pages/PropiedadPage.ts#L50-L53)). Para todo lo demás, el rol y el
nombre accesible son mejores porque prueban lo que percibe la persona usuaria.

Si nada resuelve de forma única, **pará y preguntá** antes de caer en CSS.

## Contrato de Page Object

- Una clase por página en `src/pages/`, extiende `BasePage`, con su fixture en `test-fixtures.ts`
- El constructor recibe `page: Page` y nada más
- Todos los locators son `readonly`, inicializados en el constructor
- Los métodos de acción devuelven `Promise<void>` o el siguiente Page Object
- Cada página declara su `path` (ruta relativa a `baseURL`) — nunca URLs absolutas
- **Sin `expect()` dentro de los Page Objects**: las aserciones viven en los tests. Las únicas
  excepciones son las heredadas de `BasePage` (`expectLoaded()` y `dismissOverlaysIfPresent()`)
- Sin lógica de negocio en los tests: va en Page Objects o helpers

`BasePage.goto()` ya descarta los overlays conocidos que interceptan clicks (PROP-BUG-01 /
PROP-BUG-03). Si un click "no llega", revisá primero si el test salteó `goto()`.

## Reglas de aserción

- Solo web-first assertions (`expect(locator).toBeVisible()`, `toHaveCount()`, `toHaveText()`)
- **Nunca** `waitForSelector` ni espera de `networkidle` — usá el auto-waiting de los locators
- **Nunca** un `waitForTimeout` como pausa fija antes de asertar. El único uso admitido es como
  intervalo de sondeo dentro de un bucle que espera un estado real, con comentario que lo explique
  (ver [`waitForCounterToSettle`](src/pages/PropiedadPage.ts#L107))
- Timeouts custom solo con un comentario que los justifique
- Pasá el mensaje de la aserción cuando el fallo sería críptico

## Defectos conocidos: `test.fail`, no `test.skip`

Cuando un test documenta un bug real y verificado de Propie, se marca con
`test.fail(true, 'PROP-BUG-XX: <qué pasa en vez de lo esperado>')` y un comentario que explique la
consecuencia real. La aserción se deja intacta.

Eso no es una forma de silenciar un test: es cobertura activa. Si un test con `test.fail` empieza a
**pasar**, el bug se arregló upstream — reportalo, no borres la anotación por tu cuenta.

Los ids `PROP-BUG-XX` están en [`docs/TEST-STRATEGY.md`](docs/TEST-STRATEGY.md) y
[`docs/TRELLO-CARDS.md`](docs/TRELLO-CARDS.md). No inventes ids nuevos sin preguntar.

## Al agregar un test

- El spec va plano en `tests/`, un archivo por área funcional (no uno por test)
- Reusá los Page Objects existentes — no crees infraestructura paralela
- Cargá los datos desde `src/data/`, no inline. Los literales sintéticos (UUIDs falsos, input
  inválido) sí pueden ir en el spec, como `const` con nombre y un comentario que aclare por qué
- Etiquetá el título con `@smoke`, `@regression`, `@critical` o `@flaky-risk`
- Los tests deben ser independientes y correr en cualquier orden
- Acordate de que la suite también corre en `mobile-chrome`

## Lint, formato y tipos

Antes de dar un cambio por terminado, corré los tres y dejalos en cero:

```sh
npm run lint         # ESLint
npm run format       # Prettier (o `format:check` para solo verificar)
npm run typecheck    # tsc --noEmit
```

`tsc` no es opcional: Playwright transpila **sin chequear tipos**, así que un error de tipos no
aparece hasta que el test explota en runtime.

El pre-commit corre lint-staged (ESLint `--fix` + Prettier) sobre lo que estés commiteando. **Nunca
lo saltees con `--no-verify`.** No corre la suite a propósito: son ~7 min contra un sitio real y el
volumen dispara el anti-bot.

Reglas mecánicas que ya están enforced, además de las que este documento pide a mano:

- **`no-floating-promises` y `await-thenable`.** Las dos que más rinden acá. En Playwright un
  `await` de más o de menos es un test que pasa sin probar nada — y si además tiene `test.fail`,
  el timeout se reporta como verde. No es hipotético: así estuvo SES-02 hasta que ESLint lo
  destapó. Cuidado especial con envolver `waitForResponse`/`waitForEvent` en una función `async`:
  una función `async` **desenvuelve** la promesa que retorna, así que perdés la promesa pendiente
  que necesitabas tener escuchando antes de la acción que la dispara.
- **`no-explicit-any`** y las `no-unsafe-*`. Las respuestas de API se tipan con la forma mínima que
  el módulo lee (ver [`catalog.ts`](src/utils/catalog.ts)), no se castean a `any`.
- **`explicit-function-return-type`** (los callbacks quedan exentos).
- **`playwright/no-wait-for-timeout`, `no-force-option`, `no-conditional-in-test`,
  `no-skipped-test`** — la versión mecánica de lo que ya pide la sección de aserciones.
- **`playwright/expect-expect`** está configurada con `assertFunctionPatterns: ['^expect[A-Z]']`
  para reconocer las aserciones encapsuladas en Page Objects (`expectLoaded()`,
  `expectRoleLabel()`, `expectSubmitDisabled()`). Si agregás un método de aserción a un Page Object,
  nombralo `expectAlgo()` o la regla no lo va a ver.

Los `.md` quedan fuera de Prettier a propósito: normalizar el énfasis y repadear tablas ensucia el
historial de la documentación sin cambiar una palabra.

Un `eslint-disable` necesita comentario que lo justifique, igual que un locator raro. Si una regla
te estorba de forma sistemática, decilo en vez de silenciarla caso por caso.

## Prohibido

- No saltear ni comentar tests que fallan para que CI quede verde
- No agregar `test.skip` / `test.fixme` sin aprobación humana
- No debilitar una aserción para que un test flaky pase — reportá la inestabilidad
- No usar `page.evaluate` si existe una alternativa con las herramientas de Playwright
- No commitear `.env`, credenciales, `storageState` ni tokens
- No saltear el pre-commit con `--no-verify`
- No usar `any`, ni apagar una regla de ESLint para que un cambio pase
- No modificar `playwright.config.ts`, `eslint.config.mjs`, `src/fixtures/test-fixtures.ts`,
  `src/data/`, `src/utils/` ni `tests/auth.setup.ts` sin preguntar
- No agregar dependencias npm sin preguntar
- No dejar `page.pause()` en código commiteado
- No hardcodear URLs absolutas — todo relativo a `baseURL`

## Cuando no estés seguro

- Preguntá antes de generar código
- Preferí un cambio chico y acotado a un refactor grande
- Si falta un archivo necesario, preguntá antes de crearlo
- Reportá, no maquilles: un test que pasa por el motivo equivocado es un agujero en la red

## Los tres agentes

| Agente | Entrada | Salida | Escribe en |
| --- | --- | --- | --- |
| [Planner](.github/agents/playwright-test-planner.agent.md) | La app en vivo | Plan numerado en Markdown | `specs/*.md` |
| [Generator](.github/agents/playwright-test-generator.agent.md) | Un escenario numerado del plan | Spec de Playwright | `tests/*.spec.ts` |
| [Healer](.github/agents/playwright-test-healer.agent.md) | Un test que falla | Diagnóstico + fix mínimo | El spec que falla |

El Planner numera los escenarios `<grupo>.<escenario>` (`1.1`, `1.2`, `2.1`). El Generator los
referencia **por número**, no por título. El Healer nunca cambia la intención de una aserción.

Los tres usan el servidor MCP `playwright-test` (`npx playwright run-test-mcp-server`), declarado en
el frontmatter de cada archivo de agente. El MCP no es una alternativa a los agentes: es el conjunto
de herramientas que los agentes llaman.

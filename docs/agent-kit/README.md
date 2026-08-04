# Agent Kit — plantilla portable para proyectos Playwright

Punto de partida para montar el stack **Planner → Generator → Healer** en un proyecto nuevo.

Nada de acá se usa en este repo. Propie tiene su propio [`AGENTS.md`](../../AGENTS.md) y sus
[`.github/agents/`](../../.github/agents/), con convenciones distintas y ya afinadas. Este kit es la
versión genérica y parametrizable, para llevarse a otro lado.

## Contenido

| Archivo | Qué es |
| --- | --- |
| [`AGENTS.template.md`](AGENTS.template.md) | Reglas del proyecto, con marcadores `<...>` a completar |
| [`playwright-test-planner.agent.md`](playwright-test-planner.agent.md) | Explora la app → plan numerado en Markdown |
| [`playwright-test-generator.agent.md`](playwright-test-generator.agent.md) | Escenario del plan → spec de Playwright |
| [`playwright-test-healer.agent.md`](playwright-test-healer.agent.md) | Test que falla → diagnóstico + fix mínimo |

## El orden importa

Este es el punto entero del kit. La secuencia natural — escribir las reglas primero y el código
después — produce un `AGENTS.md` que describe un repo imaginario, y agentes que generan imports que
no compilan. Pasó en este mismo repo: nueve reglas de la plantilla genérica contradecían el código
real, entre ellas la ruta del archivo de fixtures y el atributo de los testids.

Hacelo al revés:

**1. Armá el esqueleto del framework.** `playwright.config.ts`, `BasePage`, un Page Object, el
archivo de fixtures, un `seed.spec.ts` y un spec real que pase. Chico, pero funcionando: acá es
donde tomás las decisiones de arquitectura, no en un documento.

**2. Respondé las cinco preguntas** (abajo) mirando el código y el DOM de la app, no de memoria.

**3. Escribí `AGENTS.md` copiando `AGENTS.template.md` y completando cada `<marcador>`**, con el
esqueleto abierto al lado. Toda regla que nombre un archivo tiene que apuntar a uno que exista.

**4. Copiá los tres agentes** a `.github/agents/` y ajustá el frontmatter: `model`, y las rutas que
aparecen en el cuerpo.

**5. Dejá un `CLAUDE.md`** en la raíz con una sola línea: `See AGENTS.md.` — así Claude Code y
Copilot leen la misma fuente de verdad en vez de divergir.

## Las cinco preguntas

Casi todo lo que se rompe después sale de no haber respondido esto antes:

1. **¿La app corre local o es un sitio ya desplegado?**
   Define `webServer`, `workers`, `retries`, y si un timeout de navegación es un bug o un problema
   de entorno. Si es un sitio de terceros, revisá si tiene protección anti-bot: puede obligarte a
   bajar la concurrencia y a serializar las corridas de CI.

2. **¿La app expone testids? ¿Con qué atributo exacto?**
   Abrí el DOM y mirá; no lo asumas. Playwright usa `data-testid` por defecto. Cualquier otro
   nombre hay que declararlo en `testIdAttribute`, o `getByTestId` no resuelve nada.

3. **¿Cuántos roles hay y cómo se autentican?**
   Uno solo con `storageState` global es muy distinto de varios aplicados por `describe` con
   `test.use()`. Define si hace falta un proyecto `setup` y de qué dependen los demás.

4. **¿Dónde viven los datos de prueba y de dónde salen las credenciales?**
   JSON, TypeScript, factories. Y las credenciales, siempre desde `process.env`.

5. **¿Qué se hace con un bug conocido de la app?**
   ¿`test.fail` con id de ticket y la aserción intacta? ¿Se quita el test y se abre ticket? Esta es
   la regla que más se malinterpreta: sin ella, los agentes terminan usando `test.skip` para dejar
   CI en verde.

## Qué se copia y qué se reescribe

**Se copia casi sin tocar** — la estructura de los tres agentes, el bloque `mcp-servers`, el
workflow Planner → Generator → Healer, la numeración `<grupo>.<escenario>`, el formato del Healer
Report, el orden de prioridad de locators, y las prohibiciones duras (`waitForTimeout` como pausa
fija, `networkidle`, no maquillar tests para que pasen).

**Se reescribe siempre** — rutas de carpetas, nombre del archivo de fixtures, autenticación y roles,
si la app es local o desplegada, el atributo de los testids, el idioma de los comentarios, la
convención de bugs conocidos, y el modelo de cada agente.

## El MCP no es una alternativa a los agentes

Confusión habitual. Son capas distintas:

- **Servidor MCP** (`playwright-test`): las herramientas — `browser_snapshot`, `test_run`,
  `generator_write_test`. Se declara en el frontmatter de cada agente.
- **Agentes** (`.agent.md`): quién hace qué. Esta capa **sí** es seleccionable desde el chat.
- **`AGENTS.md`**: los hechos del repo. La leen los tres por igual.

Los agentes *usan* el MCP. Sin él, el Planner no puede ver la página y el Healer no puede correr un
test.

## Mantenimiento

`AGENTS.md` se desincroniza sola a medida que el repo cambia. Cada tanto, recorré regla por regla y
preguntá: *¿esto apunta a un archivo que todavía existe?* Media hora de auditoría evita meses de
agentes generando código roto.

# QA Automation — Propie (Playwright + TypeScript + POM)

Framework de automatización E2E sobre [propie-weld.vercel.app](https://propie-weld.vercel.app)
con **Playwright + TypeScript** y **Page Object Model**, cubriendo los 3 roles
de usuario de la app (Explorador, Propietario, Agente).

📄 La estrategia completa (análisis UX, defectos encontrados, casos
priorizados y riesgos) está en [`docs/TEST-STRATEGY.md`](docs/TEST-STRATEGY.md).
La ronda de testing manual que originó parte de la cobertura está en
[`docs/manual_testing_Propie.pdf`](docs/manual_testing_Propie.pdf).

⚠️ **Los tests marcados con `test.fail()` fallan a propósito.** Son 15 casos
de regresión que documentan defectos reales del sitio (ver TEST-STRATEGY.md
§2 y §3). Mientras el bug exista, el caso "falla como se espera" y la suite
queda en verde. Si alguno empieza a **"pasar inesperadamente"**, no es un
error de la suite: es la señal automática de que el bug se arregló y hay que
quitarle el `test.fail()`.

⚠️ **No hagas que los tests recorran el wizard de publicación desde
`/publicar`.** Abrirlo crea una propiedad real en el servidor que **no se
puede borrar** (PROP-BUG-13: la API no expone `DELETE`). Los tests siembran el
estado del wizard en `localStorage` y entran al paso por su URL. El caso
PUB-02 vigila que eso se siga cumpliendo.

⚠️ **Si fallan los 3 casos de `auth.setup.ts` a la vez**, no es una regresión:
es la protección anti-bot de Vercel (HTTP 403). Esperá unos minutos y volvé a
correr con `--workers=1`. Ver TEST-STRATEGY.md §11.

**Estado actual: 77 casos, 76 en verde y 1 omitido, sin fallos ni flaky**
(corrida completa del 2026-07-28 con `--workers=1`). GAL-01 se omite en
`mobile-chrome` a propósito: el defecto que vigila solo existe en el mosaico
de escritorio.

🎉 **La suite ya detectó un arreglo por su cuenta.** El 2026-07-28, los 5 casos
que vigilaban PROP-BUG-02 (`column "published_at" does not exist`) empezaron a
reportar *"Expected to fail, but passed"*: el equipo había corrido la
migración pendiente del backend. Se verificó contra la API, se les quitó el
`test.fail()` y hoy vigilan que el arreglo no se revierta. Ver
TEST-STRATEGY.md §5.

## Requisitos
- Node.js 18+ (probado con v24).

## Instalación
```bash
npm install
npx playwright install   # descarga los navegadores
cp .env.example .env     # y completá PROPIE_QA_PASSWORD
```

Las credenciales de las cuentas QA **no están versionadas**: se leen de
`PROPIE_QA_PASSWORD`. Sin esa variable, `auth.setup.ts` corta la ejecución con
un mensaje explicando qué falta.

## Ejecución
```bash
npm test                 # toda la suite (chromium + mobile-chrome)
npm run test:smoke       # solo casos @smoke (crítico y rápido)
npm run test:regression  # solo casos @regression (incluye defectos conocidos)
npm run test:chromium    # solo Chromium
npm run test:ui          # modo UI interactivo
npm run report           # abre el último informe HTML
```

## Integración continua

El workflow [`.github/workflows/e2e.yml`](.github/workflows/e2e.yml) corre la
suite en GitHub Actions. **Requiere configurar un secreto** antes de la primera
ejecución:

> Settings → Secrets and variables → Actions → New repository secret
> · Nombre: `PROPIE_QA_PASSWORD` · Valor: la contraseña de las cuentas QA

Sin ese secreto, `auth.setup.ts` corta con un mensaje explicando qué falta.

**Cuándo se ejecuta**, y por qué así: esta suite prueba un sitio de terceros ya
desplegado, no el código de este repositorio.

| Disparador | Motivo |
|---|---|
| Programado (diario, 06:00 UTC) | Es el principal: la app cambia sin que este repo se entere |
| `push` a `main` | Solo si cambian `tests/`, `src/` o la config — un commit de documentación no gasta una corrida |
| Manual (`workflow_dispatch`) | Para lanzarla cuando haga falta |

### ⚠️ Cómo leer un build en rojo

En esta suite **el rojo no siempre es malo**. Hay tres causas posibles y se
distinguen por el mensaje:

| Mensaje | Qué significa | Qué hacer |
|---|---|---|
| `Expected to fail, but passed` | 🎉 **Arreglaron un defecto.** Ya pasó una vez, con PROP-BUG-02 | Verificar, quitarle el `test.fail()` y moverlo a TEST-STRATEGY.md §5 |
| Los 3 casos de `auth.setup.ts` fallan juntos | Protección anti-bot de Vercel (HTTP 403), no una regresión | Relanzar más tarde |
| Cualquier otro fallo | Regresión real | Investigar |

**Nunca "arregles" el rojo borrando o saltando el caso**: en el primer supuesto
estarías tirando la señal más valiosa que da esta suite.

## Estructura
```
qa-propie-playwright/
├── docs/TEST-STRATEGY.md        # Estrategia, defectos encontrados y casos
├── playwright.config.ts         # Config: proyectos y reporters
├── src/
│   ├── data/users.ts            # 3 roles QA + storageState por rol
│   ├── fixtures/                # Fixtures que inyectan los Page Objects
│   ├── utils/session.ts         # Helpers de localStorage y decodificación de JWT
│   └── pages/
│       ├── BasePage.ts          # goto() + dismissOverlaysIfPresent()
│       ├── LoginPage.ts
│       ├── ExplorarPage.ts
│       ├── PerfilPage.ts
│       ├── MensajesPage.ts
│       ├── MapaPage.ts
│       ├── PublicarPage.ts      # Siembra el borrador; NO recorre el wizard
│       ├── PropiedadPage.ts     # Detalle + medición geométrica del mosaico
│       └── components/BottomNavComponent.ts
└── tests/
    ├── auth.setup.ts                  # Genera 1 storageState por rol
    ├── login.spec.ts                  # Login por rol + PROP-BUG-01
    ├── navigation.spec.ts             # Nav inferior por rol + PROP-BUG-02
    ├── profile.spec.ts                # Perfil y logout + PROP-BUG-02/03
    ├── explorar.spec.ts               # Listado público
    ├── favoritos.spec.ts              # PROP-BUG-04 (fuga entre sesiones)
    ├── sesion-resiliencia.spec.ts     # PROP-BUG-06 (5xx tratado como 401)
    ├── agente-perfil-publico.spec.ts  # PROP-BUG-02 (UI + API)
    ├── mensajes.spec.ts               # PROP-BUG-05 (bucle de navegación)
    ├── perfil-agente.spec.ts          # PROP-BUG-02/07 (guardado y menú 404)
    ├── propiedad-acciones.spec.ts     # PROP-BUG-09 (botones sin etiqueta)
    ├── mapa.spec.ts                   # Filtros + PROP-BUG-10 (aria-pressed)
    ├── publicar.spec.ts               # PROP-BUG-11/12/13 (wizard)
    └── galeria.spec.ts                # PROP-BUG-14/15 (mosaico y visor)
```

## Principios de diseño
- **Locators por rol/texto con `exact: true`:** Propie no expone
  `data-testid`; sin `exact: true`, `getByRole` matchea por substring
  (p. ej. "Favoritos" matchea también "Agregar a favoritos" de cada tarjeta).
- **Multi-rol:** no hay un `storageState` global — cada `describe` aplica
  el suyo con `test.use({ storageState: STORAGE_STATE[rol] })`.
- **Overlays interceptores:** `BasePage.dismissOverlaysIfPresent()` los
  descarta tras cada `goto()`, con una espera corta para su montaje async.
- **Defectos conocidos como regresión activa:** `test.fail()`, no
  `test.skip()` — la suite detecta automáticamente el día que se arreglen.
- **Sin waits arbitrarios:** solo auto-waiting y asserts web-first.

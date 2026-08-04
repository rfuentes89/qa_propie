# Test Plan: Login — casos negativos

**Target:** `https://propie-weld.vercel.app/ingresar`
**Seed:** `tests/seed.spec.ts`
**Date:** 2026-08-02

## Overview

Cubre el hueco que [`docs/TEST-STRATEGY.md`](../docs/TEST-STRATEGY.md) §7 declara fuera de alcance:
los casos negativos de login con el mensaje de error **verificado en vivo**, no fabricado. El texto
exacto que muestra la app con credenciales inválidas es `Invalid credentials`, observado el
2026-08-02 en un `role=status`. Se suman los dos comportamientos adyacentes que aparecieron durante
la exploración: el error se limpia al editar el formulario, y un email mal formado deshabilita el
envío.

## Preconditions

- Sesión **anónima**: ningún `storageState`. Es el default de los proyectos, no hace falta
  `test.use(...)`.
- La app monta dos overlays dismissibles en `/ingresar` (banner PWA "Instalar Propie" y aviso
  "Activá tu ubicación"). `LoginPage.goto()` los descarta; ver la observación 2 más abajo.
- Ningún escenario crea, modifica ni borra datos: todos usan credenciales sintéticas que no existen.

## Scenarios

### 1. Login — casos negativos

**Seed:** `tests/seed.spec.ts`

#### 1.1 Credenciales inválidas muestran el mensaje de error

- **Priority:** P1
- **Tags:** @regression
- **Role:** anónimo
- **Preconditions:** `/ingresar` cargado, overlays descartados, formulario vacío
- **Steps:**
  1. Completar Email con `qa-inexistente@example.com` — expected: el botón "Iniciar sesión" se
     habilita al haber email válido y contraseña no vacía
  2. Completar Contraseña con `contrasena-invalida-qa` — expected: el botón sigue habilitado
  3. Click en "Iniciar sesión" — expected: aparece una región `role=status` con el texto del error
- **Assertions:**
  - La región de estado es visible y su texto es exactamente `Invalid credentials`
  - La URL **sigue siendo** `/ingresar`: no hubo navegación a `/explorar`
- **Edge cases considered:**
  - Email existente con contraseña incorrecta vs email inexistente: la app devuelve el **mismo**
    mensaje en ambos casos, lo cual es correcto (no filtra si la cuenta existe). No se convierte en
    escenario aparte porque la aserción sería idéntica.
  - El mensaje llega de la API, no del cliente: depende de la red. Si el backend está caído, este
    test falla por entorno, no por regresión.

#### 1.2 El mensaje de error se limpia al corregir el formulario

- **Priority:** P2
- **Tags:** @regression
- **Role:** anónimo
- **Preconditions:** `/ingresar` cargado y visible el mensaje de error de un login rechazado (el
  test reproduce ese estado por su cuenta; no depende de que 1.1 haya corrido)
- **Steps:**
  1. Reintentar el login fallido para que aparezca el error — expected: `Invalid credentials` visible
  2. Editar el campo Email con cualquier valor distinto — expected: la región de estado desaparece
- **Assertions:**
  - La región `role=status` deja de estar visible tras editar el email
- **Edge cases considered:**
  - No se verificó si editar **solo la contraseña** limpia el error; queda como caso borde no
    cubierto para no asumir simetría sin observarla.

#### 1.3 Un email con formato inválido deshabilita el envío

- **Priority:** P2
- **Tags:** @regression
- **Role:** anónimo
- **Preconditions:** `/ingresar` cargado, overlays descartados
- **Steps:**
  1. Completar Contraseña con `contrasena-invalida-qa` — expected: el botón sigue deshabilitado
     (falta el email)
  2. Completar Email con `no-es-un-email` — expected: el botón **permanece deshabilitado** pese a
     que ambos campos tienen contenido
- **Assertions:**
  - El botón "Iniciar sesión" está deshabilitado con ambos campos completos pero el email mal
    formado. Esto prueba validación de **formato**, no de campo vacío — que ya cubre el test
    existente en `tests/login.spec.ts`
- **Edge cases considered:**
  - No se probó el límite exacto de la validación (`a@b` vs `a@b.c`): definir el criterio exige
    confirmarlo con producto, no inferirlo del comportamiento.

## Not covered (and why)

- **Bloqueo por intentos repetidos / rate limiting.** Requiere varios envíos fallidos seguidos
  contra un sitio real con protección anti-bot; el riesgo de disparar un 403 y ensuciar la suite
  supera el valor de la cobertura.
- **Recuperación de contraseña** ("¿Olvidaste tu contraseña?"). Envía correo real: fuera de alcance
  sin una cuenta de prueba dedicada.
- **Mensajes de error por campo** (inline, junto al input). No existen: la app solo muestra el
  estado global.

## Observations / suspected defects

1. **El mensaje de error está en inglés en una app íntegramente en español.** `Invalid credentials`
   es el texto crudo que devuelve la API (`401` de `propie-api.onrender.com/auth/login`), mostrado
   sin traducir. Los tests lo asertan tal cual porque es el comportamiento real de hoy, pero es un
   defecto de i18n candidato a ticket. **No le asigné id `PROP-BUG-XX`**: crearlos requiere
   aprobación, según `AGENTS.md`.
2. **Dos botones con nombre accesible `Cerrar` conviven en `/ingresar`** (banner PWA y aviso de
   ubicación). [`LoginPage.installBannerCloseButton`](../src/pages/LoginPage.ts#L18) los localiza
   sin `.first()`, así que si ambos overlays montan a la vez, un `waitFor`/`click` puede violar el
   modo estricto. Hoy no falla porque el aviso de ubicación monta más tarde, pero es una carrera
   latente. `BasePage.dismissOverlaysIfPresent()` sí usa `.first()`.
3. **PROP-BUG-03 se reproduce en `/ingresar`**, no solo en `/perfil`: el aviso "Activá tu ubicación"
   interceptó el click de "Iniciar sesión" durante la exploración, con el mensaje
   `<p>Activá tu ubicación</p> … intercepts pointer events`. La ficha del defecto solo menciona
   `/perfil`.
4. **Consola:** además del `401` esperado de `/auth/login`, hay un `401` de `/auth/me` al cargar la
   página anónima, y un error del bundle que loguea `{success: false, error: Object}`. El de
   `/auth/me` parece esperable sin sesión.

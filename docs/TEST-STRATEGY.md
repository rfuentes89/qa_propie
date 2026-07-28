# Estrategia de Testing — Propie (propie-weld.vercel.app)

> **Autor:** QA Automation Engineer · **Última actualización:** 2026-07-27
>
> Documento elaborado a partir de tres fuentes que se complementan:
> 1. Análisis UX navegando el sitio en vivo con los 3 roles de usuario.
> 2. La ronda de **testing manual exploratorio** documentada en
>    [`manual_testing_Propie.pdf`](./manual_testing_Propie.pdf) (18 hallazgos).
> 3. **Verificación en vivo** de esos 18 hallazgos contra el entorno desplegado,
>    hecha el 2026-07-27 para separar lo vigente de lo ya corregido.

---

## Índice

- [1. Contexto y objetivo](#1-contexto-y-objetivo)
- [2. Defectos: resumen ejecutivo](#2-defectos-resumen-ejecutivo)
- [3. Defectos en detalle](#3-defectos-en-detalle)
- [4. Hallazgos manuales pendientes de verificar](#4-hallazgos-manuales-pendientes-de-verificar)
- [5. Hallazgos ya corregidos](#5-hallazgos-ya-corregidos)
- [6. Roles y credenciales QA](#6-roles-y-credenciales-qa)
- [7. Alcance](#7-alcance)
- [8. Enfoque y arquitectura](#8-enfoque-y-arquitectura)
- [9. Casos de prueba priorizados](#9-casos-de-prueba-priorizados)
- [10. Riesgos y mitigaciones](#10-riesgos-y-mitigaciones)
- [11. Entornos, ejecución y criterios de salida](#11-entornos-ejecución-y-criterios-de-salida)
- [12. Roadmap](#12-roadmap)

---

## 1. Contexto y objetivo

Propie es un marketplace inmobiliario (búsqueda, alquiler y venta de
propiedades) con **3 roles de usuario** que comparten la misma app pero tienen
navegación y permisos distintos: **Cliente** (busca y visita propiedades),
**Propietario** (publica las suyas) y **Agente** (gestiona propiedades de
terceros).

El objetivo de esta estrategia es doble:

1. **Cubrir de forma automatizada** el flujo crítico de autenticación y
   navegación por rol.
2. **Dejar trazados como regresión** los defectos reales encontrados, para que
   la suite avise automáticamente el día que se arreglen.

---

## 2. Defectos: resumen ejecutivo

### La idea principal: 18 hallazgos manuales, 6 defectos reales

La ronda manual reportó 18 incidencias. Al verificarlas en vivo, se
**agruparon por causa raíz**, lo que cambia bastante el panorama:

- **Cuatro síntomas distintos resultaron ser el mismo bug de backend.** "Perfil
  no encontrado" del agente, "Ver perfil del agente" desde solicitudes, el
  error al guardar el teléfono y la sesión de agente que se cae al recargar
  devolvían todos el mismo error de base de datos:
  `column "published_at" does not exist`. **Ya está corregido**
  (ver [§5](#5-hallazgos-ya-corregidos)).
- **Un hallazgo se explicó por otro.** "Al presionar volver te saca de la
  sesión" no era un problema del botón volver: era el reload completo
  disparando un 500 que la app confunde con un 401.
- **Dos hallazgos no eran defectos**: los filtros del mapa (#6) y el recorrido
  circular del carrusel (#14). Ver [§4](#4-hallazgos-manuales-pendientes-de-verificar).
- **Varios ya estaban corregidos** por el equipo de desarrollo (ver
  [§5](#5-hallazgos-ya-corregidos)).

Reportar defectos con causa raíz identificada es mucho más accionable para
desarrollo que reportar 18 síntomas sueltos: el más grave de todos se cerró
con **un solo arreglo** de backend.

### Tabla de defectos vigentes

| ID | Defecto | Severidad | Origen | Automatizado |
|----|---------|-----------|--------|--------------|
| **PROP-BUG-04** | Los favoritos no se borran al cerrar sesión ni están aislados por usuario | **Crítica** | Manual #1 | ✅ `favoritos.spec.ts` |
| **PROP-BUG-06** | Un error 5xx del backend se maneja como 401 y borra las credenciales | **Crítica** | Verificación en vivo | ✅ `sesion-resiliencia.spec.ts` |
| **PROP-BUG-05** | Bucle de navegación entre la bandeja de mensajes y el chat | Alta | Manual #2 | ✅ `mensajes.spec.ts` |
| **PROP-BUG-01** | El banner "Instalar Propie" intercepta el click de login | Alta | Análisis UX | ✅ `login.spec.ts` |
| **PROP-BUG-07** | El perfil del **agente** enlaza a `/ayuda` y `/terminos`, que responden 404 | Alta | Manual #7/#9 | ✅ `perfil-agente.spec.ts` |
| **PROP-BUG-09** | Botones de icono sin nombre accesible, y al menos uno no hace nada | Media | Manual #12 | ✅ `propiedad-acciones.spec.ts` |
| **PROP-BUG-03** | El aviso "Activá tu ubicación" intercepta clicks en varias pantallas | Media | Análisis UX | ✅ `profile.spec.ts` |
| **PROP-BUG-13** | Abrir el wizard crea una propiedad ACTIVE sin título, imposible de borrar | Alta | Verificación en vivo | ✅ `publicar.spec.ts` |
| **PROP-BUG-11** | El paso 3 exige habitaciones y baños también para un terreno | Media | Manual #11 | ✅ `publicar.spec.ts` |
| **PROP-BUG-12** | Se piden aceptar unos términos que no se pueden leer | Media | Manual #13 | ✅ `publicar.spec.ts` |
| **PROP-BUG-15** | El visor de fotos deja ver la página detrás (fondo al 94%) | Media | Manual #5 | ✅ `galeria.spec.ts` |
| **PROP-BUG-14** | Con 5+ fotos, el mosaico deja un bloque negro vacío (51% del área) | Media | Testing manual | ✅ `galeria.spec.ts` |
| **PROP-BUG-10** | Los filtros del mapa no exponen `aria-pressed` | Media | Verificación en vivo | ✅ `mapa.spec.ts` |
| **PROP-BUG-08** | Falta concordancia de plural: "1 propiedades visibles" | Baja | Verificación en vivo | ❌ manual (ver §3) |

---

## 3. Defectos en detalle

### PROP-BUG-04 — Fuga de favoritos entre sesiones y entre usuarios

> **Severidad: Crítica** · Origen: hallazgo manual #1 · Tests: `tests/favoritos.spec.ts`

**Qué pasa.** Los favoritos se guardan en una única clave de `localStorage`
llamada `propie_favorite_property_ids`. Esa clave:

- **no lleva el id del usuario**, así que todos los usuarios del mismo
  navegador comparten la misma lista, y
- **no se borra al cerrar sesión**, así que sobrevive a la sesión que la creó.

**Evidencia.** Estado de `localStorage` inmediatamente después de un logout:

```jsonc
{
  "accessToken":  null,          // ✅ el logout sí borra las credenciales
  "refreshToken": null,          // ✅
  "propie_favorite_property_ids":
    "[\"8f2fbcee…\",\"11ca6adc…\",\"c88f5a56…\"]"   // ❌ intacto
}
```

Y con la sesión ya cerrada, el listado `/explorar` renderiza esas tarjetas con
`aria-label="Quitar de favoritos"`, es decir, marcadas como favoritas.

**Impacto.** En cualquier navegador compartido —un locutorio, una computadora
de oficina, un equipo familiar— la persona que entra después ve qué
propiedades marcó la anterior. Es una fuga de datos personales, no un detalle
cosmético. Es el defecto de mayor severidad de esta ronda.

**Arreglo sugerido a desarrollo.** Namespacear la clave por usuario
(`propie_favorites_{userId}`) y borrarla explícitamente en el handler de
logout, junto con los tokens.

---

### PROP-BUG-06 — Un 5xx se maneja como 401 y destruye la sesión

> **Severidad: Crítica** · Origen: verificación en vivo · Tests: `tests/sesion-resiliencia.spec.ts`

**Qué pasa.** Cuando `GET /auth/me` devuelve **500**, la app no distingue "el
servidor falló" de "tus credenciales no valen". Reacciona como si fuera un
401: **borra `accessToken` y `refreshToken`** de `localStorage` y redirige a
`/explorar`.

**Evidencia.** Secuencia observada al navegar a `/perfil` como agente:

```
GET https://propie-api.onrender.com/auth/me → 500
{statusCode: 500, code: 42703, message: column "published_at" does not exist}
                        ↓
localStorage.accessToken → borrado      URL → /explorar
```

**Por qué importa más que el bug que hoy lo dispara.** PROP-BUG-02 (la
migración faltante) es solo el disparador *actual*. Mientras el cliente
confunda un error de servidor con credenciales inválidas, **cualquier caída
pasajera del backend deslogueará a todos los usuarios conectados**: un deploy,
un timeout de Render, un pico de carga. Y como también borra el
`refreshToken`, la app pierde incluso la capacidad de renovar la sesión sola:
el usuario tiene que volver a escribir sus credenciales.

**Este defecto explica el hallazgo manual #7** ("al presionar el botón volver
te saca de la sesión iniciada"). No era el botón volver: era el reload
completo que provocaba el 404, disparando un `/auth/me` que falló. Eso también
explica por qué en `/ayuda` y `/configuracion` *no* pasaba — dependía de qué
respondió el backend en ese instante, no de la ruta.

**Arreglo sugerido a desarrollo.** Cerrar sesión solo ante 401/403. Ante 5xx,
mantener las credenciales y mostrar un estado de error recuperable con opción
de reintentar.

**Nota de diseño del test.** El 500 se simula con `page.route()` y se ejecuta
con el rol **client**, no apoyándose en el bug real del agente. Así el test
sigue vigilando el manejo de errores el día que arreglen la migración, y
demuestra que el problema no es específico de agentes.

---


### PROP-BUG-05 — Bucle entre la bandeja de mensajes y el chat

> **Severidad: Alta** · Origen: hallazgo manual #2 · Tests: `tests/mensajes.spec.ts`

**Qué pasa.** El botón "Volver" de la cabecera de `/mensajes` hace un
`history.back()` ciego en vez de navegar a una ruta explícita. Si el usuario
llegó a la bandeja **saliendo de un chat**, ese back lo devuelve al chat:

```
/mensajes  ──abre conversación──▶  /mensajes/{id}
    ▲                                    │
    └────────botón del chat ◀────────────┘
    │
    └──botón "Volver" ──▶ /mensajes/{id}   ❌ vuelve a entrar
```

El usuario queda atrapado alternando entre las dos pantallas. La única salida
es la barra de navegación inferior.

**Evidencia.** Reproducido de forma determinista 2/2 en verificación en vivo.

**Arreglo sugerido a desarrollo.** Que "Volver" navegue a una ruta explícita
(`/explorar` o la pantalla de origen) en lugar de delegar en el historial.

---

### PROP-BUG-01 — El banner "Instalar Propie" bloquea el login

> **Severidad: Alta** · Origen: análisis UX · Tests: `tests/login.spec.ts`

El banner PWA **intercepta los clicks** del botón "Iniciar sesión" mientras
está montado, en vez de dejar pasar el evento al contenido de debajo.
Confirmado manualmente (bloqueó un intento de login real) y reproducido de
forma determinista esperando a que el banner monte antes del click.

**Impacto.** Cualquier usuario cuyo navegador dispare el prompt de instalación
justo al loguearse queda bloqueado, sin ninguna pista visual de por qué el
botón no responde.

---

### PROP-BUG-03 — El aviso de ubicación intercepta clicks

> **Severidad: Media** · Origen: análisis UX · Tests: `tests/profile.spec.ts`

Mismo patrón que PROP-BUG-01: el banner "Activá tu ubicación" intercepta los
clicks del contenido de debajo mientras está montado. Depende del estado del
permiso de geolocalización; en un contexto limpio aparece de forma consistente.

**No está limitado a `/perfil`.** En la verificación en vivo el banner
bloqueó también el botón "Iniciar sesión" en `/ingresar`, con el mismo error
que PROP-BUG-01:

```
<p>Activá tu ubicación</p> from <div>…</div> subtree intercepts pointer events
```

O sea que hay **dos overlays distintos capaces de bloquear el mismo botón de
login**, cada uno por su cuenta. Eso amplía el alcance del defecto: no es "el
aviso molesta en el perfil", es "el aviso puede bloquear cualquier acción en
cualquier pantalla donde aparezca".

**Patrón común con PROP-BUG-01.** Los dos overlays interceptan pointer events
en vez de degradar con gracia. Conviene revisarlos juntos: probablemente
compartan el mismo componente base.

---

### PROP-BUG-07 — El perfil del agente enlaza a rutas 404

> **Severidad: Alta** · Origen: hallazgos manuales #7 y #9 · Tests: `tests/perfil-agente.spec.ts`

`/terminos` y `/ayuda` responden `404 Not Found`. En el perfil del rol
**client** esos dos accesos fueron removidos del menú, pero **en el perfil del
agente siguen presentes** y llevan al 404:

| Rol | "Ayuda y soporte" | "Términos y privacidad" |
|-----|-------------------|-------------------------|
| client | ✅ removido | ✅ removido |
| agent | ❌ presente → 404 | ❌ presente → 404 |

**Corrección de una versión anterior de este documento.** Se dio por cerrado
el defecto tras comprobar el menú del rol client. Fue un error de método:
verificar un solo rol en una app cuya UI cambia por rol. El defecto sigue
abierto y alcanzable por UI, así que vuelve a severidad Alta.

**Riesgo agregado.** Volver desde ese 404 implica una carga completa de
página, que para el agente dispara PROP-BUG-02 y, por PROP-BUG-06, le borra
la sesión. Es decir: tocar "Ayuda y soporte" puede desloguear al agente.

---

### PROP-BUG-09 — Botones de icono sin nombre accesible y sin efecto

> **Severidad: Media** · Origen: hallazgo manual #12 · Tests: `tests/propiedad-acciones.spec.ts`

En la cabecera del detalle de una propiedad propia hay **dos botones que no
tienen `aria-label`, ni `title`, ni texto**:

```jsonc
[
  { "i": 2, "aria": "Compartir", "svgs": 1 },  // ✅ correcto
  { "i": 3, "aria": null, "title": null, "texto": "", "svgs": 1 },  // ❌
  { "i": 4, "aria": null, "title": null, "texto": "", "svgs": 1 }   // ❌
]
```

Consecuencias, en orden de gravedad:

1. **Accesibilidad:** un lector de pantalla los anuncia como "botón", sin
   más. Son inoperables sin visión.
2. **Descubribilidad:** no hay tooltip al pasar el mouse, así que ni siquiera
   un usuario vidente sabe qué hacen sin pulsarlos.
3. **Uno de ellos no hace nada:** al pulsarlo no cambia la URL, no abre
   ningún diálogo y no da feedback. Verificado midiendo URL y diálogos antes
   y después del click.

El botón contiguo ("Compartir") sí tiene `aria-label`, lo que sugiere que es
un olvido puntual y no una decisión de diseño.

---

### PROP-BUG-10 — Los filtros del mapa no exponen su estado

> **Severidad: Media** · Origen: verificación en vivo · Tests: `tests/mapa.spec.ts`

Los botones de filtro de `/mapa` comunican si están activos **solo por color**,
mediante la clase CSS `is-active`. No usan `aria-pressed` ni ningún otro
mecanismo accesible, así que un lector de pantalla no puede informar qué
filtros están aplicados.

Es el mismo tipo de deuda que PROP-BUG-09 y que la falta de `data-testid`:
la app no expone estado semántico, solo presentación.

---

### PROP-BUG-13 — Abrir el wizard crea una propiedad fantasma imposible de borrar

> **Severidad: Alta** · Origen: verificación en vivo · Tests: `tests/publicar.spec.ts`

**Qué pasa.** Con solo abrir `/publicar` y avanzar del paso 1, la app **crea
un registro de propiedad en el servidor**, antes de que el usuario haya
escrito un título o un precio. Si abandona el wizard, ese registro queda
huérfano — y no hay forma de eliminarlo.

**Evidencia.** Tras entrar al wizard y salir, el borrador quedó en
`localStorage.property-publish` con un `propertyId`, y ese id existe en el
backend:

```jsonc
GET /properties/d74bab4c-… → 200
{ "status": "ACTIVE", "title": null }        // ← activa y sin título

DELETE /properties/d74bab4c-… → 404
{ "message": "Route DELETE:/properties/d74bab4c-… not found" }
```

En "Mis Propiedades" aparece como `US$ 0 · Activa`, sin título, sin fecha de
publicación y —a diferencia del resto— **sin el combo de estado**, así que
tampoco se puede pausar ni finalizar desde la UI.

| Vía | ¿Permite eliminarlo? |
|-----|----------------------|
| API `DELETE /properties/{id}` | ❌ el endpoint no existe |
| UI, combo de estado | ❌ no se renderiza para estos registros |
| UI, alguna acción de borrado | ❌ no existe |

**Atenuante.** El catálogo público los filtra: `GET /properties` devolvió 17
propiedades, ninguna sin título. El daño se limita a la vista "Mis
Propiedades" del dueño, no al catálogo. Por eso es Alta y no Crítica.

**Cómo se detectó.** Apareció al preparar los tests de esta entrega, no
buscándolo. Explica además la propiedad basura `AA;LSKDFJA;LSKDFJ` que se veía
en la cuenta del agente: es el rastro de un wizard abandonado por alguien más.

**Impacto en la estrategia de testing.** Este defecto es la razón por la que
los tests del wizard no lo recorren: cada corrida dejaría una propiedad
irreversible en un entorno compartido. Ver [§8](#8-enfoque-y-arquitectura).

**Arreglo sugerido a desarrollo.** Crear el registro recién al publicar, o
crearlo con un estado `DRAFT` que no aparezca en "Mis Propiedades" y exponer
`DELETE /properties/{id}`.

---

### PROP-BUG-15 — El visor de fotos deja ver la página detrás

> **Severidad: Media** · Origen: hallazgo manual #5 · Tests: `tests/galeria.spec.ts`

**Qué pasa.** Al abrir el visor de fotos, el mosaico de la página **sigue
renderizado y visible** detrás, y el fondo del visor no es opaco:

```jsonc
{
  "fondoDelVisor": "rgba(0, 0, 0, 0.94)",   // ← 6% deja pasar lo de atrás
  "mosaicoDetras": {
    "sigueVisible": true,
    "opacity": "1",
    "seMovio": false        // queda fijo mientras el visor avanza de foto
  }
}
```

Ese 6% restante deja pasar el mosaico, cuya foto grande —la de mayor
superficie— se ve como una imagen fantasma fija detrás de cada diapositiva.

**Corrección del diagnóstico original.** El testing manual lo describió como
*"la primera imagen queda de fondo mientras se avanzan las otras"*. La
observación es correcta, pero la causa no: **no** es que la primera foto se
renderice bajo las demás dentro del visor. Es que **la página entera se
transparenta**, y lo que más se nota es la foto grande del mosaico.

La diferencia importa para el arreglo: no hay que tocar el z-index de las
diapositivas —que es lo que sugeriría el diagnóstico original— sino el fondo
del visor.

**Reproducción.** Verificado avanzando de la foto 1 a la 3: el contador del
visor cambia (`1/8` → `3/8`) mientras el mosaico de fondo permanece idéntico y
en la misma posición.

**No depende del ancho de pantalla**, a diferencia de PROP-BUG-14: se
reproduce igual en escritorio y en móvil, así que el test corre en los dos
proyectos.

**Arreglo sugerido a desarrollo.** Cualquiera de las dos vías sirve, y el test
acepta ambas:

1. Fondo del visor totalmente opaco (`rgba(0, 0, 0, 1)`).
2. Ocultar el contenido de la página mientras el visor está abierto.

---

### PROP-BUG-14 — Bloque negro vacío en el mosaico de fotos

> **Severidad: Media** · Origen: testing manual · Tests: `tests/galeria.spec.ts`

**Qué pasa.** En el detalle de una propiedad con **5 fotos o más**, el mosaico
muestra una foto grande a la izquierda y una grilla 2×2 de miniaturas a la
derecha. La foto grande estira hasta el alto del contenedor; la grilla no.
Debajo de las miniaturas queda un bloque vacío que se ve como un rectángulo
negro ocupando media galería.

**Evidencia.** Medido sobre una propiedad de 9 fotos, en 1036px de ancho:

```jsonc
{
  "contenedor":          { "top": 73, "bottom": 793, "height": 720 },
  "fotoGrande":          { "top": 73, "bottom": 793 },   // llena el alto
  "miniaturas (2×2)":    { "top": 73, "bottom": 429 },   // se corta a mitad
  "huecoBajoMiniaturas": 364,                            // 51% del mosaico
}
```

**Condiciones.** El defecto depende de dos factores:

| Factor | Con hueco | Sin hueco |
|--------|-----------|-----------|
| Cantidad de fotos | 5 o más (mosaico 1 + 2×2) | 4 o menos |
| Ancho de pantalla | Escritorio | Móvil — el mosaico se apila en 1 columna |

Verificado: con 2 fotos el hueco es de 0px, y con el viewport de Pixel 7
(412px) también, porque la galería deja de tener dos columnas.

**Por qué se pudo automatizar sin comparación visual.** El defecto es una
diferencia de **coordenadas**, no de color: la columna derecha termina 364px
antes que el contenedor. Se mide con `getBoundingClientRect()`, sin baselines
de imagen y sin romperse cuando cambian las fotos del catálogo. Es la
diferencia con el hallazgo #5, que sí es de capas visuales.

**Arreglo sugerido a desarrollo.** Que la grilla de miniaturas estire al alto
del contenedor (`align-items: stretch` / `grid-template-rows: 1fr 1fr`), o que
el contenedor tome su alto del contenido en vez de fijarlo desde la foto
grande.

---

### PROP-BUG-11 — Un terreno exige habitaciones y baños

> **Severidad: Media** · Origen: hallazgo manual #11 · Tests: `tests/publicar.spec.ts`

La validación del paso 3 es **la misma para todos los tipos de propiedad**.
Con `propertyType: LAND`, habiendo completado título, descripción, precio y
m², el wizard sigue bloqueando el avance con:

```
Completá título, descripción, precio, habitaciones, baños y m².
```

Un terreno no tiene habitaciones ni baños. El usuario queda obligado a
inventar un dato o a no publicar. Los campos deberían ocultarse o dejar de ser
obligatorios según el tipo elegido.

---

### PROP-BUG-12 — Se piden aceptar términos que no se pueden leer

> **Severidad: Media** · Origen: hallazgo manual #13 · Tests: `tests/publicar.spec.ts`

El paso 5 exige marcar *"Acepto los términos y condiciones de publicación"*
para poder publicar. Ese texto **no enlaza a ningún contenido**: la fila es un
`<label>` con un checkbox y texto plano, y la pantalla completa no contiene
**ni un solo elemento `<a>`**.

No hay enlace, ni modal, ni texto desplegable. El usuario acepta un contrato
que no puede leer, lo que además de ser un problema de producto tiene
implicancias legales sobre la validez del consentimiento.

Se relaciona con lo visto en `/configuracion`, donde "Términos y condiciones"
figura como *"Próximamente"*: el contenido no existe todavía en ningún lado.
Aun así, el wizard ya lo exige como condición para publicar.

---

### PROP-BUG-08 — Falta concordancia de plural

> **Severidad: Baja** · Origen: verificación en vivo · **Sin automatizar, a propósito**

Con un solo resultado, la app escribe `"1 propiedades visibles"` en el mapa y
`"1 propiedades cerca tuyo"` en `/explorar`. Falta la forma singular.

**Por qué no se automatiza.** El defecto solo se ve con exactamente 1
resultado, y el conteo del mapa depende del encuadre: al cargar da 1, tras
aplicar un filtro el mapa se reencuadra y salta a 16, pasando además por un
estado intermedio ("Actualizando mapa..."). Forzarlo a 1 exigiría mockear la
API de propiedades, cuyos endpoints no están documentados
([§12](#12-roadmap)).

Con `test.fail()` un test así sería **peor que no tener test**: en las
corridas donde el conteo no fuera 1, el caso pasaría, Playwright lo reportaría
como *"passed unexpectedly"* y pondría la suite en rojo sin que nada se
hubiera roto. Para un defecto cosmético de severidad Baja, no compensa.

---

## 4. Hallazgos manuales pendientes de verificar

Quedan **3 de los 18** hallazgos originales sin verificar (#11 y #13 se
cerraron en la entrega 2). Se agrupan por **qué hace falta para probarlos**,
no por dónde aparecen:

Queda **1 de los 18** hallazgos originales sin cubrir:

| # | Hallazgo | Rol | Severidad | Bloqueo |
|---|----------|-----|-----------|---------|
| 8 | Editar publicación reusa el wizard; "Publicar" en el paso final no hace nada (aunque sí guarda) | owner | Alta | **C** — crear o mutar datos reales |

El bloqueo C sigue siendo caro **e irreversible**: hace falta una propiedad
propia con estado controlado, y sin `DELETE /properties/{id}` cualquier test
que cree una la deja para siempre.

### Reclasificado: el hallazgo #14 no era un defecto

El hallazgo manual #14 (*"con 2 fotos las flechas siguen habilitadas y al
presionar vuelve a la primera"*) se verificó y **el recorrido circular es
comportamiento correcto**, no un bug. Es el patrón estándar de carrusel
infinito, y acá está implementado de forma consistente:

| Comprobación | Resultado |
|--------------|-----------|
| Última foto + "siguiente" | Vuelve a la primera (`2/2` → `1/2`) |
| Primera foto + "anterior" | Va a la última (`1/2` → `2/2`) |
| Flechas en los extremos | Siempre habilitadas, en ambas galerías |
| Carrusel en línea vs. visor | Se comportan igual |
| Contador `N / M` | Presente y actualizado en cada paso |

El contador es lo que evita la desorientación: el usuario siempre sabe en qué
foto está, así que el ciclo no lo pierde. No hay inconsistencia entre las dos
galerías, que era lo único que habría convertido esto en un defecto real.

Se comprobó además que los controles del carrusel oculto en escritorio están
en `display: none`, con lo que salen del orden de tabulación y del árbol de
accesibilidad — no quedan controles fantasma.

El comportamiento quedó **fijado como regresión** en `galeria.spec.ts`
(GAL-04), por la misma razón que MAP-01: fue reportado como posible defecto, y
si alguien lo "arregla" deshabilitando las flechas en los extremos, el cambio
pasaría inadvertido.

> ✅ **El bloqueo D no existía.** El hallazgo #5 estaba clasificado como
> "necesita comparación visual, assertion de píxeles". Al verificarlo resultó
> ser un problema de **estilos computados**, no de píxeles: el fondo del visor
> tiene alpha `0.94` y el mosaico de la página sigue visible detrás. Se aserta
> leyendo `backgroundColor` y `visibility`, sin baselines de imagen. Quedó
> cubierto como PROP-BUG-15.
>
> Es la segunda vez en esta ronda que un defecto "visual" resulta medible por
> DOM (la primera fue PROP-BUG-14, por geometría). **La suite no necesita
> comparación visual por ahora**, y conviene agotar geometría y estilos
> computados antes de abrir esa pista, que es bastante más cara de mantener.

> ⚠️ **Corrección: el bloqueo B no existía como se describió.** Una versión
> anterior clasificó #11 y #13 como *"recorrer el wizard sin publicar; no crea
> datos"*. Es **falso**: abrir el wizard crea una propiedad en el servidor de
> inmediato (PROP-BUG-13). La suposición era razonable pero no verificada, y
> de haberse implementado así, cada corrida habría dejado una propiedad basura
> irreversible.
>
> Se resolvió sembrando el estado del wizard en `localStorage` y entrando al
> paso por su URL, lo que se verificó que produce **cero escrituras**. Los dos
> hallazgos quedaron cubiertos sin generar datos.

**Sobre el bloqueo C, ahora peor de lo estimado.** Además de no haber OpenAPI
publicado (`/docs`, `/swagger`, `/openapi.json` → 404), se comprobó que
**`DELETE /properties/{id}` no existe**. Eso descarta la *property factory con
limpieza*: cualquier test que cree una propiedad la deja para siempre.

Quedan dos caminos, y ninguno es gratis:

1. **Propiedades fixture pre-creadas** que los tests leen y editan pero nunca
   borran. Viable hoy, pero #8 consiste precisamente en verificar que una
   edición se guarda, así que el test muta la fixture y hay que dejarla en un
   estado conocido al terminar.
2. **Pedir a desarrollo el endpoint `DELETE`** (o un `status: DRAFT`), que es
   lo que arreglaría PROP-BUG-13 de todos modos.

**Recomendación:** reportar PROP-BUG-13 primero y esperar el `DELETE`. Es el
mismo arreglo que desbloquea la automatización y que resuelve el defecto, así
que conviene no construir infraestructura para esquivarlo.

**Sobre el bloqueo D.** El hallazgo #5 es de capas visuales: el elemento está
presente y visible, el problema es cómo se pinta. No hay assertion de DOM
razonable; es el caso de uso de `toHaveScreenshot()`. Se recomienda abrir esa
pista solo si aparecen más defectos visuales — con uno solo, mantener
baselines por proyecto no se paga.

### Reclasificado: el hallazgo #6 no era un defecto

El hallazgo manual #6 (*"revisar lógica de selección, ¿qué es Todos?"*) se
verificó en vivo y **no es un defecto funcional**. Los filtros del mapa son
**dos ejes independientes** que se renderizan idénticos y en la misma fila:

- Operación: `Todos` · `Alquiler` · `Venta`
- Tipo: `Casa` · `Depto` · `Terreno` · `Comercial`

Que "Todos" y "Casa" estén activos a la vez es correcto: son ejes distintos.
El filtrado funciona (elegir "Terreno" deselecciona "Casa" y el conteo cambia),
y el *"No hay propiedades visibles"* de la captura original se explica por el
encuadre del mapa, no por los filtros.

Lo que **sí** es válido del hallazgo es la confusión que reporta: dos ejes
con el mismo estilo visual y una etiqueta ambigua ("Todos" parece aplicar a
todo el conjunto de filtros, no solo a la operación). Es una observación de
**diseño de UX**, no un bug, y como tal se traslada a desarrollo sin test
asociado.

Investigarlo, eso sí, destapó dos defectos reales que sí se documentan:
PROP-BUG-08 y PROP-BUG-10. El comportamiento correcto quedó **fijado como
regresión** en `mapa.spec.ts`, para que nadie "arregle" el falso positivo
haciendo los filtros mutuamente excluyentes y rompa el filtrado combinado.

---

## 5. Hallazgos ya corregidos

Verificado el 2026-07-27: desarrollo corrigió parte de lo reportado en la
ronda manual. **No hace falta automatizarlos ni reportarlos.**

| # | Hallazgo original | Estado actual |
|---|-------------------|---------------|
| 4, 10, 17 | `/configuracion` → 404 | ✅ Implementada, con secciones Cuenta / Preferencias / Legal |
| — | Términos y condiciones sin destino, dentro de Configuración | ✅ Figuran como botones deshabilitados con la etiqueta "Próximamente" |
| 3 | El chat de mensajes aparecía vacío | ✅ Los mensajes cargan correctamente (el indicador sigue en "Desconectado", a revisar) |

> ⚠️ **Corrección.** Una versión anterior de este documento daba por cerrado
> también el enlace del menú de perfil a `/terminos` y `/ayuda`. Era
> **incorrecto**: se había verificado solo el rol `client`. En el perfil del
> **agente** esos accesos siguen presentes y llevan al 404. Ver PROP-BUG-07
> en [§3](#3-defectos-en-detalle).
>
> La lección de método vale para toda la suite: **en una app cuya UI cambia
> por rol, verificar un rol no cierra un defecto.** Los tres roles se
> comprueban por separado o el hallazgo queda abierto.

### ✅ PROP-BUG-02 — `column "published_at" does not exist` (corregido)

> Era **Crítica** · Origen: análisis UX + hallazgos manuales #15, #16 y #18
> · Corregido el 2026-07-28 · Tests: `navigation.spec.ts`, `profile.spec.ts`,
> `perfil-agente.spec.ts`, `agente-perfil-publico.spec.ts`

**Qué pasaba.** Una migración pendiente en el backend hacía que toda query
sobre la tabla de agentes fallara con un error de PostgreSQL, en **dos
endpoints distintos** y con el mismo mensaje byte por byte:

```jsonc
GET /auth/me                        → 500
GET /agents/users/{id}/public       → 500
{"statusCode":500,"code":"42703","message":"column \"published_at\" does not exist"}
```

**Los cuatro síntomas que resultaron ser este mismo defecto:**

| Síntoma observado | Dónde se vio |
|---|---|
| Recargar como agente cierra la sesión y rompe la nav | Análisis UX |
| "Ver perfil completo" del publicador → "Perfil no encontrado" | Manual #15 |
| "Ver perfil del agente" desde solicitudes → "Perfil no encontrado" | Manual #18 |
| Guardar el teléfono muestra "Error actualizando perfil" pero el dato sí se guarda | Manual #16 |

**El síntoma más engañoso fue el del teléfono.** El `PATCH` del perfil siempre
funcionó —el dato quedaba guardado—, pero la app llamaba después a `/auth/me`
para refrescar el usuario, y *esa* llamada devolvía el 500. La UI lo traducía
a un genérico "Error actualizando perfil". De ahí la contradicción que anotó
la ronda manual: *"muestra mensaje de error. No obstante guardó el numero"*, y
el *"en otros perfiles no me sucedió"* — solo el rol agente disparaba el 500.

Cuando se aplicó la migración, ese toast desapareció **sin que se tocara el
código del perfil**, lo que confirmó el diagnóstico a posteriori.

**Cómo se detectó el arreglo: exactamente como estaba diseñado.** En la
corrida del 2026-07-28 los 5 casos que vigilaban este defecto empezaron a
reportar *"Expected to fail, but passed"*. No hubo que revisar la app a mano
ni enterarse por el equipo de desarrollo: la suite avisó sola. Se verificó
contra la API (`GET /agents/users/{id}/public` → `200`), se les quitó el
`test.fail()` y pasaron a vigilar que el arreglo no se revierta.

Es la justificación práctica de usar `test.fail()` en vez de `test.skip()` o
de comentar los casos: un defecto documentado con `skip` se olvida; uno con
`fail` avisa el día que se arregla.

**Lo que este arreglo *no* cierra.** PROP-BUG-06 sigue vigente. La migración
era el disparador, pero el defecto de fondo —que el cliente trate un 5xx como
un 401 y borre las credenciales— sigue ahí. Sus tests simulan el 500 con
`page.route()` en vez de apoyarse en la migración rota, precisamente para que
siguieran cubriendo el problema después de este arreglo.

---

## 6. Roles y credenciales QA

| Rol | Email | Etiqueta en `/perfil` | Navegación inferior |
|-----|-------|----------------------|---------------------|
| Explorador | `qa.client@propie.app` | Explorador | Explorar, Favoritos, Visitas, Mensajes, Perfil |
| Propietario | `qa.owner@propie.app` | Propietario | Explorar, Publicar, Mis Props., Mensajes, Perfil |
| Agente | `qa.agent@propie.app` | Agente | Explorar, Publicar, Mis Props., Mensajes, Perfil |

Los 3 usuarios comparten contraseña, que **no está versionada**: se lee de la
variable de entorno `PROPIE_QA_PASSWORD` (ver [`.env.example`](../.env.example)
y [`src/data/users.ts`](../src/data/users.ts)). Este repositorio es público y
las cuentas apuntan a un sitio realmente desplegado, así que una contraseña en
el código sería una credencial funcional al alcance de cualquiera.

> La pantalla de login está en **`/ingresar`**, no en `/login` (esa ruta
> devuelve 404).

---

## 7. Alcance

**Dentro de alcance**

- Autenticación por rol (login exitoso, validación de formulario).
- Navegación inferior: diferencias reales por rol.
- Perfil: etiqueta de rol correcta, logout.
- Listado público de propiedades (`/explorar` sin sesión).
- Persistencia y aislamiento de favoritos entre sesiones.
- Resiliencia de la sesión ante errores del backend.
- Navegación de la bandeja de mensajes.
- Contrato de la API del perfil público de agentes.
- Perfil del agente: guardado de datos y accesos del menú.
- Filtros del mapa: ejes de filtrado y exposición accesible del estado.
- Nombre accesible de los botones de acción del detalle de propiedad.
- Validaciones del wizard de publicación (pasos 3 y 5), sin crear datos.
- Maquetado del mosaico de fotos y del visor del detalle de propiedad.
- Los defectos vigentes de [§2](#2-defectos-resumen-ejecutivo), como regresión trazada.

**Fuera de alcance (por ahora — ver [§12](#12-roadmap))**

- Flujo de publicación de propiedad (owner/agent) y todo lo que depende de él
  (los hallazgos de [§4](#4-hallazgos-manuales-pendientes-de-verificar)).
- Contenido de Favoritos, Visitas y Mensajes más allá de la navegación.
- Filtros de búsqueda funcionales (hoy solo se verifica que son visibles).
- Casos negativos de login con mensaje de error verificado: **no se confirmó
  el texto exacto** del mensaje con credenciales inválidas, y no se debe
  fabricar sin verificarlo primero.

---

## 8. Enfoque y arquitectura

### Patrón

Page Object Model + componentes reutilizables (`BottomNavComponent`), con
fixtures que inyectan los Page Objects ya instanciados para que los tests se
lean a nivel de negocio.

```
src/
├── data/users.ts              Usuarios QA y rutas de storageState
├── fixtures/test-fixtures.ts  Inyección de Page Objects
├── pages/                     BasePage, Login, Explorar, Perfil, Mensajes
│   └── components/            BottomNavComponent
└── utils/session.ts           Helpers de localStorage y decodificación de JWT
```

### Selección de elementos

Propie **no expone `data-testid`**. Se usan `getByRole` / `getByText` con
**`exact: true` obligatorio**: sin él, el `name` de `getByRole` matchea por
substring y confunde el botón "Favoritos" de la barra de navegación con el
botón "Agregar a favoritos" de cada tarjeta.

### Autenticación multi-rol

No hay un único `storageState`: hay **3, uno por rol**, generados en
`auth.setup.ts`. Cada `describe` aplica el suyo con
`test.use({ storageState: STORAGE_STATE[rol] })`. Nunca se reutiliza el
storageState de un rol para otro.

### Overlays que interceptan clicks

`BasePage.dismissOverlaysIfPresent()` los descarta por defecto tras cada
`goto()`, **esperando a que monten** antes de decidir que no están presentes
(montan unos cientos de ms después de la navegación; sin esa espera, el chequeo
llega antes de que existan y el overlay queda vivo para romper el siguiente
click). Los tests de regresión de PROP-BUG-01 y 03 evitan deliberadamente este
helper para poder probar el defecto.

### Defectos conocidos como regresión activa

Se usa **`test.fail()`** en vez de omitir o comentar el caso. Esto significa:

- Mientras el bug exista, el test "falla como se espera" y **la suite queda en
  verde**.
- El día que lo arreglen, el test **pasa inesperadamente y la suite se pone
  roja** — es la señal automática de que hay que quitar el `test.fail()`.

Es la diferencia entre un bug documentado que se olvida y uno que la CI
vigila. En el reporte JUnit estos casos aparecen con una `<property name="fail">`
que explica el defecto.

#### ⚠️ El riesgo de `test.fail()`: pasar por el motivo equivocado

`test.fail()` marca el caso como correcto si **cualquier cosa** falla, no solo
la aserción que vigila el defecto. Un test cuyo *setup* se rompe —un locator
que ya no existe, un timeout al abrir una pantalla— se sigue reportando en
verde, y la suite aparenta cubrir algo que en realidad nunca llegó a probar.

Pasó de verdad en esta suite: GAL-02 y GAL-03 daban verde en `mobile-chrome`
mientras fallaban al abrir el visor, sin llegar nunca a medir el fondo. La
causa era que el botón "Ver las N fotos" existe en el DOM en móvil pero está
`display: none`, así que el click expiraba. Se detectó de casualidad, al
agregar un test **sin** `test.fail()` (GAL-04) que falló en el mismo punto y
delató el problema.

De ahí tres reglas para esta suite:

1. **Cada caso con `test.fail()` debería tener al menos un caso hermano sin
   `test.fail()`** que recorra el mismo setup. Si el setup se rompe, ese caso
   lo grita.
2. **Verificar los locators en los dos proyectos**, no solo en escritorio. Un
   elemento oculto por CSS sigue existiendo en el DOM: `getByTestId` lo
   encuentra, y solo la comprobación de visibilidad de Playwright lo delata.
3. **Nunca activar controles con `click()` por JavaScript** para sortear un
   elemento oculto. Activa el botón, sí, pero prueba algo que un usuario real
   no puede hacer. Fue exactamente lo que ocultó este problema durante la
   exploración manual con MCP.

**Pendiente:** los demás casos con `test.fail()` no se auditaron con este
criterio. Conviene correrlos una vez con el `test.fail()` desactivado y
comprobar que el error que reportan es su aserción y no un fallo de setup.

### Por qué se siembra estado en vez de crearlo por UI

El `baseURL` es un **entorno desplegado y compartido**, así que la suite evita
crear datos por UI siempre que el defecto bajo prueba no lo exija. Se aplica
en dos lugares, por razones distintas:

**Favoritos (PROP-BUG-04).** Se siembran con `addInitScript` en lugar de
marcarlos con un click. El defecto no es "el botón marca el favorito" (eso
funciona) sino "el logout no limpia esta clave", así que sembrar es el nivel
de aislamiento correcto y evita dejar residuo si el test falla a mitad.

**Wizard de publicación (PROP-BUG-11 y 12).** Aquí no es una preferencia,
es una necesidad: **abrir `/publicar` crea una propiedad real e irreversible**
en el servidor (PROP-BUG-13, sin `DELETE` en la API). Recorrer el wizard en
cada corrida dejaría una propiedad basura por ejecución.

La solución es sembrar el borrador en `localStorage.property-publish` y entrar
al paso por su URL (`/publicar/informacion`, `/publicar/revision`). Se
verificó en vivo que así el paso renderiza, conserva el tipo de propiedad y
**no genera ningún `propertyId`**, es decir, cero escrituras. El detalle está
en el comentario de `PublicarPage`.

Es un intercambio consciente: se pierde la cobertura de las transiciones entre
pasos a cambio de que la suite no genere datos irreversibles. `publicar.spec.ts`
incluye además un test de control (PUB-02) que verifica que no se creó ninguna
propiedad; si empieza a fallar, hay que revisar la estrategia de siembra
**antes** de volver a correr la suite completa.

### El wizard sí tiene `data-testid`

A diferencia del resto de la app, el wizard de publicación expone
`data-testid`: `publish-wizard`, `publish-wizard-body`, `publish-wizard-footer`
y `publish-wizard-cta`. Se usan donde existen — son mucho más estables que
localizar el botón "Continuar" por texto, que cambia de un paso a otro.

Vale la pena señalárselo a desarrollo: el patrón ya existe en el código, solo
hace falta extenderlo al resto de las pantallas.

---

## 9. Casos de prueba priorizados

| ID | Caso | Prioridad | Tag | Tipo | Archivo |
|----|------|-----------|-----|------|---------|
| LOG-01 | Login por rol (client/owner/agent) → `/explorar` | Crítica | smoke | Positivo | `login.spec.ts` |
| LOG-02 | Botón deshabilitado con campos vacíos | Alta | regression | Negativo | `login.spec.ts` |
| LOG-03 | PROP-BUG-01: el banner de instalación bloquea el login | Alta | regression | Defecto conocido | `login.spec.ts` |
| NAV-01 | Nav Explorador: Favoritos/Visitas, sin Publicar | Crítica | smoke | Funcional | `navigation.spec.ts` |
| NAV-02 | Nav Propietario: Publicar/Mis Props., sin Favoritos | Crítica | smoke | Funcional | `navigation.spec.ts` |
| NAV-03 | Nav de Agente: Publicar/Mis Props. (regresión de PROP-BUG-02) | Crítica | smoke | Funcional | `navigation.spec.ts` |
| PERF-01 | Etiqueta de rol correcta en `/perfil` | Alta | smoke | Funcional | `profile.spec.ts` |
| PERF-02 | Logout vuelve a `/explorar` sin sesión | Crítica | smoke | Funcional | `profile.spec.ts` |
| PERF-03 | PROP-BUG-03: el banner de ubicación bloquea el logout | Media | regression | Defecto conocido | `profile.spec.ts` |
| PERF-04 | Recargar `/perfil` no cierra la sesión del agente (regresión de PROP-BUG-02) | Crítica | regression | Funcional | `profile.spec.ts` |
| EXP-01 | El listado de propiedades carga sin sesión | Alta | smoke | Funcional | `explorar.spec.ts` |
| EXP-02 | Filtros Todos/Alquiler/Venta visibles | Media | smoke | Funcional | `explorar.spec.ts` |
| **FAV-01** | PROP-BUG-04: cerrar sesión debe limpiar los favoritos locales | **Crítica** | regression | Defecto conocido | `favoritos.spec.ts` |
| **FAV-02** | PROP-BUG-04: sin sesión ninguna tarjeta debe figurar como favorita | **Crítica** | regression | Defecto conocido | `favoritos.spec.ts` |
| **FAV-03** | PROP-BUG-04: un usuario no debe heredar los favoritos de otro | **Crítica** | regression | Defecto conocido | `favoritos.spec.ts` |
| **SES-01** | PROP-BUG-06: un 500 de `/auth/me` no debe borrar las credenciales | **Crítica** | regression | Defecto conocido | `sesion-resiliencia.spec.ts` |
| **SES-02** | PROP-BUG-06: un 500 de `/auth/me` no debe expulsar de `/perfil` | **Crítica** | regression | Defecto conocido | `sesion-resiliencia.spec.ts` |
| **AGT-01** | `GET /agents/users/{id}/public` responde 200 (regresión de PROP-BUG-02) | Crítica | regression | Contrato de API | `agente-perfil-publico.spec.ts` |
| **AGT-02** | La ficha pública del agente carga (regresión de PROP-BUG-02) | Crítica | regression | Funcional | `agente-perfil-publico.spec.ts` |
| **MSG-01** | PROP-BUG-05: "Volver" en la bandeja no debe devolver al chat | Alta | regression | Defecto conocido | `mensajes.spec.ts` |
| **AGT-03** | Guardar el teléfono no muestra error (regresión de PROP-BUG-02) | Alta | regression | Funcional | `perfil-agente.spec.ts` |
| **AGT-04** | PROP-BUG-07: el menú del agente no debe enlazar a rutas 404 | Alta | regression | Defecto conocido | `perfil-agente.spec.ts` |
| **PROP-01** | PROP-BUG-09: los botones de cabecera deben tener nombre accesible | Media | regression | Defecto conocido (a11y) | `propiedad-acciones.spec.ts` |
| **PROP-02** | PROP-BUG-09: el botón sin etiqueta debe hacer algo al pulsarlo | Media | regression | Defecto conocido | `propiedad-acciones.spec.ts` |
| **MAP-01** | Los filtros de operación y tipo son ejes independientes | Media | smoke | Funcional | `mapa.spec.ts` |
| **MAP-02** | PROP-BUG-10: los filtros deben exponer `aria-pressed` | Media | regression | Defecto conocido (a11y) | `mapa.spec.ts` |
| **PUB-01** | PROP-BUG-11: un terreno no debe exigir habitaciones ni baños | Media | regression | Defecto conocido | `publicar.spec.ts` |
| **PUB-02** | Abrir un paso del wizard no debe crear una propiedad | Crítica | regression | **Control de la suite** | `publicar.spec.ts` |
| **PUB-03** | PROP-BUG-12: los términos y condiciones deben ser consultables | Media | regression | Defecto conocido | `publicar.spec.ts` |
| **GAL-01** | PROP-BUG-14: las miniaturas deben llenar el alto del mosaico | Media | regression | Defecto conocido (layout) | `galeria.spec.ts` |
| **GAL-02** | PROP-BUG-15: el visor debe tapar por completo la página | Media | regression | Defecto conocido (layout) | `galeria.spec.ts` |
| **GAL-03** | PROP-BUG-15: avanzar de foto no debe dejar ver el fondo | Media | regression | Defecto conocido (layout) | `galeria.spec.ts` |
| **GAL-04** | El visor recorre las fotos en ciclo en ambos sentidos | Media | smoke | **Comportamiento correcto** | `galeria.spec.ts` |

En **negrita**, los casos incorporados a partir de la ronda de testing manual.

Tres casos merecen una nota porque no siguen el patrón del resto:

**MAP-01 y GAL-04** fijan comportamientos *correctos* que fueron reportados
como posibles defectos: los filtros del mapa como dos ejes independientes
(#6) y el recorrido circular del carrusel (#14). Existen para que nadie los
"arregle" —volviendo los filtros excluyentes, o deshabilitando las flechas en
los extremos— y rompa algo que funcionaba sin que ningún test se entere.

GAL-04 cumple además un segundo papel: al no llevar `test.fail()`, recorre el
mismo setup que GAL-02 y GAL-03 y delata cualquier fallo de apertura del
visor que aquellos enmascararían. Ver la advertencia sobre `test.fail()` en
[§8](#8-enfoque-y-arquitectura).

**PUB-02** no vigila a la app sino **a la propia suite**: verifica que abrir un
paso del wizard no crea una propiedad en el servidor. Es la condición de la que
depende que `publicar.spec.ts` no deje residuo irreversible. Por eso es el
único caso de prioridad Crítica que no corresponde a un defecto: si falla, el
riesgo no es un bug sin detectar, es que la suite empiece a ensuciar el
entorno compartido en cada corrida.

### Pirámide y tipos de prueba

- **Smoke (`@smoke`)** — login por rol, nav por rol, etiqueta de perfil,
  logout y listado público. Debe correr en cada push.
- **Regresión (`@regression`)** — validación de formulario y los defectos
  conocidos.
- **API** — AGT-01 valida el contrato del backend directamente, sin depender
  del render. Sirve para capturar el mensaje de error exacto para el reporte a
  desarrollo y para saber, el día que se arregle, si el fix fue de backend o
  de frontend.

---

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Sin `data-testid`: los locators por texto y rol son frágiles ante cambios de copy | `getByRole` + `exact: true`, centralizado en Page Objects y componentes: un único punto de mantenimiento |
| Overlays con montaje async interceptan clicks (PROP-BUG-01/03) | `dismissOverlaysIfPresent()` con espera corta antes de decidir ausencia; tests de regresión dedicados que no lo usan |
| El 500 de `/auth/me` rompe al agente en cualquier carga directa | Excluido de los tests "felices" por rol; regresión dedicada con `test.fail()` |
| 3 roles con sesión propia | `auth.setup.ts` genera 3 `storageState`; nunca se cruzan |
| El baseURL es un entorno compartido: los tests podrían dejar residuo | Se siembra estado con `addInitScript` en vez de crearlo por UI (ver [§8](#8-enfoque-y-arquitectura)) |
| El baseURL es un sitio real en Vercel, no un server local: varios workers en paralelo producen timeouts que no son bugs | `workers` limitado también en local (3), no solo en CI |
| Los tests de datos (MSG-01) dependen de que la cuenta QA tenga conversaciones | `test.skip()` explícito si no hay datos, para no dar un falso resultado |
| Los ids de usuario cambian si se recrean las cuentas QA | Se decodifican del JWT del `storageState` en vez de hardcodearse |
| Un caso con `test.fail()` puede pasar por un fallo de setup y no por su aserción | Cada grupo tiene al menos un caso sin `test.fail()` que recorre el mismo setup (ver [§8](#8-enfoque-y-arquitectura)) |
| **Vercel activa un *security checkpoint* (HTTP 403) ante volumen sostenido de peticiones, y llega a bloquear a la propia suite** | Ver [§11](#11-entornos-ejecución-y-criterios-de-salida). Bajar `workers`, espaciar las corridas y evitar `--repeat-each` sobre la suite entera |

---

## 11. Entornos, ejecución y criterios de salida

### Comandos

```bash
npm test                  # suite completa: chromium + mobile-chrome
npm run test:smoke        # solo @smoke
npm run test:regression   # solo @regression
npm run report            # abre el reporte HTML
```

### Configuración relevante

- **Storage state:** `.auth/{client,owner,agent}.json`, regenerado por el
  proyecto `setup` en cada corrida (no versionado).
- **Reporting:** HTML en `playwright-report/`, JUnit en `results/junit.xml`.
- **Workers:** limitados a 3 en local y 4 en CI. No es una preferencia: con el
  default de Playwright (~núcleos/2), varios workers golpeando el sitio real a
  la vez producen timeouts de navegación que no son bugs ni de la app ni de
  los tests.

### ⚠️ Límite de tasa de Vercel

El `baseURL` está detrás de la protección anti-bot de Vercel. Ante un volumen
sostenido de peticiones responde **HTTP 403 con un "Security Checkpoint"** en
lugar de la app, y **llega a bloquear a la propia suite**: cuando se activa,
hasta `auth.setup.ts` falla, porque la pantalla de login nunca se renderiza.

Cómo reconocerlo, para no confundirlo con una regresión:

- Fallan los 3 casos de `auth.setup.ts` con `TimeoutError` esperando el campo
  "Email".
- El `error-context.md` muestra un snapshot casi vacío (`main` sin contenido).
- Los fallos son transversales y no tienen relación entre sí.

Precauciones:

- **No encadenar corridas completas.** El bloqueo se agrava con cada intento;
  conviene esperar varios minutos entre ejecuciones.
- **No usar `--repeat-each` sobre la suite entera**, solo sobre specs
  concretos.
- Si el bloqueo se activó, bajar a `--workers=1` ayuda a recuperarse.
- `curl` **no sirve** para diagnosticarlo: siempre recibe 403 porque no
  ejecuta el desafío JavaScript. Hay que probar con un navegador real.

### Integración continua

La suite corre en GitHub Actions
([`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml)), con la
contraseña inyectada desde el secreto `PROPIE_QA_PASSWORD`.

El disparador principal es **programado (diario)**, no `push`. Es una
consecuencia directa de qué prueba esta suite: un sitio de terceros ya
desplegado, que cambia sin que este repositorio se entere. Ejecutarla en cada
push mediría el repo equivocado. Los `push` a `main` sí la disparan, pero solo
cuando cambia la suite en sí (`tests/`, `src/`, la config).

En CI se usa **1 worker** y `concurrency` sin corridas simultáneas: el volumen
en paralelo dispara la protección anti-bot de Vercel y produce falsos rojos.
La corrida tarda ~7 minutos, irrelevante para algo programado.

**Un build en rojo tiene tres lecturas distintas** en esta suite, y conviene
distinguirlas antes de tocar nada: un defecto arreglado
(`Expected to fail, but passed`), el checkpoint de Vercel (los 3 casos de
`auth.setup.ts` fallando juntos), o una regresión real. La tabla completa está
en el [README](../README.md#integración-continua).

### Criterios de entrada

`npm ci` + `npx playwright install` correctos, los 3 usuarios QA con
credenciales válidas, y el sitio respondiendo sin checkpoint activo.

### Criterios de salida (release)

1. **100% de `@smoke` en verde.**
2. Los defectos conocidos siguen fallando exactamente donde se espera. Si uno
   **"pasa inesperadamente"**, no es un error de la suite: es la señal de que
   se arregló. Hay que quitarle el `test.fail()` y moverlo a la tabla de
   [§5](#5-hallazgos-ya-corregidos).
3. Sin regresiones nuevas.

---

## 12. Roadmap

**Prioridad inmediata**

1. **Reportar a desarrollo** PROP-BUG-04 y PROP-BUG-06 (los dos críticos
   nuevos), con la evidencia de `localStorage` y el mensaje exacto del 500.
2. ✅ **PROP-BUG-02 corregido** el 2026-07-28. La suite lo detectó sola: los 5
   casos pasaron a reportar *"Expected to fail, but passed"*. Se les quitó el
   `test.fail()` y ahora vigilan que no se revierta.
   ⚠️ Ojo: **esto no cierra PROP-BUG-06**, que era el defecto de fondo.
3. **Reportar PROP-BUG-13 y pedir `DELETE /properties/{id}`.** Es el defecto
   que además bloquea la automatización de #8 y #14, así que tiene doble
   retorno. Hay que avisar también de que quedan propiedades huérfanas en las
   cuentas QA que hoy nadie puede eliminar.

**Ampliación de cobertura**

3. ✅ **Hecho** — `PublicarPage` y cobertura de #11 y #13 sembrando el estado
   del wizard, sin crear datos.
4. **Bloqueo C** — cerrar #8 y #14. **Depende de que exista
   `DELETE /properties/{id}`**, que hoy no existe. Es el mismo arreglo que
   resuelve PROP-BUG-13, así que conviene reportarlo y esperar en vez de
   construir infraestructura para esquivarlo. Si se decide avanzar antes, la
   única vía es usar propiedades fixture pre-creadas y devolverlas a un estado
   conocido al terminar cada test.
5. Confirmar y automatizar los mensajes de error de login inválido (el texto
   exacto **no está verificado**; no debe fabricarse).
6. Filtros de búsqueda: la búsqueda global devuelve 0 resultados para un
   término que sí está en el título de una propiedad ("Bodega"). Investigar
   si es un defecto o si busca solo por ubicación.
7. Revisar el indicador "Desconectado" persistente en el chat.

**Mantenimiento**

8. **Auditar los casos con `test.fail()`**: correrlos una vez con el
   `test.fail()` desactivado y comprobar que el error que reportan es su
   aserción y no un fallo de setup. Solo los de `galeria.spec.ts` se
   verificaron así (ver [§8](#8-enfoque-y-arquitectura)).
9. Cuando se arregle un defecto, quitar su `test.fail()` y moverlo a
   [§5](#5-hallazgos-ya-corregidos).
10. Pedir al equipo de desarrollo que agregue `data-testid`, `aria-label` en
   los botones de icono y `aria-pressed` en los filtros. Las tres carencias
   son el mismo problema de fondo —la app no expone estado semántico— y
   arreglarlas cerraría PROP-BUG-09, PROP-BUG-10 y el riesgo principal de
   mantenimiento de esta suite de una sola vez.

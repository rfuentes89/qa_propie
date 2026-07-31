# Tarjetas para Trello — defectos vigentes de Propie

Exportación desde [`TEST-STRATEGY.md`](./TEST-STRATEGY.md), lista para copiar y
pegar. Cada bloque es una tarjeta: la línea `##` es el título y lo que sigue es
la descripción (Trello renderiza este markdown).

**Etiquetas sugeridas:** `Crítica` · `Alta` · `Media` · `Baja` — y por área:
`backend`, `frontend`, `a11y`, `datos`, `chat`.

| # | Defecto | Severidad | Área |
|---|---------|-----------|------|
| 1 | PROP-BUG-04 · Fuga de favoritos entre usuarios | Crítica | frontend · datos |
| 2 | PROP-BUG-06 · Un 5xx cierra la sesión | Crítica | frontend |
| 3 | PROP-BUG-16 · La API dice que se puede escribir y después rechaza con 403 | Alta | backend · chat |
| 4 | PROP-BUG-17 · El mensaje falla en silencio | Alta | frontend · chat |
| 5 | PROP-BUG-13 · Propiedades fantasma imposibles de borrar | Alta | backend · datos |
| 6 | PROP-BUG-05 · Bucle en Mensajes | Alta | frontend |
| 7 | PROP-BUG-01 · El banner PWA bloquea el login | Alta | frontend |
| 8 | PROP-BUG-07 · El perfil del agente enlaza a 404 | Alta | frontend |
| 9 | PROP-BUG-03 · El aviso de ubicación intercepta clicks | Media | frontend |
| 10 | PROP-BUG-09 · Botones de icono sin nombre accesible | Media | a11y |
| 11 | PROP-BUG-18 · El cliente se ve a sí mismo como interlocutor | Media | backend · chat |
| 12 | PROP-BUG-19 · "Desconectado" permanente, sin websocket | Media | frontend · chat |
| 13 | PROP-BUG-10 · Los filtros del mapa no exponen su estado | Media | a11y |
| 14 | PROP-BUG-11 · Un terreno exige habitaciones y baños | Media | frontend |
| 15 | PROP-BUG-12 · Términos que no se pueden leer | Media | frontend · legal |
| 16 | PROP-BUG-14 · Bloque negro en el mosaico de fotos | Media | frontend |
| 17 | PROP-BUG-15 · El visor deja ver la página detrás | Media | frontend |
| 18 | PROP-BUG-08 · Falta concordancia de plural | Baja | frontend |
| 19 | PROP-BUG-20 · Enter no envía el mensaje | Baja | frontend · chat |

> 💡 **PROP-BUG-16 y 17 se arreglan juntos.** Uno es el contrato del backend y
> el otro el manejo del error en el frontend. Cerrar solo uno deja al usuario
> a medias: o sigue sin poder escribir, o sigue sin enterarse de que falló.

> 💡 **PROP-BUG-13 tiene doble retorno**: el endpoint `DELETE` que pide es
> además lo que desbloquea automatizar el último hallazgo sin cubrir.
>
> 💡 **PROP-BUG-09 y PROP-BUG-10 comparten causa** con la falta de
> `data-testid`: la app no expone estado semántico. Se pueden atacar juntas.

---

## [PROP-BUG-04] Los favoritos se filtran entre usuarios y sobreviven al logout

**Severidad:** Crítica · **Área:** frontend / datos

### Qué pasa

Los favoritos se guardan en una única clave de `localStorage`,
`propie_favorite_property_ids`, que **no lleva el id del usuario** y **no se
borra al cerrar sesión**. En un navegador compartido, quien entra después ve
qué propiedades marcó la persona anterior.

### Pasos para reproducir

1. Iniciar sesión como `qa.client`, marcar una propiedad como favorita.
2. Cerrar sesión desde `/perfil`.
3. Sin volver a iniciar sesión, abrir `/explorar`.
4. La propiedad sigue marcada (`aria-label="Quitar de favoritos"`).
5. Iniciar sesión con otro usuario: hereda los favoritos del anterior.

### Evidencia

Estado de `localStorage` inmediatamente después del logout:

```json
{
  "accessToken":  null,
  "refreshToken": null,
  "propie_favorite_property_ids": "[\"8f2fbcee…\",\"11ca6adc…\",\"c88f5a56…\"]"
}
```

El logout sí borra las credenciales; la clave de favoritos queda intacta.

### Impacto

Fuga de datos personales entre usuarios en cualquier equipo compartido
—locutorio, oficina, computadora familiar—. Es el defecto de mayor severidad
de esta ronda.

### Arreglo sugerido

Namespacear la clave por usuario (`propie_favorites_{userId}`) y borrarla
explícitamente en el handler de logout, junto con los tokens.

### Vigilado por

`tests/favoritos.spec.ts` (FAV-01, FAV-02, FAV-03)

---

## [PROP-BUG-06] Un error 5xx del backend cierra la sesión y borra las credenciales

**Severidad:** Crítica · **Área:** frontend

### Qué pasa

Cuando `GET /auth/me` devuelve **500**, la app no distingue "el servidor
falló" de "tus credenciales no valen". Reacciona como ante un 401: **borra
`accessToken` y `refreshToken`** de `localStorage` y redirige a `/explorar`.

### Pasos para reproducir

1. Iniciar sesión con cualquier rol.
2. Forzar que `GET /auth/me` responda 500 (interceptando la respuesta).
3. Navegar a `/perfil` con carga completa de página.
4. La sesión se pierde y los tokens desaparecen de `localStorage`.

### Evidencia

```
GET /auth/me → 500
        ↓
localStorage.accessToken → borrado
URL → /explorar
```

### Impacto

**Cualquier caída pasajera del backend desloguea a todos los usuarios
conectados**: un deploy, un timeout, un pico de carga. Y como también borra el
`refreshToken`, la app pierde la capacidad de renovar la sesión sola: el
usuario tiene que volver a escribir sus credenciales.

Este defecto ya se manifestó en producción a través de PROP-BUG-02 (la
migración faltante), que **ya fue corregido**. Pero esa migración era solo el
disparador: el manejo de errores sigue igual y volverá a morder con el próximo
incidente de backend.

### Arreglo sugerido

Cerrar sesión solo ante 401/403. Ante 5xx, mantener las credenciales y mostrar
un estado de error recuperable con opción de reintentar.

### Vigilado por

`tests/sesion-resiliencia.spec.ts` (SES-01, SES-02)

---

## [PROP-BUG-16] La API declara la conversación escribible y después rechaza el envío con 403

**Severidad:** Alta · **Área:** backend / chat

### Qué pasa

El detalle de una conversación dice que se puede escribir en ella, y el envío
falla con 403.

### Pasos para reproducir

```
GET  /property-conversations/{id}
     → { "status": "OPEN", "readOnly": false }

POST /property-conversations/{id}/messages
     → 403 { "code": "CHAT_DISABLED",
             "message": "Chat is disabled for this property" }
```

### Evidencia

Probadas las 3 conversaciones de `qa.client`: **2 de 3 fallan**.

| Conversación | Propiedad | `readOnly` | POST |
|---|---|---|---|
| `fd2075ec…` | Casa | `false` | ❌ 403 `CHAT_DISABLED` |
| `2e3a58f5…` | Departamento 2 dormitorios | `false` | ✅ 201 |
| `a829d4b6…` | Departamento 1 dormitorio Centro | `false` | ❌ 403 `CHAT_DISABLED` |

### Impacto

`readOnly` es el contrato del que depende el frontend para decidir si habilita
el compositor. Mientras mienta, **cualquier cliente de esa API va a ofrecer
escribir donde no se puede**.

### Arreglo sugerido

Que `readOnly` (o un `chatEnabled` equivalente) refleje la misma condición que
evalúa el `POST`. La regla ya existe en el backend; falta exponerla en el `GET`.

> Se arregla junto con **PROP-BUG-17**: este es el contrato, aquel es el error
> que el frontend no muestra.

---

## [PROP-BUG-17] Enviar un mensaje puede fallar sin que el usuario se entere

**Severidad:** Alta · **Área:** frontend / chat

### Qué pasa

Cuando el `POST` del mensaje falla, la UI **no muestra nada**. El texto
desaparece del compositor, no aparece ninguna burbuja y no hay ningún aviso:
para el usuario, el mensaje se envió.

### Pasos para reproducir

1. Iniciar sesión como `qa.client` y abrir una conversación con el chat
   deshabilitado (p. ej. `/mensajes/fd2075ec-3741-4208-b24f-9607917b86cd`).
2. Escribir un mensaje y pulsar el botón de enviar.
3. El texto se borra y no pasa nada más.

### Evidencia

```
→ POST /property-conversations/{id}/messages
← 403
[consola] Failed to load resource: the server responded with a status of 403
[consola] Error sending message {success: false, error: Object}
```

El error existe y la app lo registra. Simplemente no lo comunica.

### Impacto

Es el peor modo de fallo posible para un chat: el usuario cree haber contactado
a la otra parte y espera una respuesta que nunca va a llegar, porque el mensaje
nunca existió. En un marketplace inmobiliario, es una consulta comercial
perdida sin que nadie se entere.

### Arreglo sugerido

Mostrar el error, **conservar el texto** en el compositor para no perder lo
escrito, y ofrecer reintentar. Si la causa es `CHAT_DISABLED`, deshabilitar el
compositor de entrada y explicar por qué.

---

## [PROP-BUG-18] El cliente se ve a sí mismo como su interlocutor en el chat

**Severidad:** Media · **Área:** backend / chat

### Qué pasa

En la bandeja y en la cabecera del chat, al cliente se le muestra **su propio
rol y su propio nombre** como contraparte: `Cliente · qa Propie`.

### Pasos para reproducir

1. Iniciar sesión como `qa.client` y abrir `/mensajes`.
2. Entrar a cualquier conversación.
3. La cabecera dice "Cliente · …" en lugar del propietario o el agente.

### Evidencia

La misma conversación, consultada con los tres tokens, devuelve un payload
**idéntico**:

```json
{ "headerParticipantRole": "CLIENT",
  "headerParticipantName": "qa Propie",
  "inboxRoleLabel": "Cliente" }
```

Los tres usuarios tienen ids y roles distintos (`a4a36938`/CLIENT,
`36516c49`/OWNER, `ad5337ed`/AGENT), así que no es coincidencia de datos: el
campo se calcula **desde la conversación**, no relativo a quién la mira.

Para owner y agent el resultado es correcto —hablan con un cliente—. Para el
cliente es incorrecto.

### Arreglo sugerido

Resolver `headerParticipant*` e `inboxRoleLabel` en función del usuario
autenticado: mostrar siempre *la otra* parte.

---

## [PROP-BUG-19] El chat muestra "Desconectado" siempre y no abre websocket

**Severidad:** Media · **Área:** frontend / chat

### Qué pasa

El indicador de presencia muestra "Desconectado" incluso con la contraparte
conectada y mirando la misma conversación.

### Pasos para reproducir

1. Abrir la misma conversación con dos usuarios a la vez, en sesiones
   distintas (`qa.client` y `qa.owner`).
2. Ambos siguen viendo "Desconectado".

### Evidencia

```
presencia → client: Desconectado | owner: Desconectado
websockets abiertos al entrar al chat: ninguno
```

Tampoco se observó *polling* tras el envío: la única petición fue el `POST`.

### Impacto

El indicador es decorativo y además **desinforma**: sugiere que la otra parte
no está disponible cuando sí lo está.

> ⚠️ **Sin confirmar:** que los mensajes no lleguen en tiempo real es una
> inferencia de que no hay websocket, no una medición. No se pudo verificar de
> punta a punta porque la única conversación entre dos cuentas QA tiene el chat
> deshabilitado (PROP-BUG-16).

### Arreglo sugerido

Conectar el websocket, o —si la entrega en vivo no está en alcance todavía—
quitar el indicador en vez de mostrar un estado falso.

---

## [PROP-BUG-13] Abrir el wizard crea una propiedad ACTIVE sin título, imposible de borrar

**Severidad:** Alta · **Área:** backend / datos

### Qué pasa

Con solo abrir `/publicar` y avanzar del paso 1, la app **crea un registro de
propiedad en el servidor**, antes de que el usuario haya escrito un título o
un precio. Si abandona el wizard, ese registro queda huérfano y **no hay forma
de eliminarlo**.

### Pasos para reproducir

1. Iniciar sesión como `qa.owner`.
2. Entrar a `/publicar`, elegir operación, tipo y dirección, y pulsar Continuar.
3. Abandonar el wizard.
4. Abrir "Mis Propiedades": aparece una entrada `US$ 0 · Activa`, sin título ni
   fecha, y **sin el combo de estado** que tienen las demás.

### Evidencia

```
GET    /properties/d74bab4c-… → 200
{ "status": "ACTIVE", "title": null }

DELETE /properties/d74bab4c-… → 404
{ "message": "Route DELETE:/properties/d74bab4c-… not found" }
```

| Vía | ¿Permite eliminarlo? |
|-----|----------------------|
| API `DELETE /properties/{id}` | ❌ el endpoint no existe |
| UI, combo de estado | ❌ no se renderiza para estos registros |
| UI, alguna acción de borrado | ❌ no existe |

### Impacto

Cada wizard abandonado ensucia permanentemente "Mis Propiedades" del usuario.
**Atenuante:** el catálogo público los filtra (`GET /properties` devolvió 17
propiedades, ninguna sin título), así que el daño no llega a los compradores.

Hay al menos dos registros huérfanos en las cuentas QA que hoy nadie puede
eliminar.

### Arreglo sugerido

Crear el registro recién al publicar, o crearlo con estado `DRAFT` que no
aparezca en "Mis Propiedades". En cualquier caso, **exponer
`DELETE /properties/{id}`**.

> ⚠️ Este arreglo tiene doble retorno: el endpoint `DELETE` es también lo que
> desbloquea automatizar el último hallazgo del testing manual sin cubrir
> (editar una publicación no guarda al pulsar "Publicar").

### Vigilado por

`tests/publicar.spec.ts` (PUB-02)

---

## [PROP-BUG-05] Bucle de navegación entre la bandeja de mensajes y el chat

**Severidad:** Alta · **Área:** frontend

### Qué pasa

El botón "Volver" de la cabecera de `/mensajes` hace un `history.back()` ciego
en vez de navegar a una ruta explícita. Si el usuario llegó a la bandeja
saliendo de un chat, ese back lo devuelve al chat.

### Pasos para reproducir

1. Iniciar sesión como `qa.client` y abrir `/mensajes`.
2. Entrar a una conversación.
3. Salir con el botón de volver del chat → vuelve a la bandeja. ✅
4. Pulsar "Volver" en la cabecera de la bandeja → **reentra al chat**. ❌
5. Se puede repetir indefinidamente.

### Evidencia

```
/mensajes  ──abre conversación──▶  /mensajes/{id}
    ▲                                    │
    └────────botón del chat ◀────────────┘
    │
    └──botón "Volver" ──▶ /mensajes/{id}   ❌ vuelve a entrar
```

Reproducido de forma determinista 2/2.

### Impacto

El usuario queda atrapado alternando entre dos pantallas. La única salida es
la barra de navegación inferior, que no es una vía evidente.

### Arreglo sugerido

Que "Volver" navegue a una ruta explícita (`/explorar` o la pantalla de
origen) en lugar de delegar en el historial del navegador.

### Vigilado por

`tests/mensajes.spec.ts` (MSG-01)

---

## [PROP-BUG-01] El banner "Instalar Propie" bloquea el botón de login

**Severidad:** Alta · **Área:** frontend

### Qué pasa

El banner PWA **intercepta los clicks** del botón "Iniciar sesión" mientras
está montado, en vez de dejar pasar el evento al contenido de debajo.

### Pasos para reproducir

1. Abrir `/ingresar` en un contexto limpio.
2. Esperar a que aparezca el banner "Instalar Propie" (monta con un retraso).
3. Completar email y contraseña.
4. Pulsar "Iniciar sesión": el click no llega al botón.

### Evidencia

```
<p>Instalar Propie</p> from <div>…</div> subtree intercepts pointer events
```

### Impacto

Cualquier usuario cuyo navegador dispare el prompt de instalación justo al
loguearse queda bloqueado, **sin ninguna pista visual** de por qué el botón no
responde.

### Arreglo sugerido

Que el banner no capture pointer events fuera de sus propios controles
(`pointer-events: none` en el contenedor, `auto` en los botones), o que no se
superponga al formulario.

> Comparte causa con PROP-BUG-03: los dos overlays interceptan clicks en vez
> de degradar con gracia. Probablemente compartan componente base y convenga
> revisarlos juntos.

### Vigilado por

`tests/login.spec.ts` (LOG-03)

---

## [PROP-BUG-07] El perfil del agente enlaza a rutas que responden 404

**Severidad:** Alta · **Área:** frontend

### Qué pasa

`/terminos` y `/ayuda` responden `404 Not Found`. En el perfil del rol
**client** esos accesos fueron removidos del menú, pero **en el del agente
siguen presentes**.

| Rol | "Ayuda y soporte" | "Términos y privacidad" |
|-----|-------------------|-------------------------|
| client | ✅ removido | ✅ removido |
| agent | ❌ presente → 404 | ❌ presente → 404 |

### Pasos para reproducir

1. Iniciar sesión como `qa.agent`.
2. Ir a `/explorar` y entrar a Perfil desde la barra inferior.
3. Pulsar "Ayuda y soporte" o "Términos y privacidad".
4. Aparece `Unexpected Application Error! 404 Not Found`.

### Impacto

Además del 404, volver desde esa pantalla implica una carga completa de
página. Combinado con PROP-BUG-06, eso puede **cerrarle la sesión al agente**.

### Arreglo sugerido

Implementar las rutas, o removerlas también del menú del agente (como ya se
hizo en el de client) o dejarlas deshabilitadas con "Próximamente", que es el
patrón que ya usa `/configuracion`.

### Vigilado por

`tests/perfil-agente.spec.ts` (AGT-04)

---

## [PROP-BUG-03] El aviso "Activá tu ubicación" intercepta clicks en varias pantallas

**Severidad:** Media · **Área:** frontend

### Qué pasa

El banner de geolocalización intercepta los clicks del contenido de debajo
mientras está montado. **No está limitado a `/perfil`**: en la verificación
bloqueó también el botón "Iniciar sesión" en `/ingresar`.

### Pasos para reproducir

1. Abrir la app en un contexto sin permisos de geolocalización previos.
2. Esperar a que aparezca el aviso "Activá tu ubicación".
3. Intentar pulsar el control que quede debajo (el logout en `/perfil`, o
   "Iniciar sesión" en `/ingresar`).

### Evidencia

```
<p>Activá tu ubicación</p> from <div>…</div> subtree intercepts pointer events
```

### Impacto

Hay **dos overlays distintos capaces de bloquear el mismo botón de login**,
cada uno por su cuenta. No es "el aviso molesta en el perfil": es "el aviso
puede bloquear cualquier acción en cualquier pantalla donde aparezca".

### Arreglo sugerido

Mismo tratamiento que PROP-BUG-01. Conviene resolver los dos a la vez.

### Vigilado por

`tests/profile.spec.ts` (PERF-03)

---

## [PROP-BUG-09] Botones de icono sin nombre accesible, y uno no hace nada

**Severidad:** Media · **Área:** accesibilidad

### Qué pasa

En la cabecera del detalle de una propiedad propia hay **dos botones sin
`aria-label`, sin `title` y sin texto**. Además, al menos uno no produce
ningún efecto al pulsarlo.

### Pasos para reproducir

1. Iniciar sesión como `qa.owner` o `qa.agent`.
2. Abrir una propiedad propia desde "Mis Propiedades".
3. Observar los iconos de la cabecera, a la derecha de "Compartir".
4. Pasar el mouse: no hay tooltip. Pulsarlos: uno no hace nada.

### Evidencia

```json
[
  { "i": 2, "aria": "Compartir", "svgs": 1 },
  { "i": 3, "aria": null, "title": null, "texto": "", "svgs": 1 },
  { "i": 4, "aria": null, "title": null, "texto": "", "svgs": 1 }
]
```

Al pulsar el botón sin etiqueta: la URL no cambia, no se abre ningún diálogo y
no hay feedback (medido antes y después del click).

### Impacto

1. Un lector de pantalla los anuncia solo como "botón": son inoperables sin visión.
2. Sin tooltip, ni un usuario vidente sabe qué hacen sin pulsarlos.
3. Uno de ellos no hace nada.

El botón contiguo ("Compartir") sí tiene `aria-label`.

**El compositor del chat tiene el mismo problema.** Sus dos botones —adjuntar
y enviar— tampoco exponen `aria-label`, `title` ni texto:

```json
[ { "aria": null, "type": "button", "disabled": false, "texto": "" },
  { "aria": null, "type": "button", "disabled": true,  "texto": "" } ]
```

El de enviar solo se distingue porque arranca deshabilitado. Combinado con
PROP-BUG-20 (Enter no envía), un usuario de lector de pantalla **no tiene forma
de descubrir cómo mandar un mensaje**.

### Arreglo sugerido

Agregar `aria-label` y `title` a los cuatro botones (los dos de la cabecera de
propiedad y los dos del compositor), y conectar o remover el que no tiene
acción.

### Vigilado por

`tests/propiedad-acciones.spec.ts` (PROP-01, PROP-02)

---

## [PROP-BUG-10] Los filtros del mapa no exponen su estado de forma accesible

**Severidad:** Media · **Área:** accesibilidad

### Qué pasa

Los botones de filtro de `/mapa` comunican si están activos **solo por color**,
mediante la clase CSS `is-active`. No usan `aria-pressed` ni ningún otro
mecanismo accesible.

### Pasos para reproducir

1. Abrir `/mapa`.
2. Inspeccionar los botones "Todos", "Alquiler", "Venta", "Casa", etc.
3. Ninguno expone `aria-pressed`, ni con el filtro activo.

### Impacto

Un lector de pantalla no puede informar qué filtros están aplicados. El
usuario navega el listado sin saber por qué ve esos resultados.

### Arreglo sugerido

Agregar `aria-pressed="true|false"` a cada botón de filtro.

> Nota: la lógica de filtrado **funciona correctamente**. Los filtros son dos
> ejes independientes (operación × tipo), y que "Todos" y "Casa" estén activos
> a la vez es correcto. Lo que falta es exponer ese estado.
>
> Aparte, vale revisar la etiqueta "Todos": pertenece al eje de operación pero
> se lee como si aplicara a todos los filtros, y los dos ejes se renderizan
> idénticos y en la misma fila. Es confuso, aunque no sea un defecto funcional.

### Vigilado por

`tests/mapa.spec.ts` (MAP-02)

---

## [PROP-BUG-11] Publicar un terreno exige habitaciones y baños

**Severidad:** Media · **Área:** frontend

### Qué pasa

La validación del paso 3 del wizard es **la misma para todos los tipos de
propiedad**. Un terreno no tiene habitaciones ni baños, pero el formulario los
exige igual y bloquea la publicación.

### Pasos para reproducir

1. Iniciar sesión como `qa.owner` y entrar a `/publicar`.
2. Elegir operación "Venta" y tipo **"Terreno"**, completar la dirección.
3. Llegar al paso 3 ("Información") y completar título, descripción, precio y m².
4. Dejar habitaciones y baños vacíos y pulsar "Continuar".

### Evidencia

El avance queda bloqueado con:

```
Completá título, descripción, precio, habitaciones, baños y m².
```

### Impacto

El usuario queda obligado a inventar un dato o a no publicar.

### Arreglo sugerido

Ocultar esos campos, o dejar de exigirlos, según el tipo de propiedad elegido
en el paso 1.

### Vigilado por

`tests/publicar.spec.ts` (PUB-01)

---

## [PROP-BUG-12] Se exige aceptar unos términos que no se pueden leer

**Severidad:** Media · **Área:** frontend / legal

### Qué pasa

El paso 5 del wizard exige marcar *"Acepto los términos y condiciones de
publicación"* para poder publicar. Ese texto **no enlaza a ningún contenido**.

### Pasos para reproducir

1. Iniciar sesión como `qa.owner` y llegar al paso 5 del wizard
   (`/publicar/revision`).
2. Intentar leer los términos que se piden aceptar.
3. No hay enlace, ni modal, ni texto desplegable.

### Evidencia

La fila es un `<label>` con un checkbox y texto plano. La pantalla completa
**no contiene ni un solo elemento `<a>`**.

### Impacto

El usuario acepta un contrato que no puede leer. Además del problema de
producto, tiene implicancias legales sobre la validez del consentimiento.

Se relaciona con `/configuracion`, donde "Términos y condiciones" figura como
*"Próximamente"*: el contenido no existe todavía en ningún lado, pero el
wizard ya lo exige como condición para publicar.

### Arreglo sugerido

Enlazar el texto a los términos, o no exigir la aceptación hasta que el
contenido exista.

### Vigilado por

`tests/publicar.spec.ts` (PUB-03)

---

## [PROP-BUG-14] Con 5 fotos o más, el mosaico deja un bloque negro vacío

**Severidad:** Media · **Área:** frontend

### Qué pasa

En el detalle de una propiedad con 5+ fotos, el mosaico muestra una foto
grande a la izquierda y una grilla 2×2 a la derecha. La foto grande estira
hasta el alto del contenedor; **la grilla no**. Debajo de las miniaturas queda
un rectángulo negro que ocupa media galería.

### Pasos para reproducir

1. Abrir en escritorio el detalle de una propiedad con 5 fotos o más.
2. Observar el área bajo la grilla 2×2 de miniaturas.

### Evidencia

Medido sobre una propiedad de 9 fotos, a 1036 px de ancho:

```
contenedor          top  73 → bottom 793   (alto 720)
foto grande         top  73 → bottom 793   ← llena el alto
miniaturas (2×2)    top  73 → bottom 429   ← se corta a la mitad
                                    hueco: 364 px = 51% del mosaico
```

**Condiciones:** solo con 5+ fotos (con 2 el hueco es 0) y solo en escritorio
(en móvil el mosaico se apila en una columna).

### Arreglo sugerido

Que la grilla de miniaturas estire al alto del contenedor
(`align-items: stretch` / `grid-template-rows: 1fr 1fr`), o que el contenedor
tome su alto del contenido en vez de fijarlo desde la foto grande.

### Vigilado por

`tests/galeria.spec.ts` (GAL-01)

---

## [PROP-BUG-15] El visor de fotos deja ver la página detrás

**Severidad:** Media · **Área:** frontend

### Qué pasa

Al abrir el visor de fotos, el mosaico de la página **sigue renderizado y
visible detrás**, y el fondo del visor no es opaco. Ese resto deja pasar el
mosaico, cuya foto grande se ve como una imagen fantasma fija detrás de cada
diapositiva.

### Pasos para reproducir

1. Abrir el detalle de una propiedad con varias fotos.
2. Abrir el visor ("Ver las N fotos" en escritorio; tocar la foto en móvil).
3. Avanzar de foto: la imagen fantasma del fondo **no cambia**.

### Evidencia

```json
{
  "fondoDelVisor": "rgba(0, 0, 0, 0.94)",
  "mosaicoDetras": { "sigueVisible": true, "opacity": "1", "seMovio": false }
}
```

Verificado avanzando de la foto 1 a la 3: el contador del visor cambia
(`1/8` → `3/8`) mientras el fondo permanece idéntico.

### Nota sobre el diagnóstico

Se reportó originalmente como *"la primera imagen queda de fondo"*. La
observación es correcta pero la causa no: **no** es que la primera foto se
renderice bajo las demás dentro del visor, es que la página entera se
transparenta. **No hay que tocar el z-index de las diapositivas**, sino el
fondo del visor.

### Arreglo sugerido

Cualquiera de las dos vías sirve:

1. Fondo del visor totalmente opaco (`rgba(0, 0, 0, 1)`).
2. Ocultar el contenido de la página mientras el visor está abierto.

### Vigilado por

`tests/galeria.spec.ts` (GAL-02, GAL-03)

---

## [PROP-BUG-20] Enter no envía el mensaje en el chat

**Severidad:** Baja · **Área:** frontend / chat

### Qué pasa

Escribir un mensaje y pulsar Enter no hace nada. Hay que pulsar el botón de
enviar, que además no tiene etiqueta (PROP-BUG-09).

### Pasos para reproducir

1. Abrir cualquier conversación en `/mensajes`.
2. Escribir un texto en el compositor y pulsar Enter.
3. No pasa nada: el texto sigue ahí y no se envía.

### Causa

El compositor **no está dentro de un `<form>`**, así que el navegador no
dispara ningún submit:

```json
{ "inputTag": "INPUT", "inputPlaceholder": "Escribí tu mensaje...", "hayForm": false }
```

### Impacto

Enter es la vía que todo el mundo espera en un chat. Combinado con
PROP-BUG-09, el usuario tiene que descubrir por prueba y error cómo enviar.

### Arreglo sugerido

Envolver el compositor en un `<form>` con `onSubmit`, o manejar `Enter` en el
input (con `Shift+Enter` para salto de línea).

---

## [PROP-BUG-08] Falta concordancia de plural en el conteo de resultados

**Severidad:** Baja · **Área:** frontend

### Qué pasa

Con un solo resultado, la app escribe `"1 propiedades visibles"` en el mapa y
`"1 propiedades cerca tuyo"` en `/explorar`. Falta la forma singular.

### Pasos para reproducir

1. Abrir `/mapa` o `/explorar`.
2. Aplicar filtros hasta que quede exactamente 1 resultado.
3. Leer el resumen.

### Arreglo sugerido

Pluralizar según la cantidad: `1 propiedad` / `N propiedades`.

### Nota

**Sin cobertura automatizada, a propósito.** El conteo del mapa depende del
encuadre y no es controlable sin mockear la API, así que un test daría falsos
resultados. Queda como verificación manual.

---

*Generado desde `docs/TEST-STRATEGY.md`. Si un defecto cambia de estado,
la fuente de verdad es ese documento — este archivo es una exportación puntual.*

# Fase 6 — Panel de administración

Entrega: `/admin/dashboard` con todas las tablas (publicadas y ocultas) y acciones; `/admin/tables/new` y `/admin/tables/[id]/edit` con nombre, descripción, estado y definición de columnas; gestión de registros generada desde las columnas; confirmación antes de borrar. Estados de carga, éxito, error y validación.

## Specs

**S1** — `/admin/dashboard`: todas las tablas, publicadas y ocultas, con su estado, enlaces a editar y a gestionar registros, y borrado con confirmación.

**S2** — `/admin/tables/new` y `/admin/tables/[id]/edit`: nombre, descripción, estado y definición de columnas (nombre, tipo, orden). Nombre obligatorio; tipo entre `text`, `number`, `date`, `boolean`.

**S3** — Error comprensible y específico: **"ya existe una tabla con ese nombre"** cuando el índice único lo impide, sin detalles técnicos en pantalla.

**S4** — Gestión de registros: agregar, editar y borrar filas. El formulario se genera a partir de las columnas definidas. Los datos respetan el tipo de cada columna, validado **en el servidor y en el formulario**.

**S5** — Antes de eliminar una tabla o un registro se pide confirmación explícita.

**S6** — `DATA-6.1`: al borrar una columna se borra su clave en `rows.data` de todas las filas; al renombrarla, se migra la clave. Todo en la **misma transacción** que el cambio de definición, con confirmación previa. Es la única operación del panel que puede destruir datos en silencio, así que vive en el servidor (RPC `save_table_with_columns`), nunca en el cliente.

**S7** — Estados: cargando durante cada escritura, confirmación visual de éxito, mensaje claro en error.

## Decisiones de implementación

- La creación y la edición de una tabla con sus columnas son **una sola llamada RPC** (`save_table_with_columns`), porque abarcan dos tablas y tienen que ser atómicas. Con PostgREST suelto, un fallo a mitad de camino deja una tabla sin columnas.
- La RPC es `security invoker`: RLS sigue siendo la que autoriza. `revoke execute` a `anon`.
- El borrado de tabla no necesita RPC: un `delete` simple y la cascada de la base hace el resto.
- `unique (table_id, position)` es diferida, así que reordenar columnas dentro de una transacción funciona.
- Intercambiar los nombres de dos columnas falla (constraint inmediata de nombre único): la UI debe explicarlo, no intentar adivinarlo.

## Log

**L1** — Pedido del usuario: "después arranca la fase 6".
**L2** — Datos reales cargados: tabla `Empleados` publicada con 6 filas (el fixture corrió dos veces) y `Borrador` oculta. Sirven como datos de prueba del borrado.

**L3** — **`pkill -f "next dev"` mata su propio shell.** El job que lo ejecutaba tenía `next dev` en su línea de comandos, así que entró en el patrón: exit 143 (SIGTERM), sin salida, y el build nunca corrió. Regla adoptada: matar por puerto o PID (`ss -ltnp`), nunca por un patrón que pueda aparecer en el propio comando.

**L4** — `npm run build` exit 0 en 27s con las 10 rutas: `ƒ /`, `○ /_not-found`, `ƒ /admin/dashboard`, `ƒ /admin/tables/[id]/edit`, `ƒ /admin/tables/[id]/rows`, `ƒ /admin/tables/new`, `ƒ /api/supabase-check`, `ƒ /auth/callback`, `ƒ /login`, `ƒ /tables/[id]` y `ƒ Proxy (Middleware)`. Es la unica forma de verificar las rutas de `/admin`, que por HTTP responden `307` sin sesion.

**L5** — `npx tsc --noEmit` y `npm run lint` limpios.

**L6** — Prueba manual del usuario: 5 de 7 puntos bien (dashboard, borrar duplicado, crear registro, **renombrar columna con datos → los valores sobreviven**, nombre duplicado, borrar tabla). Dos defectos de interfaz encontrados y corregidos:

1. **`type="number"` bloquea las letras y acepta `e`** (notación científica). El navegador filtraba el input antes de enviarlo, así que el mensaje del servidor (“Edad” debe ser un número) **nunca se veía**. Ahora los números se piden con `type="text"` + `inputMode="decimal"`: se puede escribir cualquier cosa y responde la validación del servidor, sin perder el teclado numérico en celular.
2. **Autocompletado en los campos de texto**: el navegador sugería nombres de archivos usados antes (`01_extenciones.sql`, `02_location`…) porque el input se llama `name`. Se agregó `autoComplete="off"` en los `<form>` y en los inputs de nombre, descripción y columnas.

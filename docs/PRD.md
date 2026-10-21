# PRD — Panel de tablas con Supabase

Documento de requisitos del proyecto. Es el contexto inicial que se le entrega al agente de IA: define **qué** se construye, no **cómo**. Cada requisito tiene un identificador citable (`DATA-1`, `RLS-3`, `UI-2`, …) para que cada pedido de implementación pueda referenciarlo.

Origen: `Documentación_del_proyecto 001.md` (especificación formal). Este PRD no agrega requisitos: cuando la especificación no define algo, se registra la decisión concreta adoptada. Las 14 decisiones que la especificación dejaba abiertas fueron **confirmadas el 2026-10-21** y están listadas en la sección 14.

---

## 1. Objetivo

Aplicación web pequeña con dos zonas separadas:

- **Panel público:** cualquier persona, sin cuenta, busca y lee información organizada en tablas.
- **Panel de administrador:** una persona autenticada crea tablas, define sus columnas, y edita y borra su contenido.

Además de su función, el proyecto es una práctica de flujo profesional asistido por IA: especificación, implementación, pruebas y despliegue, con roles separados y seguridad desde el primer día.

### 1.1 Principio de diseño

`NFR-SEC-1` — La seguridad **no** depende de ocultar botones en la interfaz, sino de las políticas de la base de datos. Aunque se invoque la API directamente con la clave pública, el visitante no puede modificar datos.

### 1.2 Entorno

| Dato | Valor |
| --- | --- |
| Repositorio | `mappa-bmf` (GitHub, público) |
| Proyecto Supabase | `irrwmsrhdenbsxfkccko` — "Mappa Bmf", región `us-east-2`, PostgreSQL 17.11 |
| Entorno de datos | Un único proyecto de Supabase, usado en desarrollo y en producción |
| Alojamiento previsto | Vercel (plan Hobby) |

---

## 2. Alcance

`SCOPE-1` — Está dentro del alcance:

- Listado de tablas publicadas en el panel público.
- Lectura del contenido de cada tabla, solo lectura y con paginación.
- Búsqueda de texto dentro de una tabla y entre tablas.
- Inicio de sesión del administrador con correo y contraseña.
- Panel de administración: crear, editar y borrar tablas; definir columnas; agregar, editar y borrar registros.
- Estado de publicación de cada tabla: publicada u oculta.
- Reglas de seguridad verificables mediante pruebas automatizadas.
- Despliegue en una URL pública.

`SCOPE-2` — Fuera del alcance: cualquier cosa no listada arriba. El crecimiento del alcance es un riesgo explícito del proyecto.

---

## 3. Roles y permisos

| Rol | Acceso | Permisos |
| --- | --- | --- |
| Visitante (`anon`) | Sin iniciar sesión | Ver tablas publicadas, leer sus filas y buscar. Nunca escribe y no ve controles de creación, edición ni borrado. |
| Usuario autenticado sin rol admin | Correo y contraseña | Mismos permisos que el visitante. Es redirigido fuera de `/admin`. El proyecto no necesita este rol para operar. |
| Administrador | Correo y contraseña, con rol admin en el token | Permisos del visitante, más acceso al panel privado, visualización de tablas ocultas y escritura completa. |

`ROLE-1` — Los administradores se crean **manualmente** desde el dashboard de Supabase, insertando su identificador de usuario en la tabla de roles. No existe registro público de administradores.

---

## 4. Modelo de datos

`DATA-1` — El esquema es **fijo**. Cada tabla que crea el administrador es un registro dentro de él: no se modifica la estructura real de la base de datos. (Decisión de diseño: opción B de la especificación, frente a crear tablas reales de PostgreSQL con DDL desde la aplicación.)

### 4.1 `tables`

| Columna | Tipo | Restricciones | Descripción |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, `default gen_random_uuid()` | Identificador único. |
| `name` | `text` | `not null`, único | Nombre de la tabla; único. |
| `description` | `text` | `not null default ''` | Descripción corta. |
| `status` | `table_status` (`published` \| `hidden`) | `not null default 'hidden'` | Estado de publicación. |
| `created_at` | `timestamptz` | `not null default now()` | Fecha de creación. |
| `updated_at` | `timestamptz` | `not null default now()` | Última modificación. |

`DATA-1.1` — "Único" se implementa con un **índice único sobre `lower(name)`**, no con `UNIQUE` sobre `name`: `UNIQUE` sobre `text` distingue mayúsculas y permitiría `Ventas` y `ventas` como dos tablas distintas. La validación del panel compara sin distinguir mayúsculas.

### 4.2 `columns`

| Columna | Tipo | Restricciones | Descripción |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, `default gen_random_uuid()` | Identificador único. |
| `table_id` | `uuid` | `not null`, FK → `tables(id)` `on delete cascade` | Tabla a la que pertenece. |
| `name` | `text` | `not null` | Nombre de la columna. |
| `type` | `column_type` (`text` \| `number` \| `date` \| `boolean`) | `not null` | Tipo de dato: texto, número, fecha o booleano. |
| `position` | `integer` | `not null` | Orden de aparición. |

`DATA-2.1` — Unicidad **por tabla**: `unique (table_id, name)` y `unique (table_id, position)`. El nombre de la columna es la clave dentro de `rows.data`, así que dos columnas con el mismo nombre se pisarían en silencio; y dos columnas con la misma `position` darían un orden ambiguo al renderizar.

### 4.3 `rows`

| Columna | Tipo | Restricciones | Descripción |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, `default gen_random_uuid()` | Identificador único. |
| `table_id` | `uuid` | `not null`, FK → `tables(id)` `on delete cascade` | Tabla a la que pertenece. |
| `data` | `jsonb` | `not null default '{}'` | Contenido de la fila: nombre de columna como clave y el dato como valor. |
| `search_text` | `text` | `not null default ''` | Texto de búsqueda generado automáticamente a partir de `data`. |
| `created_at` | `timestamptz` | `not null default now()` | Fecha de creación. |
| `updated_at` | `timestamptz` | `not null default now()` | Última modificación. |

`DATA-3.1` — Búsqueda implementada con **`pg_trgm`**: `search_text text` con índice `gin (search_text gin_trgm_ops)` y consultas con `ILIKE '%…%'`. La extensión se habilita con `create extension if not exists pg_trgm`.

Se descartó `tsvector` porque no encuentra prefijos ni partes de palabra: quien busca `jua` esperando `Juan` no obtendría resultados. La contrapartida aceptada es un índice más pesado y sin orden por relevancia, que es razonable en un panel simple. Si más adelante hace falta ranking, se agrega una columna `tsvector` **en paralelo**, sin migrar la existente.

`DATA-3.2` — El trigger de `search_text` concatena **todos** los valores de `data` convertidos a texto, no solo los de tipo texto: buscar `2026` debe encontrar una fila con una fecha de 2026, y `1500` un número. Los `null` y las claves ausentes se omiten.

### 4.4 `user_roles`

| Columna | Tipo | Restricciones | Descripción |
| --- | --- | --- | --- |
| `user_id` | `uuid` | FK → `auth.users(id)` `on delete cascade` | Referencia al usuario de Supabase Auth. |
| `role` | `user_role` (`admin` \| `user`) | `not null` | Rol del usuario. |

`DATA-4.1` — Combinación única con `user_id`: `unique (user_id, role)`.

### 4.5 Relaciones

- Una tabla tiene muchas columnas y muchos registros.
- Al borrar una tabla se borran **en cascada** sus columnas y registros.
- `user_roles` es independiente y solo la consulta el Auth Hook.

### 4.6 Correspondencia con las acciones del administrador

| Acción | Operación en la base de datos |
| --- | --- |
| Crear una tabla | Insertar en `tables` y definir sus filas en `columns` |
| Editar una tabla | Actualizar nombre, descripción, estado o columnas |
| Borrar una tabla | Eliminar el registro de `tables`; la cascada borra el resto |
| Gestionar contenido | Crear, editar y borrar registros en `rows` |
| Leer y buscar (público) | Consultar `tables`, `columns` y `rows`, usando `search_text` |

`DATA-6.1` — Al **borrar** una columna se borra su clave del JSONB de todas las filas de esa tabla; al **renombrar**, se migra la clave en todas las filas. Ambas operaciones son destructivas sobre datos existentes, así que piden **confirmación previa** (`NFR-SEC-7`) y se ejecutan en la misma transacción que el cambio de la definición de la columna. Es el único punto del panel donde se pueden perder datos en silencio, así que vive en el servidor, no en el cliente.

### 4.7 Índices y optimización

- `INDEX-1` Índice único sobre `tables.name` (ver `DATA-1.1`).
- `INDEX-2` Índice sobre `columns.table_id`.
- `INDEX-3` Índice sobre `rows.table_id`.
- `INDEX-4` Índice GIN sobre `rows.search_text` (ver `DATA-3.1`).
- `INDEX-5` Paginación obligatoria en la vista de tabla: **25 filas por página**.

`INDEX-5.1` — Se fijan **25 filas por página**, en una constante única compartida por el panel público y el panel de administración, para que no se desincronicen.

---

## 5. Seguridad

### 5.1 Principios

- `RLS-1` Ninguna tabla del esquema público puede quedar sin RLS. Sin RLS, cualquiera con la clave pública accede a todos los datos.
- `RLS-2` Cada política indica de forma **explícita** el rol al que aplica (`anon` o `authenticated`). No se admiten políticas de lectura abiertas sin rol.
- `RLS-3` La tabla de roles no es accesible para `anon` ni para `authenticated`; solo la consulta el Auth Hook.

### 5.2 Políticas RLS por tabla (en lenguaje natural)

| Tabla | Operación | Rol | Regla |
| --- | --- | --- | --- |
| `tables` | Leer | `anon` y `authenticated` | Solo las tablas con estado publicado. |
| `tables` | Leer | Admin | Todas, publicadas y ocultas. |
| `columns` | Leer | `anon` y `authenticated` | Solo las que pertenecen a una tabla publicada. |
| `columns` | Leer | Admin | Todas. |
| `rows` | Leer | `anon` y `authenticated` | Solo las que pertenecen a una tabla publicada. |
| `rows` | Leer | Admin | Todas. |
| `tables`, `columns`, `rows` | Crear, editar, borrar | Admin | Solo si el token incluye el rol admin. |
| `user_roles` | Todas | Ninguno, salvo el servicio de autenticación | Se revoca el acceso a `anon` y `authenticated`. |

`RLS-4` — Un usuario autenticado **sin** rol admin tiene exactamente los permisos del visitante, incluido el no poder leer tablas ocultas.

### 5.3 Implementación del rol de administrador

1. `AUTH-1` Crear el tipo de rol (`user_role`) con los valores `admin` y `user`.
2. `AUTH-2` Crear la tabla de roles con unicidad por usuario y rol.
3. `AUTH-3` Crear la función del Auth Hook, que lee el rol del usuario y lo agrega al token como `user_role`.
4. `AUTH-4` Habilitar el hook en el dashboard de Supabase, en la sección de Auth Hooks. El nombre exacto del menú puede variar entre versiones; se confirma en la documentación vigente.
5. `AUTH-5` En las políticas RLS, verificar que el valor `user_role` del token sea `admin`.

`AUTH-6` — Un cambio de rol se refleja cuando el token de sesión se renueva, por lo que el usuario debe volver a iniciar sesión.

`AUTH-2.1` — Procedimiento de alta de un administrador (manual, desde el dashboard; no existe registro público):

1. En Supabase, **Authentication → Users → Add user**: crear el usuario con correo y contraseña y marcarlo como confirmado (la confirmación por correo está activada y no hay flujo público de registro).
2. Copiar el `user_id` del usuario recién creado.
3. En **SQL Editor**, insertar el rol: `insert into public.user_roles (user_id, role) values ('<user_id>', 'admin');`
4. El usuario inicia sesión **después** de insertar el rol: el claim `user_role` se agrega al emitir el token, así que una sesión anterior no lo tiene (`AUTH-6`).

Verificación: iniciar sesión y comprobar que el panel muestra las tablas ocultas. Si no las muestra, el rol no está en el token.

### 5.4 Flujo de autenticación

1. `AUTHFLOW-1` El administrador accede al inicio de sesión con correo y contraseña.
2. `AUTHFLOW-2` Supabase Auth valida las credenciales y emite un token con el rol admin, mediante el Auth Hook.
3. `AUTHFLOW-3` El middleware refresca la sesión en cada solicitud.
4. `AUTHFLOW-4` El layout de la zona de administración verifica el rol en el servidor; si no es admin, redirige al inicio de sesión o al panel público.
5. `AUTHFLOW-5` Al cerrar sesión se limpia la sesión y se redirige al panel público.

`AUTHFLOW-6` — Reparto de responsabilidades: el **middleware** solo refresca la sesión y redirige si no hay sesión (barato, sin consultas a la base); la verificación del **rol** vive en el **layout del servidor** de `/admin`, que es donde el rol es autoritativo. Verificar el rol también en el middleware agregaría una consulta a la base en cada request sin cambiar el resultado.

### 5.5 Claves y datos sensibles

- `NFR-SEC-2` En el frontend solo se usa la **publishable key** (antes llamada anon key).
- `NFR-SEC-3` La **service role key** nunca se expone en el cliente ni en el repositorio.
- `NFR-SEC-4` Los roles **no** se leen de `user_metadata`, porque el propio usuario puede modificarlo.
- `NFR-SEC-5` El archivo local de variables de entorno no se sube al repositorio.

### 5.6 Protecciones adicionales

- `NFR-SEC-6` Límites de uso (rate limiting) en Supabase.
- `NFR-SEC-7` Confirmación previa al borrado de tablas y registros.
- `NFR-SEC-8` Copias de seguridad habilitadas **cuando el plan de Supabase lo permita**.

`NFR-SEC-8.1` — **Corrección a la expectativa de la especificación:** el plan gratuito de Supabase **no incluye copias de seguridad**, así que `NFR-SEC-8` no es ejecutable hoy y no debe quedar como una tarea pendiente. La protección real de los datos es `NFR-SEC-9`: exportar antes de cualquier migración destructiva.

- `NFR-SEC-9` Las migraciones no hacen cambios destructivos (`drop`, borrados masivos) sin una copia previa de la información afectada.

---

## 6. Funcionalidades

### 6.1 Pantallas y rutas

| Ruta | Acceso | Descripción |
| --- | --- | --- |
| `/` | Público | Buscador general y lista de tablas publicadas, con nombre y descripción. Las tablas ocultas no aparecen. |
| `/tables/[id]` | Público | Columnas y filas en el orden definido, con buscador propio y paginación. Si la tabla no existe o está oculta, se muestra un error 404. |
| Resultados de búsqueda | Público | Coincidencias agrupadas por tabla, con enlace a la vista correspondiente. |
| `/login` | Administrador | Correo y contraseña. Redirige a `/admin/dashboard` si el rol es admin; en caso contrario muestra un error. |
| `/admin/dashboard` | Administrador | Todas las tablas, publicadas y ocultas, con acciones de editar y borrar. |
| `/admin/tables/new` y `/admin/tables/[id]/edit` | Administrador | Nombre, descripción, estado y definición de columnas (nombre, tipo, orden). |
| Gestión de registros | Administrador | Agregar, editar y borrar filas. El formulario se genera a partir de las columnas definidas. |

- `UI-1` Antes de eliminar una tabla o un registro se solicita confirmación.
- `UI-2` Un usuario autenticado sin rol admin que acceda a `/admin` es redirigido.

### 6.2 Estados de interfaz obligatorios

| Panel | Estado | Comportamiento |
| --- | --- | --- |
| Público | Cargando | Indicador de carga mientras se consultan los datos. |
| Público | Vacío | Mensaje claro cuando no hay tablas o no hay resultados. Se distingue **"no hay tablas"** de **"la búsqueda no encontró coincidencias"**. |
| Público | Error | Mensaje amable si falla la consulta, sin exponer detalles técnicos. |
| Administrador | Cargando | Indicador durante cada operación de escritura. |
| Administrador | Éxito | Confirmación visual de la operación. |
| Administrador | Error | Mensaje comprensible, por ejemplo **"ya existe una tabla con ese nombre"**. |
| Administrador | Validación | Nombre obligatorio, tipo de columna válido y datos que respeten el tipo definido. |

`UI-3` — La validación de los datos según `columns.type` es responsabilidad de la aplicación (el modelo JSONB no impone tipos en la base) y se hace en **dos lugares**: en el **servidor**, antes de escribir, que es la fuente de verdad y lo que cubre una prueba; y en el **formulario**, para dar feedback inmediato. No se implementa con `CHECK` en la base: sería rígido y difícil de mantener sobre JSONB. Nota: esto es integridad de datos, no seguridad; un tercero no puede escribir con la publishable key porque RLS lo impide.

### 6.3 Búsqueda

- `SRCH-1` **Dentro de una tabla:** se ejecuta sobre `rows.search_text` de la tabla seleccionada, con búsqueda de texto de PostgreSQL y resultados paginados.
- `SRCH-2` **Global:** se ejecuta sobre `rows.search_text` de todas las tablas publicadas. Los resultados se agrupan por tabla, con enlace directo.
- `SRCH-3` **Generación de `search_text`:** se calcula automáticamente concatenando los valores de `data` al insertar o actualizar una fila, mediante un trigger o función de base de datos que garantice la consistencia.

`SRCH-2.1` — La búsqueda global devuelve un **máximo de 5 coincidencias por tabla**, con un enlace "ver todas en esta tabla" que lleva a `/tables/[id]?q=…`, y **no se pagina**. Paginar la búsqueda global obligaría a contar coincidencias de todas las tablas en cada página: es la consulta más cara del panel y no aporta valor en un panel simple.

`SRCH-4` — El buscador de `/tables/[id]` y el de `/` deben usar la misma función de consulta, con el `table_id` como filtro opcional.

---

## 7. Estructura y configuración del proyecto

### 7.1 Estructura de carpetas (por funcionalidad)

| Ubicación | Contenido |
| --- | --- |
| `app`, zona pública | Página de inicio y página de lectura, búsqueda y paginación de filas. |
| `app`, zona de administración | Layout que verifica el rol en el servidor, dashboard y páginas de crear y editar tablas. |
| `app`, autenticación | Página de inicio de sesión y ruta de retorno (callback) de Supabase Auth. |
| `features/auth` | Inicio y cierre de sesión, manejo de sesión. |
| `features/tables` | Gestión de metadatos y columnas de las tablas. |
| `features/rows` | Gestión de filas y búsqueda. |
| `features/search` | Búsqueda global y por tabla. |
| `shared` | Clientes de Supabase (navegador y servidor), componentes de shadcn/ui y tipos compartidos. |
| `middleware` | Refresca la sesión y protege `/admin`. |

`STRUCT-1` — La organización es **por funcionalidad**: cada funcionalidad se entiende sin recorrer muchos directorios.

### 7.2 Variables de entorno

| Variable | Contenido |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key de Supabase. |

`ENV-1` — Se definen en el archivo local de entorno, que no se sube al repositorio. En producción se cargan en Vercel. El desarrollo local y la aplicación publicada usan el mismo proyecto de Supabase, por lo que los valores son los mismos.

### 7.3 Ajustes de Auth en Supabase

| Ajuste | Valor |
| --- | --- |
| Confirmación por correo | Activada |
| Registro público de usuarios | Desactivado; el administrador se crea manualmente (`ROLE-1`) |
| Site URL | URL de Vercel (hasta el despliegue, `http://localhost:3000`) |
| Redirect URLs | `http://localhost:3000/**` y la URL de Vercel con `/**` |
| Auth Hook (Custom Access Token) | Función del hook de `AUTH-3` |

### 7.4 Stack

| Componente | Tecnología |
| --- | --- |
| Backend | Supabase: PostgreSQL, Supabase Auth, Row Level Security, API automática (PostgREST), búsqueda de texto de PostgreSQL, Auth Hook (Custom Access Token) |
| Framework | Next.js (App Router) |
| Lenguaje | TypeScript |
| Estilos y componentes | Tailwind CSS y shadcn/ui |
| Cliente de Supabase | `@supabase/ssr` — **no** se usa `@supabase/auth-helpers-nextjs`, que está obsoleta |
| CLI de Supabase | Migraciones versionadas y pruebas de RLS, aplicadas al proyecto en la nube (`supabase test db --linked`) |
| Alojamiento | Vercel, conectado a GitHub |
| Repositorio | GitHub |

`STACK-1` `[ESTADO ACTUAL]` — El proyecto no se inició desde la plantilla oficial `with-supabase`: se extendió un scaffold de Next.js 16.4.2 y se agregó `@supabase/ssr` a mano. shadcn/ui quedó inicializado con el preset `base-nova`, que usa **Base UI** (`@base-ui/react`), no Radix.

---

## 8. Requisitos no funcionales

| Categoría | Requisito |
| --- | --- |
| Simplicidad | `NFR-1` Pocas pantallas y pocas dependencias. |
| Rendimiento | `NFR-2` Paginación obligatoria; índices en claves foráneas y en `search_text`. |
| Responsive | `NFR-3` El panel público se visualiza correctamente en celular. |
| Accesibilidad | `NFR-4` Componentes accesibles de shadcn/ui; contraste y foco visibles. |
| Mantenibilidad | `NFR-5` Código y base de datos ordenados; migraciones versionadas en el repositorio, sin cambios manuales en el dashboard. |
| Seguridad | `NFR-6` RLS en todas las tablas, verificado con pruebas automatizadas. |
| Costo | `NFR-7` Funcionamiento dentro de los planes gratuitos de Supabase y Vercel. |
| Calidad de código | `NFR-8` TypeScript, **sin `any`** en las capas de datos. |

---

## 9. Estrategia de pruebas

`TEST-1` — Las pruebas de RLS son críticas: separan una práctica de un proyecto profesional. Se automatizan con la CLI de Supabase y pgTAP, y **no** se sustituyen por la inspección manual del dashboard.

`TEST-2` — Se ejecutan contra el proyecto de Supabase en la nube (`supabase test db --linked`), con la extensión pgTAP habilitada.

`TEST-3` — Cada prueba corre dentro de una transacción que termina en `rollback`, para no dejar datos de prueba.

| N.º | Prueba | Resultado esperado |
| --- | --- | --- |
| 1 | Un usuario `anon` consulta `tables`, `columns` y `rows` de tablas publicadas | Permitido |
| 2 | Un usuario `anon` consulta tablas con estado oculto | Denegado |
| 3 | Un usuario `anon` intenta crear, editar o borrar en cualquier tabla | Denegado |
| 4 | Un usuario autenticado sin rol admin intenta escribir | Denegado |
| 5 | Un usuario autenticado con rol admin escribe | Permitido |
| 6 | `anon` o `authenticated` consultan la tabla de roles | Denegado |

`TEST-4` — Si una política permite escritura a `anon`, la prueba correspondiente debe fallar.

`TEST-5` — Además, se realiza una verificación manual de los flujos de inicio y cierre de sesión, lectura pública, escritura del administrador y comportamiento en celular y computadora.

`TEST-6` — No se agrega runner de pruebas de aplicación todavía. La especificación exige pgTAP para RLS, y eso es lo que se implementa en la fase 7. **Vitest entra cuando exista lógica con ramas propias** (validación de tipos, armado de la consulta de búsqueda): antes de eso no habría nada que probar y sería ceremonia vacía.

---

## 10. Criterios de aceptación

El proyecto se considera terminado cuando se cumplen **todos**:

- `ACC-1` Un visitante accede a `/`, ve la lista de tablas publicadas y lee las filas de cualquier tabla.
- `ACC-2` Un visitante busca dentro de una tabla y entre tablas.
- `ACC-3` Un visitante no ve controles de creación, edición ni borrado.
- `ACC-4` Un visitante no puede escribir, ni siquiera llamando directamente a la API.
- `ACC-5` Las tablas ocultas no aparecen en el panel público.
- `ACC-6` El administrador inicia sesión y accede a `/admin/dashboard`.
- `ACC-7` El administrador crea una tabla, define columnas, agrega, edita y borra registros, y borra la tabla con sus filas en cascada.
- `ACC-8` Un usuario autenticado sin rol admin es redirigido fuera de `/admin`.
- `ACC-9` Las pruebas de RLS pasan: `anon` solo lee, admin escribe y la tabla de roles es inaccesible.
- `ACC-10` El código está en TypeScript, sin `any` en las capas de datos.
- `ACC-11` La aplicación funciona correctamente en celular y en computadora.
- `ACC-12` La aplicación está desplegada y operativa en una URL pública.

---

## 11. Despliegue

### 11.1 Checklist

- `DEP-1` Variables de entorno configuradas en Vercel con la URL y la publishable key del proyecto.
- `DEP-2` Site URL y Redirect URLs actualizadas en Supabase con la URL de Vercel, conservando `localhost` para el desarrollo.
- `DEP-3` Confirmación por correo activada y registro público de usuarios desactivado.
- `DEP-4` Migraciones aplicadas en el proyecto de Supabase.
- `DEP-5` Auth Hook habilitado.
- `DEP-6` Cuenta de administrador creada y rol insertado.
- `DEP-7` Pruebas de RLS ejecutadas contra el proyecto, con la aplicación ya publicada.
- `DEP-8` Datos de prueba eliminados o en estado `hidden`.
- `DEP-9` Copias de seguridad activadas, si el plan lo permite (ver `NFR-SEC-8.1`).

### 11.2 Verificación posterior

`DEP-10` — Una vez desplegada la aplicación, se verifican en la URL pública los criterios de aceptación de la sección 10, con atención al inicio y cierre de sesión, la lectura pública, la escritura del administrador y el funcionamiento en celular y computadora.

---

## 12. Metodología y orden de trabajo

`PROC-1` — El desarrollo sigue un orden fijo: especificar, migrar, implementar por funcionalidades, probar la seguridad y desplegar.

| Fase | Actividades | Entregable |
| --- | --- | --- |
| 1. Preparación | Crear el proyecto de Supabase y el repositorio en GitHub; iniciar desde la plantilla oficial y vincular la CLI al proyecto. | **Completada** (ver `STACK-1`) |
| 2. Especificación | Este documento. | Este PRD |
| 3. Base de datos | Migración con las tablas internas, el tipo de rol, triggers y políticas RLS. Crear y habilitar el Auth Hook. | Migraciones versionadas aplicadas |
| 4. Autenticación | Crear la cuenta del administrador, insertar su rol y construir el inicio de sesión. | Acceso de administrador funcional |
| 5. Panel público | Lista de tablas, vista de tabla con paginación y búsqueda. | Panel público completo |
| 6. Panel de administrador | Gestión de tablas, columnas y registros, con confirmaciones de borrado. | Panel de administración completo |
| 7. Pruebas | Escribir y ejecutar las pruebas de seguridad (sección 9). | Pruebas aprobadas |
| 8. Despliegue | Publicar en Vercel y completar el checklist (sección 11). | Aplicación en URL pública |

### 12.1 Normas de trabajo con el agente de IA

- `PROC-2` Cada cambio de esquema es una migración versionada con la CLI de Supabase; no se hacen cambios manuales en el dashboard.
- `PROC-3` El agente puede generar el código SQL, pero este se revisa antes de aplicarse. Se comprueba que RLS esté activo en todas las tablas, que las políticas indiquen el rol, que la tabla de roles no sea accesible al público y que existan el trigger de `search_text` y el borrado en cascada.
- `PROC-4` Cada solicitud al agente indica la carpeta de la funcionalidad y las restricciones de seguridad aplicables. Las solicitudes genéricas, como "construir el panel de administración", producen resultados deficientes.
- `PROC-5` La implementación avanza por funcionalidades, dentro de la carpeta correspondiente.

### 12.2 Trabajo con un único proyecto de Supabase

`PROC-6` — El desarrollo, las pruebas y el público comparten la misma base de datos. Por eso:

- Cada migración se revisa antes de aplicarse y se ejecuta primero con `supabase db push --dry-run`.
- Las migraciones no hacen cambios destructivos sin una copia previa (`NFR-SEC-9`).
- Las pruebas de RLS se ejecutan dentro de una transacción que termina en `rollback`.
- Mientras se construye una tabla, se mantiene en estado `hidden`; solo se publica cuando está completa.
- La conexión MCP del agente se limita a este proyecto y, siempre que sea posible, en modo solo lectura. Los cambios de esquema los aplica la persona después de revisar la migración.

---

## 13. Riesgos y errores comunes

| Riesgo o error | Consecuencia | Mitigación |
| --- | --- | --- |
| No activar RLS en una tabla | Cualquiera con la clave pública lee y escribe todos los datos | Activar RLS en cada tabla del esquema público (`RLS-1`) |
| Usar la service role key en el cliente | Se extrae del código y omite toda la seguridad | Usar solo la publishable key (`NFR-SEC-3`) |
| Usar `@supabase/auth-helpers-nextjs` | La aplicación falla con las versiones actuales | Usar `@supabase/ssr` |
| Políticas RLS sin rol explícito | Se evalúan también para `anon`, donde no deberían | Indicar siempre `anon` o `authenticated` (`RLS-2`) |
| Confiar en `user_metadata` para roles | El usuario puede editarlo y convertirse en administrador | Usar el rol en el token, desde una tabla controlada (`NFR-SEC-4`) |
| Crear tablas dinámicas con DDL desde la aplicación | Complejidad, inyección SQL y permisos elevados | Usar el modelo de la sección 4 (`DATA-1`) |
| Cambios de esquema manuales en el dashboard | No hay historial y la base de datos queda desincronizada del repositorio | Migraciones versionadas con la CLI (`NFR-5`) |
| Omitir el trigger de `search_text` | La búsqueda devuelve resultados desactualizados | Trigger en inserción y actualización de `rows` (`SRCH-3`) |
| No paginar tablas largas | Carga lenta y mala experiencia | Paginación obligatoria (`INDEX-5`) |
| Pérdida accidental de información | Datos borrados sin posibilidad de recuperación | Confirmar borrados (`NFR-SEC-7`) y exportar antes de migraciones destructivas (`NFR-SEC-9`) |
| Un único proyecto para desarrollo y público | Una migración o prueba errónea afecta a los datos y a los visitantes reales | Revisar con `--dry-run`, pruebas con `rollback`, MCP limitado y las normas de la sección 12.2 |
| Pausa del proyecto gratuito por inactividad | La aplicación deja de responder hasta reactivar el proyecto | Entrar al proyecto con regularidad y reactivarlo si se pausa; verificar la política vigente del plan |
| Crecimiento del alcance | Proyecto fuera de control | Implementar solo lo definido en la sección 2 |

---

## 14. Decisiones confirmadas

La especificación dejaba estas 14 decisiones abiertas. Fueron **confirmadas el 2026-10-21** y ya están aplicadas en las secciones correspondientes: **no quedan decisiones pendientes**. Cualquier cambio posterior se registra acá con su fecha.

| # | Requisito | Decisión confirmada |
| --- | --- | --- |
| 1 | `DATA-3.1` | Búsqueda con `pg_trgm`: `search_text text` + `gin (search_text gin_trgm_ops)` e `ILIKE` |
| 2 | `DATA-3.2` | El trigger concatena todos los tipos convertidos a texto |
| 3 | `DATA-1.1` | Índice único sobre `lower(name)` |
| 4 | `DATA-2.1` | `unique (table_id, name)` y `unique (table_id, position)` |
| 5 | `DATA-6.1` | Borrar o migrar la clave en `rows.data` de todas las filas, con confirmación |
| 6 | `AUTHFLOW-6` | Rol verificado solo en el layout del servidor; el middleware solo refresca la sesión |
| 7 | `SRCH-2.1` | Búsqueda global: 5 coincidencias por tabla, sin paginación |
| 8 | `INDEX-5.1` | 25 filas por página, en una constante compartida |
| 9 | `UI-3` | Validación de tipos en el servidor y en el formulario |
| 10 | `TEST-6` | Sin runner de aplicación todavía; Vitest cuando haya lógica con ramas |
| 11 | `NFR-SEC-8.1` | El plan gratuito no tiene copias de seguridad: exportar antes de migraciones destructivas |
| 12 | `ROLE-1` | Procedimiento de alta documentado en `AUTH-2.1` (sección 5.3) |
| 13 | `DATA-1` | `description` `not null default ''` |
| 14 | `DATA-1` | Estado por defecto de una tabla nueva: `hidden` |

---

## 15. Glosario

| Término | Significado |
| --- | --- |
| RLS (Row Level Security) | Mecanismo de PostgreSQL que filtra las filas según el usuario que consulta. |
| `anon` | Rol de PostgreSQL que usan los visitantes sin sesión. |
| `authenticated` | Rol de PostgreSQL que usan los usuarios con sesión iniciada. |
| JWT | Token firmado que Supabase Auth emite al iniciar sesión; contiene datos como `user_role`. |
| Custom claim | Dato adicional agregado al JWT; en este proyecto, `user_role`. |
| Auth Hook | Función de Supabase que se ejecuta al emitir un token para personalizarlo. |
| JSONB | Tipo de dato de PostgreSQL que almacena JSON de forma eficiente e indexable. |
| PostgREST | Servicio que expone automáticamente la base de datos como API. |
| pgTAP | Extensión de PostgreSQL para escribir pruebas de base de datos. |
| Migración | Archivo SQL versionado que describe un cambio de esquema. |
| DDL | Instrucciones que modifican la estructura de la base de datos, como crear o borrar tablas. |
| Publishable key | Clave pública de Supabase (antes anon key); segura para el frontend. |
| Service role key | Clave privada que omite RLS; nunca se usa en el frontend. |

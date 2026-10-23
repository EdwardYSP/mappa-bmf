# Fase 4 — Autenticación del administrador

Entrega: `/login` funcional con Supabase Auth, sesión refrescada en cada solicitud, `/admin` protegido en el servidor por rol, y cierre de sesión. Stack: Next.js 16.4.2 (App Router), TypeScript, `@supabase/ssr` ya instalado. La base de datos ya tiene el Auth Hook y las políticas RLS (Fase 3); este trabajo es solo código de aplicación.

## Specs

**S1** — `/login` (público): correo y contraseña. Redirige a `/admin/dashboard` si el rol es admin; en caso contrario muestra un error.

**S2** — Flujo: Supabase Auth valida las credenciales y emite un token con el rol admin, mediante el Auth Hook (claim `user_role`). El middleware refresca la sesión en cada solicitud. El layout de la zona de administración verifica el rol en el servidor; si no es admin, redirige al inicio de sesión o al panel público. Al cerrar sesión se limpia la sesión y se redirige al panel público.

**S3** — Reparto de responsabilidades (decidido, no renegociar): el **middleware solo refresca la sesión** y redirige a `/login` si no hay sesión en rutas de `/admin`. La **verificación del rol vive en el layout del servidor** de `/admin`. No duplicar la verificación de rol en el middleware (agregaría una consulta a la base por request).

**S4** — Estados de interfaz: durante la operación de inicio de sesión, indicador de carga; si falla, mensaje comprensible ("Correo o contraseña incorrectos") sin exponer detalles técnicos del error de Supabase.

**S5** — Un usuario autenticado **sin** rol admin que acceda a `/admin` es redirigido fuera de `/admin`.

**S6** — Estructura: lógica en `src/features/auth`, páginas en `src/app/login` y `src/app/auth/callback`, middleware en `src/middleware.ts`. Los clientes de Supabase ya existen en `src/lib/supabase/server.ts` y `src/lib/supabase/client.ts`: **usarlos, no reescribirlos ni moverlos**.

**S7** — TypeScript **sin `any`** en las capas de datos. Prohibido `@supabase/auth-helpers-nextjs` (obsoleto).

## Tasks

**T1** `src/lib/supabase/middleware.ts` + `src/middleware.ts` — refresco de sesión con cookies y redirección a `/login` cuando no hay sesión en `/admin` (S2, S3).

**T2** `src/features/auth` — server action de inicio de sesión (S1, S4) y de cierre de sesión (S2).

**T3** `src/app/login/page.tsx` + formulario cliente con estados de carga y error (S1, S4).

**T4** `src/app/auth/callback/route.ts` — intercambio del código por sesión (S2).

**T5** `src/app/admin/layout.tsx` — verificación de rol en el servidor y redirección (S3, S5).

**T6** Componentes de formulario (input, label, button, card) instalados con shadcn/ui.

## Log

**L1** — Pedido del usuario, verbatim: "vamos dale" — autoriza arrancar Fase 4 después de cerrar la Fase 3.

**L2** — Origen: `docs/PRD.md` §5.4 (`AUTHFLOW-1` a `AUTHFLOW-6`), §6.1, §6.2, §7.1, §7.4. La decisión `AUTHFLOW-6` del §14 fija el reparto de S3.

**L3** — Verificado en Fase 3 contra la base real con la publishable key: `GET /rest/v1/tables` → `200 []`, `POST /rest/v1/tables` como anon → `401` "violates row-level security policy", `GET /rest/v1/user_roles` → `401 42501`.

**L4** — **Next 16 renombró la convención `middleware` a `proxy`**. Con `src/middleware.ts`, TODAS las respuestas HTML salían `200` con cuerpo vacío (incluida `/`), y las requests ni aparecían en el log del dev server. El dev log lo avisaba: *"The 'middleware' file convention is deprecated. Please use 'proxy' instead."* Se migró a `src/proxy.ts` con `export function proxy()` y el helper pasó a `src/lib/supabase/update-session.ts`. Además se quitó `NextResponse.next({ request })` en favor de `NextResponse.next()`: con el objeto `request` completo la respuesta quedaba vacía. Lección: en Next 16 leer `node_modules/next/dist/docs/` antes de escribir convenciones de archivo (lo advierte `AGENTS.md`).

**L5** — El rol se consulta con `supabase.rpc('is_admin')`, la misma función que evalúan las políticas RLS: la UI no puede quedar en desacuerdo con la base. Se generaron los tipos (`src/lib/supabase/types.ts`, `supabase gen types --linked`) para no usar `any` en las capas de datos.

# Fase 7 — Pruebas de RLS

Entrega: suite pgTAP que corre contra la base real (`supabase test db --linked`) y verifica los 6 casos de `docs/PRD.md` §9, dentro de una transacción que termina en `rollback`.

## Specs

**S1** — `anon` lee tablas, columnas y filas de tablas publicadas.
**S2** — `anon` no ve ninguna tabla, columna ni fila de una tabla oculta.
**S3** — `anon` no puede crear, editar ni borrar en ninguna tabla.
**S4** — Un usuario autenticado sin rol admin no puede escribir, tampoco ve tablas ocultas ni lee `user_roles`.
**S5** — Un usuario autenticado **con** rol admin escribe: crear/editar/borrar tablas y filas.
**S6** — `anon` y `authenticated` no pueden leer `user_roles`.
**S7** — Cada prueba corre en una transacción con `rollback`: no deja datos. Ninguna aserción cuenta filas absolutas (la base puede tener datos reales); todas se refieren a fixtures identificados por UUID.

## Tasks

**T1** Migración con `create extension pgtap` en `extensions` + `grant usage on schema extensions to anon, authenticated`.
**T2** `supabase/tests/rls.sql`: 18 aserciones.

## Log

**L1** — Pedido del usuario: "dale fase 7".

**L2** — **El runner de la CLI no corre como `postgres`.** Corre como un rol temporal (`cli_login_postgres`) cuyo `search_path` es `"$user", public` y que **no tiene USAGE sobre `extensions`**. PostgreSQL **ignora en silencio** los esquemas del `search_path` sin USAGE, así que `plan()` "no existía": `ERROR: function plan(integer) does not exist`. Solución: empezar el archivo con `set local role postgres` (la CLI permite ese cambio) antes de fijar `set local search_path = public, extensions`.
Diagnóstico: `pg_prove` no muestra descripciones ni la salida de psql, pero **sí muestra stderr**. Un `raise exception 'DIAG | ...'` con los datos adentro fue la forma de leerlos. Un archivo de diagnóstico con TAP a mano no sirve: el harness oculta los tests que pasan y resume los que fallan por número.

**L3** — **`set role` no actualiza el `search_path`**: hay que volver a fijarlo después de cada cambio de rol, o las funciones de aserción dejan de resolver.

**L4** — **RLS en `UPDATE`/`DELETE` no lanza excepción: filtra filas.** El primer intento esperaba `42501` y falló con "caught: no exception": `update` como `anon` afecta **0 filas** y no da error. El `42501` solo aparece en `INSERT` (violación de `WITH CHECK`) o cuando falta el privilegio. Se corrigió la aserción para comprobar el **resultado** (el dato quedó intacto, la tabla sigue existiendo) en vez del error, dentro de un `DO` con handler que tolera que el rechazo venga por permisos.

**L5** — Confirmado de paso: `anon` **conserva privilegios de escritura** por los default privileges del proyecto. Lo único que impide escribir es RLS; el GRANT no protege nada por sí solo.

**L6** — Resultado: `supabase test db --linked` → **`Result: PASS`, 18/18 tests, 6 s**. `plan(18)` verificado: los 16 originales más 2 aserciones de resultado que reemplazaron los `throws_ok` de UPDATE/DELETE.

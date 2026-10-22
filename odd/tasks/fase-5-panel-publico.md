# Fase 5 — Panel público

Entrega: `/` con buscador global y lista de tablas publicadas; `/tables/[id]` con columnas y filas en orden, buscador propio y paginación de 25; estados de carga, vacío y error. Solo lectura: la seguridad la impone RLS (Fase 3), acá no se escribe nada.

## Specs

**S1** — `/`: buscador general y lista de tablas publicadas con nombre y descripción. Las tablas ocultas **no** aparecen, ni siquiera para un admin (el filtro es explícito, no depende de RLS).

**S2** — `/tables/[id]`: columnas y filas en el orden definido por `columns.position`, con buscador propio y paginación de 25 filas. Si la tabla no existe o está oculta, se muestra un 404.

**S3** — Resultados de búsqueda: coincidencias agrupadas por tabla, con enlace a la vista correspondiente; máximo 5 por tabla, sin paginación global.

**S4** — Búsqueda sobre `rows.search_text` con `ILIKE` (trigramas). El término se escapa: `%` y `_` son comodines de SQL y no deben filtrar todo.

**S5** — Estados obligatorios: cargando; vacío distinguiendo **"no hay tablas"** de **"la búsqueda no encontró coincidencias"**; error con mensaje amable, sin detalles técnicos.

**S6** — TypeScript sin `any`. Consultas en `src/features/{tables,rows,search}`.

## Tasks

**T1** `features/tables/queries.ts` — listar publicadas, obtener una publicada con sus columnas, validar uuid.
**T2** `features/rows/queries.ts` — página de filas con `count` exacto y `escapeLike`.
**T3** `features/search/queries.ts` — búsqueda global agrupada, 5 por tabla.
**T4** `app/page.tsx` + componentes de lista y resultados (S1, S3, S5).
**T5** `app/tables/[id]/page.tsx` + tabla de filas y paginación (S2).
**T6** `app/not-found.tsx`, `app/error.tsx`, `loading.tsx` (S5).

## Log

**L1** — Pedido del usuario: "continua con lo siguiente" tras confirmar el login del admin.
**L2** — Base verificada por dump: RLS en las 4 tablas, 11 políticas, índice trigram, trigger y hook; `user_roles` con una fila `admin`.
**L3** — La base todavía **no tiene tablas** de usuario: `/` solo puede verificarse en estado vacío hasta que exista el panel de administración (Fase 6) o se cargue un fixture.

**L4** — **`loading.tsx` rompe el status 404.** Con un `loading.tsx` de ruta, `notFound()` renderizaba el cuerpo correcto pero respondía **HTTP 200**: el boundary de streaming envía las cabeceras antes de saber que la tabla no existe, y el status ya no se puede cambiar. Comprobado quitando los `loading.tsx`: el status pasó a `404`. Solución adoptada: el indicador de carga vive en un `<Suspense>` **dentro** de la página, y la existencia de la tabla se resuelve **antes** de cualquier boundary. Resultado: `/tables/<uuid inexistente>` → `404` real y `/` → `200` con fallback de carga.

**L5** — Verificado con la app corriendo: `/` → `200` + "Todavía no hay tablas publicadas"; `/?q=zzz` → `200` + "La búsqueda no encontró coincidencias"; `/tables/<uuid>` y `/tables/no-es-uuid` → `404` + "No encontramos esa tabla"; `/login` → `200`; `/api/supabase-check` → `200`.

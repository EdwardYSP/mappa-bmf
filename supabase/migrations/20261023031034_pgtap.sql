-- ============================================================================
-- pgTAP: pruebas de Row Level Security contra la base real
-- Referencia: docs/PRD.md seccion 9 (TEST-1 a TEST-6)
-- Las pruebas viven en supabase/tests/ y se ejecutan con:
--   supabase test db --linked
-- ============================================================================

create extension if not exists pgtap with schema extensions;

-- Las pruebas hacen `set local role anon` / `authenticated` para que RLS se
-- aplique de verdad, y las funciones de asercion (plan, is, throws_ok, ...)
-- viven en el esquema extensions. Sin USAGE sobre ese esquema, la asercion no
-- resuelve una vez cambiado el rol. Es el mismo esquema que PostgREST ya usa
-- a traves de extra_search_path.
grant usage on schema extensions to anon, authenticated;

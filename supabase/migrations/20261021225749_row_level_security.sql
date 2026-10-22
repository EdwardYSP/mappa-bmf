-- ============================================================================
-- Politicas de Row Level Security
-- Referencia: docs/PRD.md seccion 5 (RLS-1 a RLS-4, AUTH-5)
-- Regla del proyecto: ninguna tabla del esquema public queda sin RLS y toda
-- politica declara su rol (anon o authenticated).
-- ============================================================================

alter table public.tables     enable row level security;
alter table public.columns    enable row level security;
alter table public.rows       enable row level security;
alter table public.user_roles enable row level security;

-- AUTH-5: el rol viaja en el claim user_role del token, que agrega el Auth Hook.
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'user_role', '') = 'admin';
$$;

comment on function public.is_admin() is
  'true si el token incluye el claim user_role = admin (RLS-4).';

-- Privilegios explicitos: no dependemos de los default privileges del proyecto.
-- La seguridad la impone RLS, no el GRANT; el GRANT solo habilita la operacion.
grant select on public.tables, public.columns, public.rows to anon, authenticated;
grant insert, update, delete on public.tables, public.columns, public.rows to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- tables --------------------------------------------------------------------
-- RLS-1: el publico solo ve tablas publicadas.
create policy tables_select_public on public.tables
  for select to anon, authenticated
  using (status = 'published');

-- RLS-4: el admin ve todas, publicadas y ocultas.
create policy tables_select_admin on public.tables
  for select to authenticated
  using (public.is_admin());

create policy tables_insert_admin on public.tables
  for insert to authenticated
  with check (public.is_admin());

create policy tables_update_admin on public.tables
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy tables_delete_admin on public.tables
  for delete to authenticated
  using (public.is_admin());

-- columns -------------------------------------------------------------------
-- Lectura publica solo si la tabla padre esta publicada.
create policy columns_select_public on public.columns
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.tables t
      where t.id = columns.table_id
        and t.status = 'published'
    )
  );

create policy columns_select_admin on public.columns
  for select to authenticated
  using (public.is_admin());

-- for all cubre insert, update y delete: solo el admin escribe.
create policy columns_write_admin on public.columns
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- rows ----------------------------------------------------------------------
create policy rows_select_public on public.rows
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.tables t
      where t.id = rows.table_id
        and t.status = 'published'
    )
  );

create policy rows_select_admin on public.rows
  for select to authenticated
  using (public.is_admin());

create policy rows_write_admin on public.rows
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- user_roles ----------------------------------------------------------------
-- RLS-3: ni anon ni authenticated la leen. Sin politicas, con RLS habilitado,
-- el acceso queda denegado para todos salvo el owner (postgres) y las
-- funciones security definer, que es exactamente lo que necesita el Auth Hook.
revoke all on public.user_roles from anon, authenticated;

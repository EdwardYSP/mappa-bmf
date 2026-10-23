-- ============================================================================
-- Panel de tablas con Supabase: esquema base
-- Referencia: docs/PRD.md secciones 4.1 a 4.7 (DATA-*, INDEX-*)
-- Solo crea objetos. No hay DROP ni borrado de datos.
-- ============================================================================

create extension if not exists pg_trgm;

-- Tipos de dominio -----------------------------------------------------------
create type public.table_status as enum ('published', 'hidden');   -- DATA-1
create type public.column_type  as enum ('text', 'number', 'date', 'boolean'); -- DATA-2
create type public.user_role    as enum ('admin', 'user');         -- DATA-4

-- updated_at ----------------------------------------------------------------
-- Fuente unica de "ultima modificacion" en las tablas que exponen la columna.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- tables --------------------------------------------------------------------
create table public.tables (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text not null default '',
  status      public.table_status not null default 'hidden',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.tables is
  'Metadatos de cada tabla creada por el administrador (DATA-1).';

-- DATA-1.1: la unicidad de name no distingue mayusculas ("Ventas" = "ventas").
create unique index tables_name_lower_key on public.tables (lower(name));

create trigger tables_set_updated_at
  before update on public.tables
  for each row execute function public.set_updated_at();

-- columns -------------------------------------------------------------------
create table public.columns (
  id       uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.tables (id) on delete cascade,
  name     text not null,
  type     public.column_type not null,
  position integer not null,
  -- DATA-2.1: el nombre es la clave dentro de rows.data, no puede repetirse.
  constraint columns_table_name_key unique (table_id, name),
  -- Diferida a proposito: reordenar columnas intercambia posiciones dentro de
  -- una misma transaccion. La unicidad se valida igual, al hacer commit.
  constraint columns_table_position_key unique (table_id, position)
    deferrable initially deferred
);

create index columns_table_id_idx on public.columns (table_id);  -- INDEX-2

-- rows ----------------------------------------------------------------------
create table public.rows (
  id          uuid primary key default gen_random_uuid(),
  table_id    uuid not null references public.tables (id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  search_text text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- DATA-3: data guarda "nombre de columna" como clave, asi que es un objeto.
  constraint rows_data_is_object check (jsonb_typeof(data) = 'object')
);

create index rows_table_id_idx on public.rows (table_id);  -- INDEX-3

-- DATA-3.1: busqueda por trigramas; encuentra fragmentos ("jua" -> "Juan").
-- gin_trgm_ops pertenece a la extension pg_trgm.
create index rows_search_text_trgm_idx
  on public.rows using gin (search_text gin_trgm_ops);  -- INDEX-4

create trigger rows_set_updated_at
  before update on public.rows
  for each row execute function public.set_updated_at();

-- DATA-3.2: search_text concatena TODOS los valores de data convertidos a
-- texto (numeros, fechas y booleanos incluidos) y omite nulos y vacios.
create or replace function public.rows_sync_search_text()
returns trigger
language plpgsql
as $$
begin
  new.search_text := coalesce(
    (
      select string_agg(kv.value, ' ' order by kv.key)
      from jsonb_each_text(new.data) as kv(key, value)
      where kv.value is not null and btrim(kv.value) <> ''
    ),
    ''
  );
  return new;
end;
$$;

create trigger rows_sync_search_text
  before insert or update on public.rows
  for each row execute function public.rows_sync_search_text();

-- user_roles ----------------------------------------------------------------
create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role    public.user_role not null,
  -- DATA-4.1: combinacion unica por usuario y rol.
  constraint user_roles_user_id_role_key unique (user_id, role)
);

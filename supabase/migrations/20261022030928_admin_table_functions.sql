-- ============================================================================
-- Fase 6: guardado atomico de una tabla con sus columnas
-- Referencia: docs/PRD.md §4.6, DATA-6.1, NFR-SEC-7
--
-- Crear o editar una tabla toca dos tablas (tables + columns) y, al renombrar
-- o borrar columnas, reescribe rows.data de todas las filas. Con llamadas
-- sueltas a PostgREST un fallo intermedio deja el esquema a medias; por eso va
-- todo en una funcion.
--
-- security invoker: NO se salta RLS. La autorizacion sigue siendo la politica
-- "solo admin escribe". Si se declarara security definer, cualquier
-- authenticated podria reescribir datos sin pasar por las politicas.
-- ============================================================================

create or replace function public.save_table_with_columns(
  p_table_id uuid,
  p_name text,
  p_description text,
  p_status public.table_status,
  p_columns jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_table_id uuid;
  v_column jsonb;
  v_existing record;
  v_kept_ids uuid[] := '{}';
  v_column_id uuid;
  v_old_name text;
  v_new_name text;
begin
  if p_name is null or btrim(p_name) = '' then
    raise exception 'El nombre de la tabla es obligatorio' using errcode = '22023';
  end if;

  if p_columns is null or jsonb_typeof(p_columns) <> 'array' then
    raise exception 'Las columnas deben enviarse como un array' using errcode = '22023';
  end if;

  -- S2: una tabla siempre tiene al menos una columna definida.
  if jsonb_array_length(p_columns) = 0 then
    raise exception 'La tabla necesita al menos una columna' using errcode = '22023';
  end if;

  if p_table_id is null then
    insert into public.tables (name, description, status)
    values (btrim(p_name), coalesce(p_description, ''), p_status)
    returning id into v_table_id;
  else
    update public.tables
       set name = btrim(p_name),
           description = coalesce(p_description, ''),
           status = p_status
     where id = p_table_id
    returning id into v_table_id;

    if v_table_id is null then
      raise exception 'La tabla no existe' using errcode = 'P0002';
    end if;
  end if;

  for v_column in select * from jsonb_array_elements(p_columns) loop
    v_new_name := btrim(coalesce(v_column ->> 'name', ''));

    if v_new_name = '' then
      raise exception 'Cada columna necesita un nombre' using errcode = '22023';
    end if;

    v_column_id := nullif(v_column ->> 'id', '')::uuid;

    if v_column_id is null then
      insert into public.columns (table_id, name, type, position)
      values (
        v_table_id,
        v_new_name,
        (v_column ->> 'type')::public.column_type,
        (v_column ->> 'position')::integer
      )
      returning id into v_column_id;
    else
      select name into v_old_name
        from public.columns
       where id = v_column_id and table_id = v_table_id;

      if v_old_name is null then
        raise exception 'La columna % no pertenece a esta tabla', v_column_id
          using errcode = '22023';
      end if;

      update public.columns
         set name = v_new_name,
             type = (v_column ->> 'type')::public.column_type,
             position = (v_column ->> 'position')::integer
       where id = v_column_id;

      -- DATA-6.1: renombrar migra la clave en rows.data. El trigger de
      -- search_text vuelve a calcularse solo, porque esto es un UPDATE.
      if v_old_name <> v_new_name then
        update public.rows
           set data = (data - v_old_name)
                      || jsonb_build_object(v_new_name, data -> v_old_name)
         where table_id = v_table_id
           and data ? v_old_name;
      end if;
    end if;

    v_kept_ids := v_kept_ids || v_column_id;
  end loop;

  -- DATA-6.1: las columnas que ya no vienen en el formulario se borran, y su
  -- clave desaparece de todas las filas. Es la operacion destructiva del panel.
  for v_existing in
    select id, name
      from public.columns
     where table_id = v_table_id
       and not (id = any (v_kept_ids))
  loop
    update public.rows
       set data = data - v_existing.name
     where table_id = v_table_id
       and data ? v_existing.name;

    delete from public.columns where id = v_existing.id;
  end loop;

  return v_table_id;
end;
$$;

comment on function public.save_table_with_columns(uuid, text, text, public.table_status, jsonb) is
  'Crea (p_table_id null) o actualiza una tabla con sus columnas en una transaccion. Migra o borra las claves de rows.data al renombrar o borrar columnas (DATA-6.1).';

-- Least privilege: el panel la llama como usuario autenticado; RLS decide.
revoke execute on function public.save_table_with_columns(uuid, text, text, public.table_status, jsonb)
  from anon, public;
grant execute on function public.save_table_with_columns(uuid, text, text, public.table_status, jsonb)
  to authenticated;

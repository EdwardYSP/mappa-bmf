-- ============================================================================
-- Datos de demostracion para observar el comportamiento con volumen.
--
-- Por que una migracion y no supabase/seed.sql: la CLI registra los seeds ya
-- aplicados (supabase_migrations.seed_files) y NO vuelve a ejecutar un seed
-- modificado. Los seeds sirven para `db reset` local; para cargar datos en el
-- proyecto enlazado, la via confiable es una migracion.
--
-- Es IDEMPOTENTE: completa cada tabla HASTA la cantidad pedida, nunca inserta
-- de mas. Si una tabla ya existe, usa SUS columnas reales y genera un valor
-- acorde al tipo de cada una.
--
-- Para borrar estos datos: delete from public.tables where name in (...);
-- (la cascada se lleva columnas y filas) o poné esas tablas en estado hidden.
-- ============================================================================

-- El runner de la CLI no es el owner de las tablas: sin esto, RLS filtraria los
-- inserts y la migracion terminaria "bien" sin haber insertado nada.
set role postgres;

do $$
declare
  v_defs jsonb := $defs$[
    {"name":"Empleados","description":"Personal de la empresa","rows":200,
     "columns":[{"name":"Nombre","type":"text"},{"name":"Edad","type":"number"},{"name":"Ingreso","type":"date"},{"name":"signo","type":"text"}]},
    {"name":"cosas","description":"Cosas sueltas","rows":100,
     "columns":[{"name":"nombre","type":"text"},{"name":"cantidad","type":"number"}]},
    {"name":"Clientes","description":"Clientes de la empresa","rows":200,
     "columns":[{"name":"nombre","type":"text"},{"name":"email","type":"text"},{"name":"alta","type":"date"},{"name":"activo","type":"boolean"}]},
    {"name":"Productos","description":"Catalogo","rows":200,
     "columns":[{"name":"nombre","type":"text"},{"name":"precio","type":"number"},{"name":"stock","type":"number"},{"name":"activo","type":"boolean"}]},
    {"name":"Pedidos","description":"Pedidos recibidos","rows":200,
     "columns":[{"name":"cliente","type":"text"},{"name":"total","type":"number"},{"name":"fecha","type":"date"}]},
    {"name":"Facturas","description":"Facturas emitidas","rows":200,
     "columns":[{"name":"numero","type":"text"},{"name":"importe","type":"number"},{"name":"emitida","type":"date"}]},
    {"name":"Proveedores","description":"Proveedores","rows":200,
     "columns":[{"name":"nombre","type":"text"},{"name":"contacto","type":"text"},{"name":"alta","type":"date"}]},
    {"name":"Proyectos","description":"Proyectos en curso","rows":200,
     "columns":[{"name":"nombre","type":"text"},{"name":"presupuesto","type":"number"},{"name":"inicio","type":"date"},{"name":"activo","type":"boolean"}]},
    {"name":"Tareas","description":"Tareas por proyecto","rows":200,
     "columns":[{"name":"titulo","type":"text"},{"name":"horas","type":"number"},{"name":"vence","type":"date"}]},
    {"name":"Gastos","description":"Gastos operativos","rows":200,
     "columns":[{"name":"concepto","type":"text"},{"name":"monto","type":"number"},{"name":"fecha","type":"date"}]},
    {"name":"Almacenes","description":"Depositos","rows":200,
     "columns":[{"name":"nombre","type":"text"},{"name":"capacidad","type":"number"},{"name":"activo","type":"boolean"}]},
    {"name":"Categorias","description":"Categorias de productos","rows":200,
     "columns":[{"name":"nombre","type":"text"},{"name":"orden","type":"number"}]}
  ]$defs$::jsonb;
  v_def jsonb;
  v_col jsonb;
  v_table_id uuid;
  v_pos integer;
  v_target integer;
  v_missing integer;
  v_total integer := 0;
  v_created integer := 0;
  v_i integer;
  v_data jsonb;
begin
  for v_def in select value from jsonb_array_elements(v_defs) loop
    v_target := (v_def ->> 'rows')::integer;

    select id into v_table_id
      from public.tables
     where lower(name) = lower(v_def ->> 'name');

    if v_table_id is null then
      insert into public.tables (name, description, status)
      values (v_def ->> 'name', coalesce(v_def ->> 'description', ''), 'published')
      returning id into v_table_id;

      v_pos := 0;
      for v_col in select value from jsonb_array_elements(v_def -> 'columns') loop
        v_pos := v_pos + 1;
        insert into public.columns (table_id, name, type, position)
        values (v_table_id, v_col ->> 'name', (v_col ->> 'type')::public.column_type, v_pos);
      end loop;

      v_created := v_created + 1;
    end if;

    select v_target - count(*) into v_missing
      from public.rows
     where table_id = v_table_id;

    if v_missing > 0 then
      for v_i in 1..v_missing loop
        select jsonb_object_agg(
                 c.name,
                 case c.type
                   when 'text' then
                     to_jsonb(
                       case
                         when c.name ilike '%email%'
                           then 'persona' || (v_i + 1000) || '@ejemplo.com'
                         else initcap(c.name) || ' ' || v_i
                       end
                     )
                   when 'number' then to_jsonb((v_i * 7) % 1000)
                   when 'date' then to_jsonb(to_char(date '2020-01-01' + ((v_i * 11) % 1800), 'YYYY-MM-DD'))
                   when 'boolean' then to_jsonb(v_i % 2 = 0)
                 end
               )
          into v_data
          from public.columns c
         where c.table_id = v_table_id;

        insert into public.rows (table_id, data) values (v_table_id, v_data);
      end loop;

      v_total := v_total + v_missing;
    end if;
  end loop;

  raise notice 'seed: % tablas creadas, % filas insertadas', v_created, v_total;
end;
$$;

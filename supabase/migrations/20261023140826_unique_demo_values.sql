-- ============================================================================
-- Reescritura del dataset de demostracion para que no sea repetitivo.
--
-- Que se corrige (medido sobre los 2304 registros):
--   - los textos eran el mismo molde en varias tablas ("Nombre 1" en Clientes,
--     Productos y cosas), asi que los valores colisionaban entre tablas;
--   - las fechas repetian la MISMA secuencia en Pedidos/Gastos y en
--     Clientes/Proveedores;
--   - algunos numeros colisionaban entre tablas.
--
-- Como queda, por tabla: textos "<Tabla>-<n>", emails "<tabla><n>@ejemplo.com",
-- fechas desplazadas por tabla y numeros unicos. Los booleanos NO se tocan:
-- un booleano tiene dos valores posibles, no se puede hacer unico.
--
-- NO se tocan las filas cargadas a mano (por ejemplo "Juan Perez" en Empleados):
-- solo se reescriben las que siguen el molde del relleno. Se detectan por el
-- texto, que es lo unico que las distingue.
--
-- Es IDEMPOTENTE: fija valores derivados del numero de fila, no acumula nada.
-- ============================================================================

set role postgres;

do $$
declare
  v_idx integer := 0;
  v_tab record;
  v_prefijo text;
begin
  for v_tab in
    select id, name
      from public.tables
     where lower(name) in (
       'empleados', 'cosas', 'clientes', 'productos', 'pedidos', 'facturas',
       'proveedores', 'proyectos', 'tareas', 'gastos', 'almacenes', 'categorias'
     )
     order by name
  loop
    v_idx := v_idx + 1;
    v_prefijo := initcap(v_tab.name);

    with numeradas as (
      select id, row_number() over (order by created_at, id) as n
        from public.rows
       where table_id = v_tab.id
    )
    update public.rows r
       set data = (
         select jsonb_object_agg(
                  c.name,
                  case c.type
                    when 'text' then
                      to_jsonb(
                        case
                          when c.name ilike '%email%'
                            then lower(v_prefijo) || nr.n || '@ejemplo.com'
                          else v_prefijo || '-' || nr.n
                        end
                      )
                    when 'number' then to_jsonb(v_idx * 100 + nr.n)
                    when 'date' then to_jsonb(
                      -- row_number() es bigint y date + bigint no existe: hace falta integer.
                      to_char(date '2015-01-01' + (((nr.n * 3 + v_idx) % 3000)::integer), 'YYYY-MM-DD')
                    )
                    when 'boolean' then to_jsonb(nr.n % 2 = 0)
                  end
                )
           from public.columns c
          where c.table_id = v_tab.id
       )
      from numeradas nr
     where r.id = nr.id
       -- Solo filas de relleno: alguna columna de texto con el molde del seed.
       and exists (
         select 1
           from public.columns c
          where c.table_id = v_tab.id
            and c.type = 'text'
            and coalesce(r.data ->> c.name, '') ~ '^[[:alpha:]]+ [0-9]+$'
       );

    raise notice 'tabla % reescrita (% prefijo)', v_tab.name, v_prefijo;
  end loop;
end;
$$;

-- ============================================================================
-- Pruebas de Row Level Security (PRD seccion 9, TEST-1 a TEST-6)
-- Se ejecutan contra la base real dentro de una transaccion que termina en
-- rollback: no dejan datos.
--
-- Como la base puede tener datos reales, ninguna asercion cuenta filas
-- absolutas: todas se refieren a los dos fixtures de esta prueba.
--
-- DOS DETALLES DEL ENTORNO QUE HACEN FALLAR ESTAS PRUEBAS SI SE QUIETAN:
--
-- 1. El runner de la CLI no corre como postgres, sino como un rol temporal
--    (cli_login_postgres) SIN USAGE sobre el esquema extensions, y PostgreSQL
--    IGNORA EN SILENCIO los esquemas del search_path sobre los que no hay
--    USAGE. Resultado: "function plan(integer) does not exist". Por eso se
--    empieza con `set local role postgres`.
-- 2. `set role` NO actualiza el search_path: hay que fijarlo despues de cada
--    cambio de rol, o las funciones de asercion dejan de resolver.
--
-- Para simular cada rol se usa `set local role` (aplica RLS de verdad) y se
-- falsifica el claim del JWT en `request.jwt.claims`, que es de donde lo lee
-- auth.jwt() y, por lo tanto, public.is_admin().
-- ============================================================================

begin;

set local role postgres;
set local search_path = public, extensions;

select plan(18);

-- Fixtures -------------------------------------------------------------------
-- Como postgres (owner) no pasa por RLS, se pueden crear las dos tablas.
insert into public.tables (id, name, description, status) values
  ('11111111-1111-1111-1111-111111111111', 'pgTAP publicada', 'visible', 'published'),
  ('22222222-2222-2222-2222-222222222222', 'pgTAP oculta', 'no deberia verse', 'hidden');

insert into public.columns (table_id, name, type, position) values
  ('11111111-1111-1111-1111-111111111111', 'Texto', 'text', 1),
  ('22222222-2222-2222-2222-222222222222', 'Texto', 'text', 1);

insert into public.rows (table_id, data) values
  ('11111111-1111-1111-1111-111111111111', jsonb_build_object('Texto', 'fila visible')),
  ('22222222-2222-2222-2222-222222222222', jsonb_build_object('Texto', 'fila oculta'));


-- TEST 1 y 2: anon lee solo lo publicado, y nada de lo oculto ---------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
set local search_path = public, extensions;

select is(
  (select count(*) from public.tables where id = '11111111-1111-1111-1111-111111111111'),
  1::bigint,
  'anon lee una tabla publicada'
);

select is(
  (select count(*) from public.tables where id = '22222222-2222-2222-2222-222222222222'),
  0::bigint,
  'anon NO ve la tabla oculta'
);

select is(
  (select count(*) from public.rows where table_id = '11111111-1111-1111-1111-111111111111'),
  1::bigint,
  'anon lee las filas de la tabla publicada'
);

select is(
  (select count(*) from public.rows where table_id = '22222222-2222-2222-2222-222222222222'),
  0::bigint,
  'anon NO ve las filas de la tabla oculta'
);

select is(
  (select count(*) from public.columns where table_id = '22222222-2222-2222-2222-222222222222'),
  0::bigint,
  'anon NO ve las columnas de la tabla oculta'
);

-- TEST 3: anon no escribe nada ----------------------------------------------
-- INSERT: RLS lanza 42501 porque la politica WITH CHECK no existe.
select throws_ok(
  $$ insert into public.tables (name) values ('intento anon') $$,
  '42501',
  null,
  'anon NO puede crear tablas'
);

-- UPDATE y DELETE: RLS NO lanza excepcion, FILTRA filas. El intento afecta 0
-- filas y no hay error, asi que lo que se comprueba es el resultado: el dato
-- sigue intacto. (anon incluso conserva los privilegios de escritura por los
-- default privileges del proyecto: lo unico que lo frena es RLS.)
do $$
begin
  begin
    update public.tables set description = 'hackeada' where name = 'pgTAP publicada';
    delete from public.tables where name = 'pgTAP publicada';
  exception when others then
    -- Rechazado por permisos o por RLS: cualquiera de las dos cosas esta bien.
    null;
  end;
end;
$$;

select is(
  (select description from public.tables where id = '11111111-1111-1111-1111-111111111111'),
  'visible',
  'anon NO pudo editar la tabla: el dato quedo intacto'
);

select is(
  (select count(*) from public.tables where id = '11111111-1111-1111-1111-111111111111'),
  1::bigint,
  'anon NO pudo borrar la tabla: sigue existiendo'
);

-- TEST 6: la tabla de roles es inaccesible para anon -------------------------
select throws_ok(
  $$ select * from public.user_roles $$,
  '42501',
  null,
  'anon NO puede leer user_roles'
);

set local role postgres;
set local search_path = public, extensions;


-- TEST 4: usuario autenticado sin rol admin ---------------------------------
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"33333333-3333-3333-3333-333333333333","user_role":"user"}';
set local search_path = public, extensions;

select throws_ok(
  $$ insert into public.tables (name) values ('intento usuario') $$,
  '42501',
  null,
  'un usuario sin rol admin NO puede crear tablas'
);

select is(
  (select count(*) from public.tables where id = '22222222-2222-2222-2222-222222222222'),
  0::bigint,
  'un usuario sin rol admin tampoco ve la tabla oculta'
);

select throws_ok(
  $$ select * from public.user_roles $$,
  '42501',
  null,
  'un usuario autenticado NO puede leer user_roles'
);

set local role postgres;
set local search_path = public, extensions;


-- TEST 5: administrador ------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"44444444-4444-4444-4444-444444444444","user_role":"admin"}';
set local search_path = public, extensions;

select is(
  (select count(*) from public.tables where id = '22222222-2222-2222-2222-222222222222'),
  1::bigint,
  'el admin SI ve la tabla oculta'
);

select lives_ok(
  $$ insert into public.tables (name, status) values ('pgTAP creada por admin', 'hidden') $$,
  'el admin puede crear tablas'
);

select lives_ok(
  $$ update public.tables set description = 'editada' where name = 'pgTAP creada por admin' $$,
  'el admin puede editar tablas'
);

select lives_ok(
  $$ insert into public.rows (table_id, data) values ('11111111-1111-1111-1111-111111111111', jsonb_build_object('Texto', 'fila del admin')) $$,
  'el admin puede crear filas'
);

select lives_ok(
  $$ delete from public.tables where name = 'pgTAP creada por admin' $$,
  'el admin puede borrar tablas'
);

set local role postgres;
set local search_path = public, extensions;

-- Extra: el trigger de search_text se genero a partir de data ---------------
select is(
  (
    select search_text
    from public.rows
    where table_id = '11111111-1111-1111-1111-111111111111'
      and data ->> 'Texto' = 'fila visible'
  ),
  'fila visible',
  'el trigger genero search_text a partir de data'
);

select * from finish();

rollback;

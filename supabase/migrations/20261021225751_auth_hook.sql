-- ============================================================================
-- Auth Hook: Custom Access Token
-- Referencia: docs/PRD.md seccion 5.3 (AUTH-1 a AUTH-6)
-- OJO: esta migracion solo crea la funcion. El hook se HABILITA en el dashboard:
--   Authentication > Hooks > Custom Access Token > public.custom_access_token_hook
-- Hasta habilitarlo, el token no lleva user_role y nadie es admin.
-- ============================================================================

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
-- security definer: la ejecuta supabase_auth_admin, y user_roles no tiene
-- politicas RLS a proposito (RLS-3). Sin security definer la lectura devuelve
-- cero filas y nadie seria admin nunca.
security definer
-- search_path vacio: todas las referencias van calificadas, sin sorpresas.
set search_path = ''
as $$
declare
  claims jsonb;
  v_is_admin boolean;
begin
  select coalesce(bool_or(role = 'admin'), false)
  into v_is_admin
  from public.user_roles
  where user_id = (event ->> 'user_id')::uuid;

  -- Sin fila en user_roles el usuario es 'user', que es exactamente el
  -- comportamiento del visitante autenticado sin rol admin (RLS-4).
  claims := coalesce(event -> 'claims', '{}'::jsonb);
  claims := jsonb_set(
    claims,
    '{user_role}',
    to_jsonb(case when v_is_admin then 'admin' else 'user' end),
    true
  );

  return jsonb_set(event, '{claims}', claims);
end;
$$;

comment on function public.custom_access_token_hook(jsonb) is
  'Agrega el claim user_role (admin|user) al token. Sin fila en user_roles: user.';

-- AUTH-4: solo el servicio de autenticacion puede ejecutarla.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant select on public.user_roles to supabase_auth_admin;

revoke execute on function public.custom_access_token_hook(jsonb)
  from anon, authenticated, public;

-- Cuenta y perfil (SPEC 09): bucket de avatares, si el usuario tiene
-- contraseña y borrado de la cuenta con 30 días de gracia. La marca del
-- borrado vive en auth.users.raw_app_meta_data (deletion_requested_at): el
-- proxy la lee del getUser() que ya hace y el usuario no la puede editar.

-- Bucket de avatares: público para leer, 1 MB, solo WebP. El cliente recorta
-- y sube un WebP de 256×256 a avatars/<user_id>/<uuid>.webp
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/webp']);

-- Cada usuario solo escribe en su propia carpeta
create policy "avatars_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ¿El usuario tiene contraseña? Los que solo entran con OAuth no
create function public.has_password()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select u.encrypted_password is not null and u.encrypted_password <> ''
      from auth.users u
      where u.id = (select auth.uid())
    ),
    false
  );
$$;

-- Programa el borrado. Idempotente: si ya hay marca, devuelve la existente
create function public.request_account_deletion()
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_requested_at timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'No hay sesión'
      using errcode = 'insufficient_privilege';
  end if;

  select (u.raw_app_meta_data ->> 'deletion_requested_at')::timestamptz
  into v_requested_at
  from auth.users u
  where u.id = (select auth.uid())
  for update;

  if v_requested_at is not null then
    return v_requested_at;
  end if;

  v_requested_at := now();

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('deletion_requested_at', v_requested_at)
  where id = (select auth.uid());

  return v_requested_at;
end;
$$;

-- Restaura la cuenta durante el periodo de gracia
create function public.cancel_account_deletion()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update auth.users
  set raw_app_meta_data = raw_app_meta_data - 'deletion_requested_at'
  where id = (select auth.uid());
$$;

-- Purga las cuentas marcadas hace más de 30 días. El borrado baja en cascada
-- a profiles, workspaces y todas las tablas del espacio. La llama pg_cron
create function public.purge_deleted_accounts()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from auth.users
  where (raw_app_meta_data ->> 'deletion_requested_at')::timestamptz
    < now() - interval '30 days';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function public.has_password() from public, anon;
grant execute on function public.has_password() to authenticated;

revoke execute on function public.request_account_deletion() from public, anon;
grant execute on function public.request_account_deletion() to authenticated;

revoke execute on function public.cancel_account_deletion() from public, anon;
grant execute on function public.cancel_account_deletion() to authenticated;

-- Solo pg_cron la ejecuta; no se expone como RPC
revoke execute on function public.purge_deleted_accounts() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;

-- 08:00 UTC = 03:00 America/Bogota
select cron.schedule(
  'purge-deleted-accounts',
  '0 8 * * *',
  $$select public.purge_deleted_accounts()$$
);

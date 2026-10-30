-- Perfiles y espacios (Personal/Empresa) de cada usuario.
-- Las filas las crea el trigger on_auth_user_created; el cliente solo lee
-- y actualiza su propio perfil.

create type public.workspace_type as enum ('personal', 'business');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  avatar_url text,
  currency char(3) not null default 'COP',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  type public.workspace_type not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un solo espacio Personal por usuario; Empresas ilimitadas (futuro)
create unique index workspaces_one_personal_per_owner
  on public.workspaces (owner_id) where type = 'personal';

-- RLS
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "workspaces_select_own"
  on public.workspaces for select
  to authenticated
  using (owner_id = (select auth.uid()));

-- Perfil y espacio Personal al registrarse (email u OAuth)
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  );

  insert into public.workspaces (owner_id, type, name)
  values (new.id, 'personal', 'Personal');

  return new;
end;
$$;

-- Solo el trigger la ejecuta; no se expone como RPC
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

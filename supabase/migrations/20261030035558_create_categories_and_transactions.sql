-- Categorías (del sistema y propias por espacio) y movimientos del usuario.
-- También deja is_workspace_owner y set_updated_at, que reutilizan las
-- tablas de los specs siguientes.

-- Reutilizable por todas las tablas con datos de un espacio. Es security
-- invoker: la política select de workspaces ya limita las filas al dueño.
create function public.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.workspaces
    where id = p_workspace_id and owner_id = (select auth.uid())
  );
$$;

-- Reutilizable por todas las tablas con updated_at
create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create type public.transaction_type as enum ('income', 'expense');

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade, -- null = del sistema
  type public.transaction_type not null,
  name text not null check (char_length(name) between 1 and 40),
  icon text not null,  -- clave de CATEGORY_ICONS
  color text not null, -- clave de CATEGORY_COLORS
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Nombre único por espacio y tipo, sin distinguir mayúsculas
create unique index categories_unique_name
  on public.categories (workspace_id, type, lower(name))
  where workspace_id is not null;

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  type public.transaction_type not null,
  amount numeric(14, 2) not null check (amount > 0),
  category_id uuid not null references public.categories (id) on delete restrict,
  occurred_on date not null,
  description text not null check (char_length(description) between 1 and 120),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transactions_workspace_date
  on public.transactions (workspace_id, occurred_on desc, created_at desc);
create index transactions_category on public.transactions (category_id);

-- Triggers
create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- La categoría debe tener el mismo tipo que el movimiento y ser del sistema
-- o del mismo espacio, aunque el cliente se salte la validación
create function public.check_transaction_category()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.categories
    where id = new.category_id
      and type = new.type
      and (workspace_id is null or workspace_id = new.workspace_id)
  ) then
    raise exception 'La categoría no corresponde al tipo o al espacio del movimiento'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger transactions_check_category
  before insert or update on public.transactions
  for each row execute function public.check_transaction_category();

-- Las funciones de trigger no se exponen como RPC
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.check_transaction_category() from public, anon, authenticated;

-- Semilla de categorías del sistema
insert into public.categories (workspace_id, type, name, icon, color) values
  (null, 'income', 'Salario', 'briefcase', 'emerald'),
  (null, 'income', 'Freelance', 'laptop', 'teal'),
  (null, 'income', 'Otros ingresos', 'coins', 'lime'),
  (null, 'expense', 'Vivienda', 'home', 'amber'),
  (null, 'expense', 'Comida', 'utensils', 'orange'),
  (null, 'expense', 'Transporte', 'car', 'sky'),
  (null, 'expense', 'Salud', 'heart-pulse', 'rose'),
  (null, 'expense', 'Educación', 'graduation-cap', 'indigo'),
  (null, 'expense', 'Ocio', 'gamepad', 'violet'),
  (null, 'expense', 'Servicios', 'zap', 'blue'),
  (null, 'expense', 'Compras', 'shopping-bag', 'pink'),
  (null, 'expense', 'Otros gastos', 'receipt', 'slate');

-- RLS
alter table public.categories enable row level security;
alter table public.transactions enable row level security;

create policy "categories_select_system_or_own"
  on public.categories for select
  to authenticated
  using (workspace_id is null or public.is_workspace_owner(workspace_id));

create policy "categories_insert_own"
  on public.categories for insert
  to authenticated
  with check (workspace_id is not null and public.is_workspace_owner(workspace_id));

create policy "categories_update_own"
  on public.categories for update
  to authenticated
  using (workspace_id is not null and public.is_workspace_owner(workspace_id))
  with check (workspace_id is not null and public.is_workspace_owner(workspace_id));

-- Sin política de delete: las categorías solo se archivan

create policy "transactions_select_own"
  on public.transactions for select
  to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy "transactions_insert_own"
  on public.transactions for insert
  to authenticated
  with check (public.is_workspace_owner(workspace_id));

create policy "transactions_update_own"
  on public.transactions for update
  to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy "transactions_delete_own"
  on public.transactions for delete
  to authenticated
  using (public.is_workspace_owner(workspace_id));

-- Totales de ingresos y gastos con los mismos filtros que la tabla.
-- Los parámetros null no filtran. Respeta RLS (security invoker).
create function public.transaction_totals(
  p_workspace_id uuid,
  p_from date default null,
  p_to date default null,
  p_type public.transaction_type default null,
  p_category_id uuid default null,
  p_search text default null
)
returns table (income numeric, expense numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with pattern as (
    select '%' || replace(replace(replace(p_search, '\', '\\'), '%', '\%'), '_', '\_') || '%' as value
  )
  select
    coalesce(sum(t.amount) filter (where t.type = 'income'), 0) as income,
    coalesce(sum(t.amount) filter (where t.type = 'expense'), 0) as expense
  from public.transactions t, pattern p
  where t.workspace_id = p_workspace_id
    and (p_from is null or t.occurred_on >= p_from)
    and (p_to is null or t.occurred_on <= p_to)
    and (p_type is null or t.type = p_type)
    and (p_category_id is null or t.category_id = p_category_id)
    and (
      p_search is null
      or t.description ilike p.value
      or t.note ilike p.value
    );
$$;

revoke execute on function public.transaction_totals(uuid, date, date, public.transaction_type, uuid, text) from public, anon;
grant execute on function public.transaction_totals(uuid, date, date, public.transaction_type, uuid, text) to authenticated;

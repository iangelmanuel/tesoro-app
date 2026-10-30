-- Importación de movimientos desde Excel o CSV (SPEC 08). El archivo se lee
-- en el navegador: aquí solo llegan las filas ya mapeadas. imports no tiene
-- políticas de escritura, así que solo las RPC security definer escriben y
-- el historial no se puede falsear desde el cliente.

create type public.import_status as enum ('completed', 'undone');

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  filename text not null check (char_length(filename) between 1 and 255),
  sheets text[] not null default '{}', -- hojas importadas; vacío en CSV
  status public.import_status not null default 'completed',
  stats jsonb not null, -- ImportStats
  created_at timestamptz not null default now(),
  undone_at timestamptz,
  check ((status = 'undone') = (undone_at is not null))
);

create index imports_workspace on public.imports (workspace_id, created_at desc);

alter table public.transactions
  add column import_id uuid references public.imports (id) on delete set null;

create index transactions_import on public.transactions (import_id)
  where import_id is not null;

-- RLS
alter table public.imports enable row level security;

create policy "imports_select_own"
  on public.imports for select
  to authenticated
  using (public.is_workspace_owner(workspace_id));

-- Sin políticas de insert, update ni delete: solo escriben las RPC

-- Crea el import, las categorías nuevas y los movimientos en una sola
-- transacción. p_new_categories: [{ key, type, name }]. p_rows: [{ type,
-- amount, occurred_on, category_id | new_category_key, description, note }].
-- Los check de transactions y el trigger check_transaction_category siguen
-- aplicando: una categoría de otro espacio hace fallar todo.
create function public.import_transactions(
  p_workspace_id uuid,
  p_filename text,
  p_sheets text[],
  p_stats jsonb,
  p_new_categories jsonb,
  p_rows jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_import_id uuid;
  v_category record;
  v_category_id uuid;
  v_category_ids jsonb := '{}'::jsonb; -- key → id de las categorías nuevas
begin
  if not public.is_workspace_owner(p_workspace_id) then
    raise exception 'El espacio no existe'
      using errcode = 'insufficient_privilege';
  end if;

  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'No hay movimientos para importar'
      using errcode = 'check_violation';
  end if;

  if jsonb_array_length(p_rows) > 2000 then
    raise exception 'Máximo 2.000 filas por importación'
      using errcode = 'check_violation';
  end if;

  if jsonb_typeof(p_stats) <> 'object'
    or jsonb_typeof(p_new_categories) <> 'array'
  then
    raise exception 'Datos de importación inválidos'
      using errcode = 'check_violation';
  end if;

  insert into public.imports (workspace_id, filename, sheets, stats)
  values (p_workspace_id, p_filename, coalesce(p_sheets, '{}'), p_stats)
  returning id into v_import_id;

  for v_category in
    select *
    from jsonb_to_recordset(p_new_categories)
      as c (key text, type public.transaction_type, name text)
  loop
    insert into public.categories (workspace_id, type, name, icon, color)
    values (
      p_workspace_id,
      v_category.type,
      v_category.name,
      case v_category.type when 'expense' then 'receipt' else 'coins' end,
      case v_category.type when 'expense' then 'slate' else 'lime' end
    )
    returning id into v_category_id;

    v_category_ids := v_category_ids || jsonb_build_object(v_category.key, v_category_id);
  end loop;

  insert into public.transactions (
    workspace_id, type, amount, category_id, occurred_on, description, note, import_id
  )
  select
    p_workspace_id,
    r.type,
    r.amount,
    coalesce(r.category_id, (v_category_ids ->> r.new_category_key)::uuid),
    r.occurred_on,
    r.description,
    r.note,
    v_import_id
  from jsonb_to_recordset(p_rows) as r (
    type public.transaction_type,
    amount numeric,
    occurred_on date,
    category_id uuid,
    new_category_key text,
    description text,
    note text
  );

  return v_import_id;
end;
$$;

-- Borra los movimientos del import, aunque se hayan editado, y lo marca como
-- deshecho. Las categorías creadas se quedan. Devuelve cuántos borró.
create function public.undo_import(p_import_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_import public.imports;
  v_deleted integer;
begin
  select * into v_import
  from public.imports
  where id = p_import_id
  for update;

  if not found or not public.is_workspace_owner(v_import.workspace_id) then
    raise exception 'La importación no existe'
      using errcode = 'no_data_found';
  end if;

  if v_import.status = 'undone' then
    raise exception 'La importación ya se deshizo'
      using errcode = 'check_violation';
  end if;

  delete from public.transactions
  where import_id = p_import_id;

  get diagnostics v_deleted = row_count;

  update public.imports
  set status = 'undone', undone_at = now()
  where id = p_import_id;

  return v_deleted;
end;
$$;

-- Movimientos del rango para detectar duplicados en el cliente. Respeta RLS
-- (security invoker).
create function public.transactions_for_duplicates(
  p_workspace_id uuid,
  p_from date,
  p_to date
)
returns table (
  occurred_on date,
  type public.transaction_type,
  amount numeric,
  description text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.is_workspace_owner(p_workspace_id) then
    raise exception 'El espacio no existe'
      using errcode = 'insufficient_privilege';
  end if;

  return query
    select t.occurred_on, t.type, t.amount, t.description
    from public.transactions t
    where t.workspace_id = p_workspace_id
      and t.occurred_on between p_from and p_to;
end;
$$;

revoke execute on function public.import_transactions(uuid, text, text[], jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.import_transactions(uuid, text, text[], jsonb, jsonb, jsonb) to authenticated;

revoke execute on function public.undo_import(uuid) from public, anon;
grant execute on function public.undo_import(uuid) to authenticated;

revoke execute on function public.transactions_for_duplicates(uuid, date, date) from public, anon;
grant execute on function public.transactions_for_duplicates(uuid, date, date) to authenticated;

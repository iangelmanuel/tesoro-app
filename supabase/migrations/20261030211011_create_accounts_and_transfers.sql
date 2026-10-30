-- Cuentas y métodos de pago, traspasos entre cuentas propias y ajustes de
-- saldo (SPEC 08c). El saldo no se guarda: es opening_balance + ingresos −
-- gastos ± traspasos + ajustes. Los traspasos y ajustes van en tablas propias
-- para que transactions siga teniendo solo ingresos y gastos, y reportes,
-- presupuestos y score no cambien.

create type public.account_kind as enum ('cash', 'bank', 'wallet', 'other');

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  kind public.account_kind not null,
  icon text not null,  -- clave de CATEGORY_ICONS
  color text not null, -- clave de CATEGORY_COLORS
  opening_balance numeric(14, 2) not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Destino de las FK compuestas
  unique (id, workspace_id)
);

-- Nombre único por espacio, sin distinguir mayúsculas
create unique index accounts_unique_name
  on public.accounts (workspace_id, lower(name));

-- La cuenta siempre es del mismo espacio que el movimiento. El restrict no se
-- dispara en la práctica: accounts no tiene política delete y el borrado del
-- espacio llega en cascada desde workspaces.
alter table public.transactions
  add column account_id uuid,
  add foreign key (account_id, workspace_id)
    references public.accounts (id, workspace_id) on delete restrict;

create index transactions_account on public.transactions (account_id)
  where account_id is not null;

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  from_account_id uuid not null,
  to_account_id uuid not null,
  amount numeric(14, 2) not null check (amount > 0),
  occurred_on date not null,
  note text check (char_length(note) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_account_id <> to_account_id),
  foreign key (from_account_id, workspace_id)
    references public.accounts (id, workspace_id) on delete restrict,
  foreign key (to_account_id, workspace_id)
    references public.accounts (id, workspace_id) on delete restrict
);

create index transfers_workspace_date
  on public.transfers (workspace_id, occurred_on desc, created_at desc);

create table public.account_adjustments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  account_id uuid not null,
  amount numeric(14, 2) not null check (amount <> 0), -- > 0 sube el saldo
  occurred_on date not null,
  note text check (char_length(note) <= 120),
  created_at timestamptz not null default now(),
  foreign key (account_id, workspace_id)
    references public.accounts (id, workspace_id) on delete cascade
);

create index account_adjustments_account
  on public.account_adjustments (account_id, occurred_on desc);

-- Triggers
create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

create trigger transfers_set_updated_at
  before update on public.transfers
  for each row execute function public.set_updated_at();

-- Una fila nueva no puede usar una cuenta archivada. Editar una fila vieja de
-- una cuenta archivada sin cambiar la cuenta sí se permite.
create function public.check_account_active()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
  v_column text;
  v_account_id uuid;
begin
  foreach v_column in array
    case tg_table_name
      when 'transfers' then array['from_account_id', 'to_account_id']
      else array['account_id']
    end
  loop
    v_account_id := (v_new ->> v_column)::uuid;

    if v_account_id is not null
      and v_account_id is distinct from (v_old ->> v_column)::uuid
      and exists (
        select 1 from public.accounts
        where id = v_account_id and archived_at is not null
      )
    then
      raise exception 'La cuenta está archivada'
        using errcode = 'check_violation';
    end if;
  end loop;

  return new;
end;
$$;

create trigger transactions_check_account_active
  before insert or update on public.transactions
  for each row execute function public.check_account_active();

create trigger transfers_check_account_active
  before insert or update on public.transfers
  for each row execute function public.check_account_active();

create trigger account_adjustments_check_account_active
  before insert or update on public.account_adjustments
  for each row execute function public.check_account_active();

-- Cuenta "Efectivo" en cada espacio nuevo
create function public.seed_workspace_accounts()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.accounts (workspace_id, name, kind, icon, color, opening_balance)
  values (new.id, 'Efectivo', 'cash', 'banknote', 'emerald', 0);

  return null;
end;
$$;

create trigger workspaces_seed_accounts
  after insert on public.workspaces
  for each row execute function public.seed_workspace_accounts();

-- Las funciones de trigger no se exponen como RPC
revoke execute on function public.check_account_active() from public, anon, authenticated;
revoke execute on function public.seed_workspace_accounts() from public, anon, authenticated;

-- Backfill: "Efectivo" en cada espacio existente
insert into public.accounts (workspace_id, name, kind, icon, color, opening_balance)
select w.id, 'Efectivo', 'cash', 'banknote', 'emerald', 0
from public.workspaces w
where not exists (
  select 1 from public.accounts a
  where a.workspace_id = w.id and lower(a.name) = 'efectivo'
);

-- RLS
alter table public.accounts enable row level security;
alter table public.transfers enable row level security;
alter table public.account_adjustments enable row level security;

create policy "accounts_select_own"
  on public.accounts for select
  to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy "accounts_insert_own"
  on public.accounts for insert
  to authenticated
  with check (public.is_workspace_owner(workspace_id));

create policy "accounts_update_own"
  on public.accounts for update
  to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

-- Sin política delete: las cuentas solo se archivan

create policy "transfers_select_own"
  on public.transfers for select
  to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy "transfers_insert_own"
  on public.transfers for insert
  to authenticated
  with check (public.is_workspace_owner(workspace_id));

create policy "transfers_update_own"
  on public.transfers for update
  to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy "transfers_delete_own"
  on public.transfers for delete
  to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy "account_adjustments_select_own"
  on public.account_adjustments for select
  to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy "account_adjustments_insert_own"
  on public.account_adjustments for insert
  to authenticated
  with check (public.is_workspace_owner(workspace_id));

create policy "account_adjustments_update_own"
  on public.account_adjustments for update
  to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy "account_adjustments_delete_own"
  on public.account_adjustments for delete
  to authenticated
  using (public.is_workspace_owner(workspace_id));

-- Movimientos, traspasos y ajustes en una sola lista para paginar con el
-- orden real. Respeta RLS de cada tabla (security_invoker).
create view public.ledger_entries
with (security_invoker = true)
as
  select t.id, t.workspace_id, t.type::text as kind, t.amount, t.occurred_on,
         t.created_at, t.account_id, null::uuid as to_account_id,
         t.category_id, t.description, t.note
  from public.transactions t
  union all
  select tr.id, tr.workspace_id, 'transfer', tr.amount, tr.occurred_on,
         tr.created_at, tr.from_account_id, tr.to_account_id,
         null::uuid, null::text, tr.note
  from public.transfers tr
  union all
  select a.id, a.workspace_id, 'adjustment', a.amount, a.occurred_on,
         a.created_at, a.account_id, null::uuid,
         null::uuid, null::text, a.note
  from public.account_adjustments a;

revoke all on public.ledger_entries from public, anon, authenticated;
grant select on public.ledger_entries to authenticated;

-- Saldo de cada cuenta del espacio, activa o archivada. balance cuenta solo
-- las filas hasta hoy (America/Bogota); scheduled_balance, todas. Respeta RLS
-- (security invoker).
create function public.account_balances(p_workspace_id uuid)
returns table (
  id uuid,
  workspace_id uuid,
  name text,
  kind public.account_kind,
  icon text,
  color text,
  opening_balance numeric,
  archived_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  balance numeric,
  scheduled_balance numeric,
  last_activity_on date
)
language sql
stable
security invoker
set search_path = ''
as $$
  with today as (
    select (now() at time zone 'America/Bogota')::date as value
  ),
  deltas as (
    select t.account_id,
           case t.type when 'income' then t.amount else -t.amount end as delta,
           t.occurred_on
    from public.transactions t
    where t.workspace_id = p_workspace_id
      and t.account_id is not null
    union all
    select tr.from_account_id, -tr.amount, tr.occurred_on
    from public.transfers tr
    where tr.workspace_id = p_workspace_id
    union all
    select tr.to_account_id, tr.amount, tr.occurred_on
    from public.transfers tr
    where tr.workspace_id = p_workspace_id
    union all
    select a.account_id, a.amount, a.occurred_on
    from public.account_adjustments a
    where a.workspace_id = p_workspace_id
  ),
  totals as (
    select d.account_id,
           coalesce(sum(d.delta) filter (where d.occurred_on <= t.value), 0) as to_date,
           sum(d.delta) as scheduled,
           max(d.occurred_on) filter (where d.occurred_on <= t.value) as last_activity_on
    from deltas d, today t
    group by d.account_id
  )
  select a.id, a.workspace_id, a.name, a.kind, a.icon, a.color,
         a.opening_balance, a.archived_at, a.created_at, a.updated_at,
         a.opening_balance + coalesce(t.to_date, 0),
         a.opening_balance + coalesce(t.scheduled, 0),
         t.last_activity_on
  from public.accounts a
  left join totals t on t.account_id = a.id
  where a.workspace_id = p_workspace_id
  order by a.created_at;
$$;

revoke execute on function public.account_balances(uuid) from public, anon;
grant execute on function public.account_balances(uuid) to authenticated;

-- transaction_totals (SPEC 02) con filtro opcional de cuenta. Sigue sumando
-- solo transactions: traspasos y ajustes no son ingreso ni gasto.
-- p_without_account = true filtra los movimientos sin cuenta.
drop function public.transaction_totals(uuid, date, date, public.transaction_type, uuid, text);

create function public.transaction_totals(
  p_workspace_id uuid,
  p_from date default null,
  p_to date default null,
  p_type public.transaction_type default null,
  p_category_id uuid default null,
  p_search text default null,
  p_account_id uuid default null,
  p_without_account boolean default false
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
    and (p_account_id is null or t.account_id = p_account_id)
    and (not p_without_account or t.account_id is null)
    and (
      p_search is null
      or t.description ilike p.value
      or t.note ilike p.value
    );
$$;

revoke execute on function public.transaction_totals(uuid, date, date, public.transaction_type, uuid, text, uuid, boolean) from public, anon;
grant execute on function public.transaction_totals(uuid, date, date, public.transaction_type, uuid, text, uuid, boolean) to authenticated;

-- record_debt_payment (SPEC 06) con la cuenta del movimiento creado. La
-- cuenta se ignora si no se crea movimiento.
drop function public.record_debt_payment(uuid, numeric, date, text, boolean);

create function public.record_debt_payment(
  p_debt_id uuid,
  p_amount numeric,
  p_occurred_on date,
  p_note text,
  p_create_transaction boolean,
  p_account_id uuid default null
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_debt public.debts;
  v_type public.transaction_type;
  v_category_id uuid;
  v_transaction_id uuid;
  v_entry_id uuid;
begin
  select * into v_debt
  from public.debts
  where id = p_debt_id;

  if not found then
    raise exception 'La deuda no existe'
      using errcode = 'no_data_found';
  end if;

  if p_create_transaction then
    if v_debt.kind = 'credit_card' then
      raise exception 'Un pago de tarjeta no crea un movimiento'
        using errcode = 'check_violation';
    end if;

    v_type := case v_debt.kind when 'loan' then 'expense' else 'income' end;

    select id into v_category_id
    from public.categories
    where workspace_id is null
      and type = v_type
      and name = case v_type when 'expense' then 'Deudas' else 'Cobros' end;

    insert into public.transactions (
      workspace_id, type, amount, category_id, occurred_on, description, account_id
    ) values (
      v_debt.workspace_id,
      v_type,
      p_amount,
      v_category_id,
      p_occurred_on,
      case v_type when 'expense' then 'Pago ' else 'Abono ' end || v_debt.name,
      p_account_id
    )
    returning id into v_transaction_id;
  end if;

  insert into public.debt_entries (
    workspace_id, debt_id, kind, amount, occurred_on, note, transaction_id
  ) values (
    v_debt.workspace_id,
    v_debt.id,
    'payment',
    p_amount,
    p_occurred_on,
    p_note,
    v_transaction_id
  )
  returning id into v_entry_id;

  return v_entry_id;
end;
$$;

revoke execute on function public.record_debt_payment(uuid, numeric, date, text, boolean, uuid) from public, anon;
grant execute on function public.record_debt_payment(uuid, numeric, date, text, boolean, uuid) to authenticated;

-- import_transactions (SPEC 08) con cuentas. p_new_accounts: [{ key, name }],
-- creadas como "Otra". Cada fila acepta account_id | new_account_key, ambos
-- opcionales. La FK compuesta impide usar una cuenta de otro espacio.
drop function public.import_transactions(uuid, text, text[], jsonb, jsonb, jsonb);

create function public.import_transactions(
  p_workspace_id uuid,
  p_filename text,
  p_sheets text[],
  p_stats jsonb,
  p_new_categories jsonb,
  p_rows jsonb,
  p_new_accounts jsonb default '[]'
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
  v_account record;
  v_account_id uuid;
  v_account_ids jsonb := '{}'::jsonb; -- key → id de las cuentas nuevas
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
    or jsonb_typeof(p_new_accounts) <> 'array'
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

  for v_account in
    select *
    from jsonb_to_recordset(p_new_accounts) as a (key text, name text)
  loop
    insert into public.accounts (workspace_id, name, kind, icon, color)
    values (p_workspace_id, v_account.name, 'other', 'wallet', 'slate')
    returning id into v_account_id;

    v_account_ids := v_account_ids || jsonb_build_object(v_account.key, v_account_id);
  end loop;

  insert into public.transactions (
    workspace_id, type, amount, category_id, occurred_on, description, note,
    account_id, import_id
  )
  select
    p_workspace_id,
    r.type,
    r.amount,
    coalesce(r.category_id, (v_category_ids ->> r.new_category_key)::uuid),
    r.occurred_on,
    r.description,
    r.note,
    coalesce(r.account_id, (v_account_ids ->> r.new_account_key)::uuid),
    v_import_id
  from jsonb_to_recordset(p_rows) as r (
    type public.transaction_type,
    amount numeric,
    occurred_on date,
    category_id uuid,
    new_category_key text,
    description text,
    note text,
    account_id uuid,
    new_account_key text
  );

  return v_import_id;
end;
$$;

revoke execute on function public.import_transactions(uuid, text, text[], jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.import_transactions(uuid, text, text[], jsonb, jsonb, jsonb, jsonb) to authenticated;

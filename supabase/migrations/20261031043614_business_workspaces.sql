-- Espacio Empresa (SPEC 10): datos de la empresa, límite por usuario,
-- categorías por tipo de espacio, contraparte y factura en movimientos, y
-- borrado de la empresa con 30 días de gracia. La marca del borrado vive en
-- workspaces.deletion_requested_at y solo la cambian las RPC; mientras está
-- puesta, is_workspace_writable bloquea las escrituras del espacio.

-- Marca de borrado (solo Empresa; Personal nunca la tiene)
alter table public.workspaces
  add column deletion_requested_at timestamptz,
  add constraint workspaces_personal_not_deleted
    check (type = 'business' or deletion_requested_at is null);

-- Datos de la empresa, 1:1 con su espacio
create table public.business_profiles (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  tax_id text check (tax_id ~ '^\d{5,10}(-\d)?$'), -- NIT, DV opcional
  sector text not null,                          -- clave de SITE.businessSectors
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Categorías: a qué tipo de espacio pertenecen. Todo lo existente queda
-- personal; las propias toman el tipo de su espacio por trigger
alter table public.categories
  add column scope public.workspace_type not null default 'personal';

-- Traspasos: solo tenían FK compuestas a accounts (no action), así que borrar
-- un espacio con traspasos fallaba al final de la cascada. Con esta FK se
-- borran junto con el espacio (purga de empresas y de cuentas)
alter table public.transfers
  add constraint transfers_workspace_id_fkey
    foreign key (workspace_id)
    references public.workspaces (id) on delete cascade;

-- Movimientos: contraparte y factura (solo se usan en Empresa)
alter table public.transactions
  add column counterparty text check (char_length(counterparty) between 1 and 80),
  add column invoice_ref text check (char_length(invoice_ref) between 1 and 40);

-- Funciones

-- Máximo de empresas por usuario. Es el único punto a cambiar cuando exista
-- un plan premium (SITE.businessLimit lo refleja en la UI)
create function public.business_workspace_limit()
returns integer
language sql
immutable
security invoker
set search_path = ''
as $$
  select 1;
$$;

-- Como is_workspace_owner, pero falso si el espacio está programado para
-- borrarse. Lo usan las políticas de escritura de las tablas del espacio
create function public.is_workspace_writable(p_workspace_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.workspaces
    where id = p_workspace_id
      and owner_id = (select auth.uid())
      and deletion_requested_at is null
  );
$$;

-- Crea el espacio Empresa y su perfil en una sola transacción. Respeta RLS y
-- el trigger de límite (security invoker)
create function public.create_business(
  p_name text,
  p_tax_id text,
  p_sector text
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_workspace_id uuid;
begin
  insert into public.workspaces (owner_id, type, name)
  values ((select auth.uid()), 'business', p_name)
  returning id into v_workspace_id;

  insert into public.business_profiles (workspace_id, tax_id, sector)
  values (v_workspace_id, p_tax_id, p_sector);

  return v_workspace_id;
end;
$$;

-- Programa el borrado de una empresa propia. Idempotente: si ya hay marca,
-- devuelve la existente
create function public.request_workspace_deletion(p_workspace_id uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_requested_at timestamptz;
begin
  select w.deletion_requested_at
  into v_requested_at
  from public.workspaces w
  where w.id = p_workspace_id
    and w.owner_id = (select auth.uid())
    and w.type = 'business'
  for update;

  if not found then
    raise exception 'La empresa no existe'
      using errcode = 'no_data_found';
  end if;

  if v_requested_at is not null then
    return v_requested_at;
  end if;

  v_requested_at := now();

  update public.workspaces
  set deletion_requested_at = v_requested_at
  where id = p_workspace_id;

  return v_requested_at;
end;
$$;

-- Restaura la empresa durante el periodo de gracia
create function public.cancel_workspace_deletion(p_workspace_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.workspaces
  set deletion_requested_at = null
  where id = p_workspace_id
    and owner_id = (select auth.uid())
    and type = 'business';
$$;

revoke execute on function public.business_workspace_limit() from public, anon;
grant execute on function public.business_workspace_limit() to authenticated;

revoke execute on function public.is_workspace_writable(uuid) from public, anon;
grant execute on function public.is_workspace_writable(uuid) to authenticated;

revoke execute on function public.create_business(text, text, text) from public, anon;
grant execute on function public.create_business(text, text, text) to authenticated;

revoke execute on function public.request_workspace_deletion(uuid) from public, anon;
grant execute on function public.request_workspace_deletion(uuid) to authenticated;

revoke execute on function public.cancel_workspace_deletion(uuid) from public, anon;
grant execute on function public.cancel_workspace_deletion(uuid) to authenticated;

-- Triggers

-- Límite de empresas por usuario, contando las programadas para borrarse.
-- El lock evita que dos inserts simultáneos pasen el conteo a la vez
create function public.check_business_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('business_limit:' || new.owner_id::text));

  if (
    select count(*) from public.workspaces
    where owner_id = new.owner_id and type = 'business'
  ) >= public.business_workspace_limit() then
    raise exception 'Alcanzaste el límite de empresas'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger workspaces_check_business_limit
  before insert on public.workspaces
  for each row
  when (new.type = 'business')
  execute function public.check_business_limit();

-- El perfil de empresa solo cuelga de un espacio Empresa. También en update,
-- para que no se pueda mover el perfil a otro espacio
create function public.check_business_profile_workspace()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.workspaces
    where id = new.workspace_id and type = 'business'
  ) then
    raise exception 'El espacio no es una empresa'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger business_profiles_check_workspace
  before insert or update of workspace_id on public.business_profiles
  for each row execute function public.check_business_profile_workspace();

create trigger business_profiles_set_updated_at
  before update on public.business_profiles
  for each row execute function public.set_updated_at();

-- Las categorías propias toman el tipo de su espacio. Las del sistema
-- (workspace_id null) conservan el scope de la semilla
create function public.set_category_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.workspace_id is not null then
    select type into new.scope
    from public.workspaces
    where id = new.workspace_id;
  end if;

  return new;
end;
$$;

create trigger categories_set_scope
  before insert or update on public.categories
  for each row execute function public.set_category_scope();

-- Las funciones de trigger no se exponen como RPC
revoke execute on function public.check_business_limit() from public, anon, authenticated;
revoke execute on function public.check_business_profile_workspace() from public, anon, authenticated;
revoke execute on function public.set_category_scope() from public, anon, authenticated;

-- Cambios a funciones existentes

-- La categoría también debe ser del tipo de espacio del movimiento
create or replace function public.check_transaction_category()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.categories c
    join public.workspaces w on w.id = new.workspace_id
    where c.id = new.category_id
      and c.type = new.type
      and c.scope = w.type
      and (c.workspace_id is null or c.workspace_id = new.workspace_id)
  ) then
    raise exception 'La categoría no corresponde al tipo o al espacio del movimiento'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create or replace function public.check_expense_category()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.categories c
    join public.workspaces w on w.id = new.workspace_id
    where c.id = new.category_id
      and c.type = 'expense'
      and c.scope = w.type
      and (c.workspace_id is null or c.workspace_id = new.workspace_id)
  ) then
    raise exception 'La categoría debe ser de gasto y del mismo espacio'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- record_debt_payment (SPEC 08c) busca "Deudas"/"Cobros" solo entre las
-- categorías personales del sistema
create or replace function public.record_debt_payment(
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
      and scope = 'personal'
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

-- import_debt_entries (SPEC 08b), mismo filtro de scope
create or replace function public.import_debt_entries(
  p_workspace_id uuid,
  p_filename text,
  p_sheets text[],
  p_stats jsonb,
  p_create_transactions boolean,
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
  v_row record;
  v_type public.transaction_type;
  v_category_id uuid;
  v_transaction_id uuid;
begin
  v_import_id := public.create_import(
    p_workspace_id, 'debt_entries', p_filename, p_sheets, p_stats, p_rows
  );

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as r (debt_id uuid)
    where not exists (
      select 1 from public.debts d
      where d.id = r.debt_id and d.workspace_id = p_workspace_id
    )
  ) then
    raise exception 'La deuda no existe'
      using errcode = 'no_data_found';
  end if;

  for v_row in
    select r.*, d.kind as debt_kind, d.name as debt_name
    from jsonb_to_recordset(p_rows) as r (
      debt_id uuid,
      kind public.debt_entry_kind,
      amount numeric,
      occurred_on date,
      note text
    )
    join public.debts d on d.id = r.debt_id
    order by (r.kind = 'adjustment' and r.amount > 0) desc, r.occurred_on
  loop
    v_transaction_id := null;

    if p_create_transactions
      and v_row.kind = 'payment'
      and v_row.debt_kind <> 'credit_card'
    then
      v_type := case v_row.debt_kind when 'loan' then 'expense' else 'income' end;

      select id into v_category_id
      from public.categories
      where workspace_id is null
        and scope = 'personal'
        and type = v_type
        and name = case v_type when 'expense' then 'Deudas' else 'Cobros' end;

      insert into public.transactions (
        workspace_id, type, amount, category_id, occurred_on, description
      ) values (
        p_workspace_id,
        v_type,
        v_row.amount,
        v_category_id,
        v_row.occurred_on,
        case v_type when 'expense' then 'Pago ' else 'Abono ' end || v_row.debt_name
      )
      returning id into v_transaction_id;
    end if;

    insert into public.debt_entries (
      workspace_id, debt_id, kind, amount, occurred_on, note, transaction_id, import_id
    ) values (
      p_workspace_id,
      v_row.debt_id,
      v_row.kind,
      v_row.amount,
      v_row.occurred_on,
      v_row.note,
      v_transaction_id,
      v_import_id
    );
  end loop;

  return v_import_id;
end;
$$;

-- transaction_totals (SPEC 08c): la búsqueda también cubre contraparte y
-- factura
create or replace function public.transaction_totals(
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
      or t.counterparty ilike p.value
      or t.invoice_ref ilike p.value
    );
$$;

-- ledger_entries (SPEC 08c) con contraparte y factura, para mostrarlas y
-- buscarlas en la tabla de Movimientos. Las columnas nuevas van al final
create or replace view public.ledger_entries
with (security_invoker = true)
as
  select t.id, t.workspace_id, t.type::text as kind, t.amount, t.occurred_on,
         t.created_at, t.account_id, null::uuid as to_account_id,
         t.category_id, t.description, t.note,
         t.counterparty, t.invoice_ref
  from public.transactions t
  union all
  select tr.id, tr.workspace_id, 'transfer', tr.amount, tr.occurred_on,
         tr.created_at, tr.from_account_id, tr.to_account_id,
         null::uuid, null::text, tr.note,
         null::text, null::text
  from public.transfers tr
  union all
  select a.id, a.workspace_id, 'adjustment', a.amount, a.occurred_on,
         a.created_at, a.account_id, null::uuid,
         null::uuid, null::text, a.note,
         null::text, null::text
  from public.account_adjustments a;

-- RLS

alter table public.business_profiles enable row level security;

create policy "workspaces_insert_own_business"
  on public.workspaces for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and type = 'business'
    and deletion_requested_at is null
  );

create policy "workspaces_update_own_business"
  on public.workspaces for update
  to authenticated
  using (owner_id = (select auth.uid()) and type = 'business')
  with check (owner_id = (select auth.uid()) and type = 'business');

-- Sin política de delete: la purga la hace pg_cron

-- El usuario solo cambia el nombre. La marca de borrado cambia por las RPC
revoke update on public.workspaces from authenticated;
grant update (name) on public.workspaces to authenticated;

create policy "business_profiles_select_own"
  on public.business_profiles for select
  to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy "business_profiles_insert_own"
  on public.business_profiles for insert
  to authenticated
  with check (public.is_workspace_writable(workspace_id));

create policy "business_profiles_update_own"
  on public.business_profiles for update
  to authenticated
  using (public.is_workspace_writable(workspace_id))
  with check (public.is_workspace_writable(workspace_id));

-- Sin política de delete: el perfil se borra en cascada con el espacio

-- Escrituras de las tablas del espacio: dueño y sin marca de borrado. Las
-- políticas select no cambian

-- Movimientos
drop policy "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own"
  on public.transactions for insert
  to authenticated
  with check (public.is_workspace_writable(workspace_id));

drop policy "transactions_update_own" on public.transactions;
create policy "transactions_update_own"
  on public.transactions for update
  to authenticated
  using (public.is_workspace_writable(workspace_id))
  with check (public.is_workspace_writable(workspace_id));

drop policy "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own"
  on public.transactions for delete
  to authenticated
  using (public.is_workspace_writable(workspace_id));

-- Categorías (sin política de delete: solo se archivan)
drop policy "categories_insert_own" on public.categories;
create policy "categories_insert_own"
  on public.categories for insert
  to authenticated
  with check (workspace_id is not null and public.is_workspace_writable(workspace_id));

drop policy "categories_update_own" on public.categories;
create policy "categories_update_own"
  on public.categories for update
  to authenticated
  using (workspace_id is not null and public.is_workspace_writable(workspace_id))
  with check (workspace_id is not null and public.is_workspace_writable(workspace_id));

-- Cuentas (sin política de delete: solo se archivan)
drop policy "accounts_insert_own" on public.accounts;
create policy "accounts_insert_own"
  on public.accounts for insert
  to authenticated
  with check (public.is_workspace_writable(workspace_id));

drop policy "accounts_update_own" on public.accounts;
create policy "accounts_update_own"
  on public.accounts for update
  to authenticated
  using (public.is_workspace_writable(workspace_id))
  with check (public.is_workspace_writable(workspace_id));

-- Traspasos
drop policy "transfers_insert_own" on public.transfers;
create policy "transfers_insert_own"
  on public.transfers for insert
  to authenticated
  with check (public.is_workspace_writable(workspace_id));

drop policy "transfers_update_own" on public.transfers;
create policy "transfers_update_own"
  on public.transfers for update
  to authenticated
  using (public.is_workspace_writable(workspace_id))
  with check (public.is_workspace_writable(workspace_id));

drop policy "transfers_delete_own" on public.transfers;
create policy "transfers_delete_own"
  on public.transfers for delete
  to authenticated
  using (public.is_workspace_writable(workspace_id));

-- Ajustes de saldo
drop policy "account_adjustments_insert_own" on public.account_adjustments;
create policy "account_adjustments_insert_own"
  on public.account_adjustments for insert
  to authenticated
  with check (public.is_workspace_writable(workspace_id));

drop policy "account_adjustments_update_own" on public.account_adjustments;
create policy "account_adjustments_update_own"
  on public.account_adjustments for update
  to authenticated
  using (public.is_workspace_writable(workspace_id))
  with check (public.is_workspace_writable(workspace_id));

drop policy "account_adjustments_delete_own" on public.account_adjustments;
create policy "account_adjustments_delete_own"
  on public.account_adjustments for delete
  to authenticated
  using (public.is_workspace_writable(workspace_id));

-- Semilla de categorías del sistema de negocio
insert into public.categories (workspace_id, scope, type, name, icon, color) values
  (null, 'business', 'income', 'Ventas de productos', 'package', 'emerald'),
  (null, 'business', 'income', 'Ventas de servicios', 'briefcase', 'teal'),
  (null, 'business', 'income', 'Otros ingresos', 'coins', 'lime'),
  (null, 'business', 'expense', 'Costo de ventas', 'store', 'amber'),
  (null, 'business', 'expense', 'Sueldos y honorarios', 'users', 'indigo'),
  (null, 'business', 'expense', 'Arriendo', 'home', 'orange'),
  (null, 'business', 'expense', 'Servicios públicos', 'zap', 'blue'),
  (null, 'business', 'expense', 'Marketing y publicidad', 'megaphone', 'pink'),
  (null, 'business', 'expense', 'Transporte y logística', 'car', 'sky'),
  (null, 'business', 'expense', 'Software y herramientas', 'laptop', 'violet'),
  (null, 'business', 'expense', 'Impuestos y tasas', 'landmark', 'rose'),
  (null, 'business', 'expense', 'Comisiones bancarias', 'receipt', 'slate'),
  (null, 'business', 'expense', 'Otros gastos operativos', 'tag', 'slate');

-- Purga las empresas marcadas hace más de 30 días. El borrado baja en cascada
-- a business_profiles y todas las tablas del espacio. La llama pg_cron
create function public.purge_deleted_workspaces()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.workspaces
  where type = 'business'
    and deletion_requested_at < now() - interval '30 days';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- Solo pg_cron la ejecuta; no se expone como RPC
revoke execute on function public.purge_deleted_workspaces() from public, anon, authenticated;

-- 08:15 UTC, después de purge-deleted-accounts
select cron.schedule(
  'purge-deleted-workspaces',
  '15 8 * * *',
  $$select public.purge_deleted_workspaces()$$
);

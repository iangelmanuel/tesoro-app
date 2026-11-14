-- Ingresos fijos semanales, diarios y cada N días, y cobros que cubren
-- varias ocurrencias o abonan una parte (SPEC 38).
--
-- Un ingreso ya no se enlaza a una sola ocurrencia con
-- transactions.recurring_income_due_on: su monto se reparte en
-- recurring_income_allocations, desde la ocurrencia no recibida más antigua
-- de su fuente. transactions.recurring_income_id se queda y enlaza el
-- movimiento con su fuente (también en las "Sin fecha fija", que no tienen
-- ocurrencias ni reparto).
--
-- El reparto lo hace allocate_income_receipt y lo dispara un trigger de
-- transactions al crear un ingreso enlazado o al cambiar su monto, tipo o
-- fuente: el movimiento y su reparto se guardan en la misma transacción
-- venga de la app, del MCP o del importador. Es la misma regla que
-- allocateOldestFirst (src/libs/allocate.ts), que solo previsualiza.

-- 1. Columnas y checks por frecuencia --------------------------------------

alter table public.recurring_incomes
  add column day_of_week smallint check (day_of_week between 1 and 7), -- ISO: 1 lunes … 7 domingo
  add column interval_days smallint check (interval_days between 2 and 90);

-- Los check por frecuencia de SPEC 30 no tienen nombre propio: se buscan por
-- su definición y se reemplazan.
do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.recurring_incomes'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%frequency%'
  loop
    execute format(
      'alter table public.recurring_incomes drop constraint %I',
      v_constraint.conname
    );
  end loop;
end;
$$;

--   monthly      → day_of_month
--   biweekly     → day_of_month y second_day_of_month
--   yearly       → day_of_month y month_of_year
--   weekly       → day_of_week
--   every_n_days → interval_days
--   daily / none → ningún día
alter table public.recurring_incomes
  add constraint recurring_incomes_day_of_month_frequency_check
    check (
      (frequency in ('monthly', 'biweekly', 'yearly'))
      = (day_of_month is not null)
    ),
  add constraint recurring_incomes_second_day_frequency_check
    check ((frequency = 'biweekly') = (second_day_of_month is not null)),
  add constraint recurring_incomes_month_frequency_check
    check ((frequency = 'yearly') = (month_of_year is not null)),
  add constraint recurring_incomes_day_of_week_frequency_check
    check ((frequency = 'weekly') = (day_of_week is not null)),
  add constraint recurring_incomes_interval_frequency_check
    check ((frequency = 'every_n_days') = (interval_days is not null));

-- 2. Calendario -------------------------------------------------------------

-- Fechas de un calendario de ingreso fijo en [p_from, p_to], acotadas a
-- [p_starts_on, p_ends_on]. Mensual, quincenal y anual: un día que no existe
-- en el mes cae en el último día del mes (SPEC 30). Semanal: el día ISO de
-- la semana. Diaria: todos los días. Cada N días: contados desde p_starts_on.
-- "none" no tiene fechas.
create function public.recurring_income_dates(
  p_frequency public.income_frequency,
  p_day_of_month smallint,
  p_second_day_of_month smallint,
  p_month_of_year smallint,
  p_day_of_week smallint,
  p_interval_days smallint,
  p_starts_on date,
  p_ends_on date,
  p_from date,
  p_to date
)
returns setof date
language sql
immutable
security invoker
set search_path = ''
as $$
  with r as (
    select greatest(p_from, p_starts_on) as range_from,
           least(p_to, coalesce(p_ends_on, p_to)) as range_to
  ),
  by_month as (
    select (
             m.month::date
             + least(
                 d.day::int,
                 extract(day from m.month + interval '1 month' - interval '1 day')::int
               )
             - 1
           ) as due_on
    from r
    cross join lateral generate_series(
      date_trunc('month', r.range_from::timestamp),
      date_trunc('month', r.range_to::timestamp),
      interval '1 month'
    ) as m (month)
    cross join lateral unnest(
      array[p_day_of_month, p_second_day_of_month]
    ) as d (day)
    where p_frequency in ('monthly', 'biweekly', 'yearly')
      and r.range_from <= r.range_to
      and d.day is not null
      and (p_frequency <> 'yearly' or extract(month from m.month) = p_month_of_year)
  ),
  by_step as (
    select g.day::date as due_on
    from r
    cross join lateral generate_series(
      (
        case p_frequency
          when 'weekly' then
            r.range_from
            + ((p_day_of_week - extract(isodow from r.range_from)::int + 7) % 7)
          when 'daily' then r.range_from
          else
            p_starts_on
            + ((r.range_from - p_starts_on + p_interval_days - 1) / p_interval_days)
              * p_interval_days
        end
      )::timestamp,
      r.range_to::timestamp,
      (
        case p_frequency
          when 'weekly' then 7
          when 'daily' then 1
          else p_interval_days
        end
      ) * interval '1 day'
    ) as g (day)
    where p_frequency in ('weekly', 'daily', 'every_n_days')
      and r.range_from <= r.range_to
  )
  select distinct o.due_on
  from (
    select due_on from by_month
    union all
    select due_on from by_step
  ) o, r
  where o.due_on between r.range_from and r.range_to
  order by 1;
$$;

revoke execute on function public.recurring_income_dates(public.income_frequency, smallint, smallint, smallint, smallint, smallint, date, date, date, date) from public, anon;
grant execute on function public.recurring_income_dates(public.income_frequency, smallint, smallint, smallint, smallint, smallint, date, date, date, date) to authenticated;

-- ¿p_date es una fecha de vencimiento de este calendario? Reemplaza la de
-- SPEC 30 con los campos nuevos.
drop function public.is_recurring_income_due_date(public.income_frequency, smallint, smallint, smallint, date, date, date);

create function public.is_recurring_income_due_date(
  p_frequency public.income_frequency,
  p_day_of_month smallint,
  p_second_day_of_month smallint,
  p_month_of_year smallint,
  p_day_of_week smallint,
  p_interval_days smallint,
  p_starts_on date,
  p_ends_on date,
  p_date date
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.recurring_income_dates(
      p_frequency, p_day_of_month, p_second_day_of_month, p_month_of_year,
      p_day_of_week, p_interval_days, p_starts_on, p_ends_on, p_date, p_date
    )
  );
$$;

revoke execute on function public.is_recurring_income_due_date(public.income_frequency, smallint, smallint, smallint, smallint, smallint, date, date, date) from public, anon;
grant execute on function public.is_recurring_income_due_date(public.income_frequency, smallint, smallint, smallint, smallint, smallint, date, date, date) to authenticated;

-- 3. Asignaciones -------------------------------------------------------------

create table public.recurring_income_allocations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  recurring_income_id uuid not null references public.recurring_incomes (id) on delete cascade,
  due_on date not null,
  amount numeric(14, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (transaction_id, due_on)
);

create index recurring_income_allocations_occurrence
  on public.recurring_income_allocations (recurring_income_id, due_on);

grant select, insert, update, delete on public.recurring_income_allocations
  to authenticated;

alter table public.recurring_income_allocations enable row level security;

create policy "recurring_income_allocations_select_own"
  on public.recurring_income_allocations for select
  to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy "recurring_income_allocations_insert_own"
  on public.recurring_income_allocations for insert
  to authenticated
  with check (public.is_workspace_writable(workspace_id));

create policy "recurring_income_allocations_update_own"
  on public.recurring_income_allocations for update
  to authenticated
  using (public.is_workspace_writable(workspace_id))
  with check (public.is_workspace_writable(workspace_id));

create policy "recurring_income_allocations_delete_own"
  on public.recurring_income_allocations for delete
  to authenticated
  using (public.is_workspace_writable(workspace_id));

-- 4. Migración de datos -----------------------------------------------------

-- Cada ingreso de SPEC 30 que recibió una ocurrencia pasa a una asignación
-- por su monto completo. Va antes del trigger de asignaciones: una
-- ocurrencia cuya fecha ya no calza con el calendario (la fuente cambió de
-- días) se conserva y se muestra Recibido en su fecha.
insert into public.recurring_income_allocations (
  workspace_id, transaction_id, recurring_income_id, due_on, amount
)
select t.workspace_id, t.id, t.recurring_income_id, t.recurring_income_due_on, t.amount
from public.transactions t
where t.recurring_income_id is not null
  and t.recurring_income_due_on is not null;

-- El trigger de SPEC 30 lee recurring_income_due_on: se reemplaza antes de
-- borrar la columna. Ahora solo valida el enlace con la fuente.
create or replace function public.check_transaction_recurring_income()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.recurring_income_id is null then
    return new;
  end if;

  if new.type <> 'income' or not exists (
    select 1 from public.recurring_incomes
    where id = new.recurring_income_id
      and workspace_id = new.workspace_id
  ) then
    raise exception 'El ingreso no corresponde a un ingreso fijo de este espacio'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop index public.transactions_recurring_income_occurrence;

alter table public.transactions drop column recurring_income_due_on;

-- 5. Validación de cada asignación -----------------------------------------

-- El movimiento es un ingreso del mismo espacio y de la misma fuente; la
-- fuente tiene calendario y due_on es una fecha real suya. La suma de las
-- asignaciones de un movimiento la cuadra allocate_income_receipt.
create function public.check_recurring_income_allocation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_income public.recurring_incomes;
begin
  if not exists (
    select 1 from public.transactions t
    where t.id = new.transaction_id
      and t.workspace_id = new.workspace_id
      and t.type = 'income'
      and t.recurring_income_id = new.recurring_income_id
  ) then
    raise exception 'La asignación no corresponde a un ingreso de esta fuente'
      using errcode = 'check_violation';
  end if;

  select * into v_income
  from public.recurring_incomes
  where id = new.recurring_income_id
    and workspace_id = new.workspace_id;

  if not found or v_income.frequency = 'none' then
    raise exception 'Un ingreso sin fecha fija no tiene ocurrencias'
      using errcode = 'check_violation';
  end if;

  if not public.is_recurring_income_due_date(
    v_income.frequency,
    v_income.day_of_month,
    v_income.second_day_of_month,
    v_income.month_of_year,
    v_income.day_of_week,
    v_income.interval_days,
    v_income.starts_on,
    v_income.ends_on,
    new.due_on
  ) then
    raise exception 'La fecha no es una ocurrencia de este ingreso fijo'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger recurring_income_allocations_check
  before insert or update on public.recurring_income_allocations
  for each row execute function public.check_recurring_income_allocation();

-- 6. Reparto ----------------------------------------------------------------

-- Borra las asignaciones del movimiento y reparte su monto desde la
-- ocurrencia no recibida más antigua de su fuente (lo que falta en cada una
-- descuenta lo que otros movimientos ya asignaron). Después de lo vencido
-- cubre ocurrencias futuras, hasta 12 por delante, y nunca más allá de
-- ends_on. Si sobra, lanza un error y la transacción se revierte. Un
-- movimiento que no es ingreso, sin fuente o de una fuente "none" queda sin
-- asignaciones. Devuelve lo asignado.
create function public.allocate_income_receipt(p_transaction_id uuid)
returns table (due_on date, amount numeric)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_transaction public.transactions;
  v_income public.recurring_incomes;
  v_today date := (now() at time zone 'America/Bogota')::date;
  v_to date;
  v_remaining numeric;
  v_part numeric;
  v_future int := 0;
  v_occurrence record;
begin
  select * into v_transaction
  from public.transactions t
  where t.id = p_transaction_id;

  if not found then
    raise exception 'El movimiento no existe'
      using errcode = 'no_data_found';
  end if;

  -- Bloquea la fuente: dos cobros a la vez no reparten sobre lo mismo
  if v_transaction.type = 'income' and v_transaction.recurring_income_id is not null then
    select * into v_income
    from public.recurring_incomes r
    where r.id = v_transaction.recurring_income_id
      and r.workspace_id = v_transaction.workspace_id
    for update;
  end if;

  delete from public.recurring_income_allocations a
  where a.transaction_id = p_transaction_id;

  if v_income.id is null or v_income.frequency = 'none' then
    return;
  end if;

  -- Ventana que alcanza para 12 ocurrencias futuras de cada frecuencia
  v_to := case v_income.frequency
    when 'yearly' then (v_today + interval '13 years')::date
    when 'monthly' then (v_today + interval '13 months')::date
    when 'biweekly' then (v_today + interval '13 months')::date
    when 'weekly' then v_today + 13 * 7
    when 'daily' then v_today + 13
    else v_today + 13 * v_income.interval_days
  end;

  v_remaining := v_transaction.amount;

  for v_occurrence in
    select d.due_on,
           v_income.amount - coalesce((
             select sum(a.amount)
             from public.recurring_income_allocations a
             where a.recurring_income_id = v_income.id
               and a.due_on = d.due_on
           ), 0) as due
    from public.recurring_income_dates(
      v_income.frequency,
      v_income.day_of_month,
      v_income.second_day_of_month,
      v_income.month_of_year,
      v_income.day_of_week,
      v_income.interval_days,
      v_income.starts_on,
      v_income.ends_on,
      v_income.starts_on,
      v_to
    ) as d (due_on)
    order by d.due_on
  loop
    exit when v_remaining <= 0;

    if v_occurrence.due_on > v_today then
      v_future := v_future + 1;
      exit when v_future > 12;
    end if;

    continue when v_occurrence.due <= 0;

    v_part := least(v_remaining, v_occurrence.due);

    insert into public.recurring_income_allocations (
      workspace_id, transaction_id, recurring_income_id, due_on, amount
    ) values (
      v_transaction.workspace_id, v_transaction.id, v_income.id,
      v_occurrence.due_on, v_part
    );

    v_remaining := v_remaining - v_part;
    due_on := v_occurrence.due_on;
    amount := v_part;
    return next;
  end loop;

  if v_remaining > 0 then
    if v_future > 12 then
      raise exception 'El monto cubre más de 12 ocurrencias futuras'
        using errcode = 'check_violation', hint = 'allocation_future_limit';
    end if;
    raise exception 'El monto supera lo que falta por recibir de este ingreso fijo'
      using errcode = 'check_violation', hint = 'allocation_exceeds_end';
  end if;
end;
$$;

revoke execute on function public.allocate_income_receipt(uuid) from public, anon;
grant execute on function public.allocate_income_receipt(uuid) to authenticated;

-- Reparte al crear un ingreso enlazado y al cambiar su monto, tipo o fuente.
-- Cambiar a "Otro ingreso" (fuente en null) o a gasto borra las
-- asignaciones; eliminar el movimiento las borra en cascada.
create function public.reallocate_transaction_income()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.allocate_income_receipt(new.id);
  return null;
end;
$$;

create trigger transactions_allocate_income_on_insert
  after insert on public.transactions
  for each row
  when (new.recurring_income_id is not null)
  execute function public.reallocate_transaction_income();

create trigger transactions_allocate_income_on_update
  after update of amount, type, recurring_income_id on public.transactions
  for each row
  when (
    old.amount is distinct from new.amount
    or old.type is distinct from new.type
    or old.recurring_income_id is distinct from new.recurring_income_id
  )
  execute function public.reallocate_transaction_income();

-- Las funciones de trigger no se exponen como RPC
revoke execute on function public.check_recurring_income_allocation() from public, anon, authenticated;
revoke execute on function public.reallocate_transaction_income() from public, anon, authenticated;

-- 7. Ocurrencias ------------------------------------------------------------

-- Reemplaza la de SPEC 30: soporta las frecuencias nuevas y devuelve
-- received_amount = Σ asignaciones de cada ocurrencia (0 si no tiene) en vez
-- de transaction_id. Incluye también las ocurrencias con asignaciones en el
-- rango cuya fecha ya no calza con el calendario actual.
drop function public.recurring_income_occurrences(uuid, date, date);

create function public.recurring_income_occurrences(
  p_workspace_id uuid,
  p_from date,
  p_to date
)
returns table (
  recurring_income_id uuid,
  name text,
  amount numeric,
  category_id uuid,
  account_id uuid,
  due_on date,
  received_amount numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with incomes as (
    select r.*
    from public.recurring_incomes r
    where r.workspace_id = p_workspace_id
      and r.is_active
      and r.frequency <> 'none'
  ),
  received as (
    select a.recurring_income_id, a.due_on, sum(a.amount) as received_amount
    from public.recurring_income_allocations a
    join incomes i on i.id = a.recurring_income_id
    where a.due_on between p_from and p_to
    group by a.recurring_income_id, a.due_on
  ),
  scheduled as (
    select i.id, i.name, i.amount, i.category_id, i.account_id, d.due_on
    from incomes i
    cross join lateral public.recurring_income_dates(
      i.frequency,
      i.day_of_month,
      i.second_day_of_month,
      i.month_of_year,
      i.day_of_week,
      i.interval_days,
      i.starts_on,
      i.ends_on,
      p_from,
      p_to
    ) as d (due_on)
  )
  select s.id, s.name, s.amount, s.category_id, s.account_id, s.due_on,
         coalesce(rc.received_amount, 0)
  from scheduled s
  left join received rc
    on rc.recurring_income_id = s.id
    and rc.due_on = s.due_on
  union all
  select i.id, i.name, i.amount, i.category_id, i.account_id, rc.due_on,
         rc.received_amount
  from received rc
  join incomes i on i.id = rc.recurring_income_id
  where not exists (
    select 1 from scheduled s
    where s.id = rc.recurring_income_id and s.due_on = rc.due_on
  )
  order by 6, 2;
$$;

revoke execute on function public.recurring_income_occurrences(uuid, date, date) from public, anon;
grant execute on function public.recurring_income_occurrences(uuid, date, date) to authenticated;

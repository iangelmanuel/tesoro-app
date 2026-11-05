-- Abonos parciales e historial de la cuota en cuentas por cobrar mensuales
-- (SPEC 29).
--
-- 1. Una cuota admite varios abonos: queda pagada cuando la suma de sus
--    abonos cubre el valor de la cuota; con menos, sigue debiendo la
--    diferencia. El estado se calcula en la app, como en SPEC 28.
-- 2. El valor de la cuota puede cambiar con el tiempo (por ejemplo, sube el
--    precio de una suscripción). receivable_installment_history guarda los
--    valores anteriores: cada fila dice "hasta este mes la cuota valía X".
--    El valor de un mes es el de la fila con el menor through_period >= mes;
--    sin fila, debts.installment (el valor actual).

drop index public.debt_entries_one_payment_per_period;

create index debt_entries_period
  on public.debt_entries (debt_id, period_on)
  where period_on is not null;

create table public.receivable_installment_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  debt_id uuid not null,
  through_period date not null, -- último mes (día 1) con este valor
  amount numeric(14, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (extract(day from through_period) = 1),
  unique (debt_id, through_period),
  -- La fila siempre es del mismo espacio que su cuenta por cobrar
  foreign key (debt_id, workspace_id)
    references public.debts (id, workspace_id) on delete cascade
);

comment on table public.receivable_installment_history is
  'Valores anteriores de la cuota de una cuenta por cobrar mensual: hasta through_period la cuota valía amount';

create trigger receivable_installment_history_set_updated_at
  before update on public.receivable_installment_history
  for each row execute function public.set_updated_at();

-- Solo cuentas por cobrar mensuales sin número de cuotas: con cuotas, el
-- saldo inicial es installment × term_months y un valor por mes lo rompería
create function public.check_receivable_installment_history()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.debts d
    where d.id = new.debt_id
      and d.kind = 'receivable'
      and d.schedule = 'monthly'
      and d.term_months is null
  ) then
    raise exception 'Solo un cobro mensual sin número de cuotas guarda valores anteriores'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger receivable_installment_history_check
  before insert or update on public.receivable_installment_history
  for each row execute function public.check_receivable_installment_history();

alter table public.receivable_installment_history enable row level security;

create policy "receivable_installment_history_select_own"
  on public.receivable_installment_history for select
  to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy "receivable_installment_history_insert_own"
  on public.receivable_installment_history for insert
  to authenticated
  with check (public.is_workspace_writable(workspace_id));

create policy "receivable_installment_history_update_own"
  on public.receivable_installment_history for update
  to authenticated
  using (public.is_workspace_writable(workspace_id))
  with check (public.is_workspace_writable(workspace_id));

create policy "receivable_installment_history_delete_own"
  on public.receivable_installment_history for delete
  to authenticated
  using (public.is_workspace_writable(workspace_id));

-- Las tablas nuevas no reciben privilegios por defecto (ver SPEC 27)
grant select, insert, update, delete on public.receivable_installment_history
  to authenticated;

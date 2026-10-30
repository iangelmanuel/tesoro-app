-- Metas de ahorro y sus aportes (SPEC 05). Los aportes son independientes
-- de los movimientos: no cambian el balance, los gastos ni los presupuestos.
-- Un aporte tiene monto positivo y un retiro, negativo.

create type public.goal_status as enum ('active', 'completed', 'archived');

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  target_amount numeric(14, 2) not null check (target_amount > 0),
  target_date date,
  icon text not null,  -- clave de CATEGORY_ICONS
  color text not null, -- clave de CATEGORY_COLORS
  status public.goal_status not null default 'active',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'completed') = (completed_at is not null)),
  -- Destino de la FK compuesta de goal_contributions
  unique (id, workspace_id)
);

create index savings_goals_workspace on public.savings_goals (workspace_id);

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  goal_id uuid not null,
  amount numeric(14, 2) not null check (amount <> 0), -- > 0 aporte, < 0 retiro
  occurred_on date not null,
  note text check (char_length(note) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- El aporte siempre es del mismo espacio que su meta
  foreign key (goal_id, workspace_id)
    references public.savings_goals (id, workspace_id) on delete cascade
);

create index goal_contributions_goal
  on public.goal_contributions (goal_id, occurred_on desc, created_at desc);

-- Triggers
create trigger savings_goals_set_updated_at
  before update on public.savings_goals
  for each row execute function public.set_updated_at();

create trigger goal_contributions_set_updated_at
  before update on public.goal_contributions
  for each row execute function public.set_updated_at();

-- Solo se registran, editan o borran aportes de metas activas, sin cambiar
-- de meta y con fecha hasta hoy (America/Bogota). Bloquea la fila de la meta
-- para que check_goal_balance no corra en paralelo con otro aporte.
create function public.check_goal_contribution()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status public.goal_status;
begin
  if tg_op = 'DELETE' then
    select status into v_status
    from public.savings_goals
    where id = old.goal_id
    for update;

    -- Sin meta: borrado en cascada desde la meta o el espacio
    if not found then
      return old;
    end if;

    if v_status <> 'active' then
      raise exception 'Reactiva la meta para registrar aportes'
        using errcode = 'check_violation';
    end if;

    return old;
  end if;

  if tg_op = 'UPDATE' and new.goal_id <> old.goal_id then
    raise exception 'Un aporte no puede cambiar de meta'
      using errcode = 'check_violation';
  end if;

  select status into v_status
  from public.savings_goals
  where id = new.goal_id
  for update;

  if not found or v_status <> 'active' then
    raise exception 'Reactiva la meta para registrar aportes'
      using errcode = 'check_violation';
  end if;

  if new.occurred_on > (now() at time zone 'America/Bogota')::date then
    raise exception 'La fecha del aporte no puede ser futura'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger goal_contributions_check_contribution
  before insert or update or delete on public.goal_contributions
  for each row execute function public.check_goal_contribution();

-- El saldo de la meta nunca queda negativo, aunque el cliente se salte la
-- validación. Cubre retiros, ediciones y borrados de aportes.
create function public.check_goal_balance()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_goal_id uuid := case when tg_op = 'DELETE' then old.goal_id else new.goal_id end;
begin
  if (
    select coalesce(sum(amount), 0)
    from public.goal_contributions
    where goal_id = v_goal_id
  ) < 0 then
    raise exception 'No puedes retirar más de lo ahorrado'
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

create trigger goal_contributions_check_balance
  after insert or update or delete on public.goal_contributions
  for each row execute function public.check_goal_balance();

-- Las funciones de trigger no se exponen como RPC
revoke execute on function public.check_goal_contribution() from public, anon, authenticated;
revoke execute on function public.check_goal_balance() from public, anon, authenticated;

-- RLS
alter table public.savings_goals enable row level security;
alter table public.goal_contributions enable row level security;

create policy "savings_goals_select_own"
  on public.savings_goals for select
  to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy "savings_goals_insert_own"
  on public.savings_goals for insert
  to authenticated
  with check (public.is_workspace_owner(workspace_id));

create policy "savings_goals_update_own"
  on public.savings_goals for update
  to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

-- Sin política delete: las metas solo se archivan

create policy "goal_contributions_select_own"
  on public.goal_contributions for select
  to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy "goal_contributions_insert_own"
  on public.goal_contributions for insert
  to authenticated
  with check (public.is_workspace_owner(workspace_id));

create policy "goal_contributions_update_own"
  on public.goal_contributions for update
  to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy "goal_contributions_delete_own"
  on public.goal_contributions for delete
  to authenticated
  using (public.is_workspace_owner(workspace_id));

-- Lo ahorrado por meta, en cualquier estado. Respeta RLS (security invoker).
create function public.goal_progress(p_workspace_id uuid)
returns table (
  id uuid,
  name text,
  target_amount numeric,
  target_date date,
  icon text,
  color text,
  status public.goal_status,
  completed_at timestamptz,
  created_at timestamptz,
  saved numeric,
  contributions_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select g.id, g.name, g.target_amount, g.target_date, g.icon, g.color,
         g.status, g.completed_at, g.created_at,
         coalesce(sum(c.amount), 0), count(c.id)
  from public.savings_goals g
  left join public.goal_contributions c on c.goal_id = g.id
  where g.workspace_id = p_workspace_id
  group by g.id
  order by g.created_at;
$$;

revoke execute on function public.goal_progress(uuid) from public, anon;
grant execute on function public.goal_progress(uuid) to authenticated;

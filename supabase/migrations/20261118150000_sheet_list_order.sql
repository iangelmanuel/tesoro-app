-- Orden manual en los paneles laterales (SPEC 45).
--   categories.position: orden propio de las categorías activas del espacio,
--                        por tipo. null = sin ordenar (nueva): va al final,
--                        por nombre. Las del sistema no se ordenan.
--   move_debt_entry / move_goal_contribution: reordenan dentro del mismo día
--   el historial de una deuda o de una meta, con day_position (SPEC 19).

alter table public.categories
  add column position integer;

-- move_category: la categoría toma el lugar de otra activa del mismo espacio
-- y tipo, y renumera position = 1..n en ese grupo. Security invoker: RLS
-- decide qué filas se escriben.
create function public.move_category(
  p_workspace_id uuid,
  p_id uuid,
  p_target_id uuid
)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_type public.transaction_type;
  v_target_type public.transaction_type;
  v_done integer;
begin
  if not public.is_workspace_writable(p_workspace_id) then
    raise exception 'No tienes permiso para modificar este espacio'
      using errcode = 'insufficient_privilege';
  end if;

  select type into v_type
  from public.categories
  where workspace_id = p_workspace_id and id = p_id and archived_at is null;

  if not found then
    raise exception 'La categoría no existe'
      using errcode = 'no_data_found';
  end if;

  select type into v_target_type
  from public.categories
  where workspace_id = p_workspace_id
    and id = p_target_id
    and archived_at is null;

  if not found then
    raise exception 'La categoría de destino no existe'
      using errcode = 'no_data_found';
  end if;

  if v_type <> v_target_type then
    raise exception 'Solo se puede reordenar dentro del mismo tipo'
      using errcode = 'check_violation';
  end if;

  if p_id = p_target_id then
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_workspace_id::text || 'categories' || v_type::text, 0)
  );

  with grp as (
    select c.id,
           row_number() over (
             order by c.position nulls last, c.name, c.id
           ) as rn
    from public.categories c
    where c.workspace_id = p_workspace_id
      and c.type = v_type
      and c.archived_at is null
  ),
  src as (select rn from grp where id = p_id),
  tgt as (select rn from grp where id = p_target_id),
  -- La fila origen toma la posición del destino: baja pasa después de él,
  -- sube pasa antes
  keyed as (
    select g.id,
           case
             when g.id = p_id then
               tgt.rn + case when src.rn < tgt.rn then 0.5 else -0.5 end
             else g.rn::numeric
           end as sort_key
    from grp g, src, tgt
  ),
  ordered as (
    select k.id, row_number() over (order by k.sort_key) as pos
    from keyed k
  ),
  updated as (
    update public.categories c
    set position = o.pos
    from ordered o
    where o.id = c.id
      and c.workspace_id = p_workspace_id
      and c.position is distinct from o.pos
    returning c.id
  )
  select 1 into v_done;
end;
$$;

-- move_debt_entry: el movimiento de una deuda toma el lugar de otro del mismo
-- día y de la misma deuda, y renumera day_position = 1..n en ese grupo. El
-- orden relativo de las demás filas del día en Movimientos no cambia.
create function public.move_debt_entry(
  p_id uuid,
  p_target_id uuid
)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_workspace uuid;
  v_debt uuid;
  v_day date;
  v_target_debt uuid;
  v_target_day date;
  v_done integer;
begin
  select workspace_id, debt_id, occurred_on
  into v_workspace, v_debt, v_day
  from public.debt_entries
  where id = p_id;

  if not found then
    raise exception 'El movimiento no existe'
      using errcode = 'no_data_found';
  end if;

  if not public.is_workspace_writable(v_workspace) then
    raise exception 'No tienes permiso para modificar este espacio'
      using errcode = 'insufficient_privilege';
  end if;

  select debt_id, occurred_on into v_target_debt, v_target_day
  from public.debt_entries
  where id = p_target_id;

  if not found or v_target_debt <> v_debt then
    raise exception 'El movimiento de destino no existe'
      using errcode = 'no_data_found';
  end if;

  if v_day <> v_target_day then
    raise exception 'Solo se puede reordenar dentro del mismo día'
      using errcode = 'check_violation';
  end if;

  if p_id = p_target_id then
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_workspace::text || v_day::text, 0)
  );

  with grp as (
    select e.id,
           row_number() over (
             order by e.day_position, e.created_at desc, e.id
           ) as rn
    from public.debt_entries e
    where e.debt_id = v_debt and e.occurred_on = v_day
  ),
  src as (select rn from grp where id = p_id),
  tgt as (select rn from grp where id = p_target_id),
  keyed as (
    select g.id,
           case
             when g.id = p_id then
               tgt.rn + case when src.rn < tgt.rn then 0.5 else -0.5 end
             else g.rn::numeric
           end as sort_key
    from grp g, src, tgt
  ),
  ordered as (
    select k.id, row_number() over (order by k.sort_key) as pos
    from keyed k
  ),
  updated as (
    update public.debt_entries e
    set day_position = o.pos
    from ordered o
    where o.id = e.id
      and e.debt_id = v_debt
      and e.day_position is distinct from o.pos
    returning e.id
  )
  select 1 into v_done;
end;
$$;

-- move_goal_contribution: igual que move_debt_entry, en los aportes y
-- retiros de una meta
create function public.move_goal_contribution(
  p_id uuid,
  p_target_id uuid
)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_workspace uuid;
  v_goal uuid;
  v_day date;
  v_target_goal uuid;
  v_target_day date;
  v_done integer;
begin
  select workspace_id, goal_id, occurred_on
  into v_workspace, v_goal, v_day
  from public.goal_contributions
  where id = p_id;

  if not found then
    raise exception 'El aporte no existe'
      using errcode = 'no_data_found';
  end if;

  if not public.is_workspace_writable(v_workspace) then
    raise exception 'No tienes permiso para modificar este espacio'
      using errcode = 'insufficient_privilege';
  end if;

  select goal_id, occurred_on into v_target_goal, v_target_day
  from public.goal_contributions
  where id = p_target_id;

  if not found or v_target_goal <> v_goal then
    raise exception 'El aporte de destino no existe'
      using errcode = 'no_data_found';
  end if;

  if v_day <> v_target_day then
    raise exception 'Solo se puede reordenar dentro del mismo día'
      using errcode = 'check_violation';
  end if;

  if p_id = p_target_id then
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_workspace::text || v_day::text, 0)
  );

  with grp as (
    select c.id,
           row_number() over (
             order by c.day_position, c.created_at desc, c.id
           ) as rn
    from public.goal_contributions c
    where c.goal_id = v_goal and c.occurred_on = v_day
  ),
  src as (select rn from grp where id = p_id),
  tgt as (select rn from grp where id = p_target_id),
  keyed as (
    select g.id,
           case
             when g.id = p_id then
               tgt.rn + case when src.rn < tgt.rn then 0.5 else -0.5 end
             else g.rn::numeric
           end as sort_key
    from grp g, src, tgt
  ),
  ordered as (
    select k.id, row_number() over (order by k.sort_key) as pos
    from keyed k
  ),
  updated as (
    update public.goal_contributions c
    set day_position = o.pos
    from ordered o
    where o.id = c.id
      and c.goal_id = v_goal
      and c.day_position is distinct from o.pos
    returning c.id
  )
  select 1 into v_done;
end;
$$;

revoke execute on function public.move_category(uuid, uuid, uuid) from public, anon;
grant execute on function public.move_category(uuid, uuid, uuid) to authenticated;
revoke execute on function public.move_debt_entry(uuid, uuid) from public, anon;
grant execute on function public.move_debt_entry(uuid, uuid) to authenticated;
revoke execute on function public.move_goal_contribution(uuid, uuid) from public, anon;
grant execute on function public.move_goal_contribution(uuid, uuid) to authenticated;

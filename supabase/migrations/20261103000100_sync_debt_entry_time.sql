-- La hora del pago también manda sobre su movimiento (SPEC 19): editar el
-- pago copia monto, fecha y hora al movimiento enlazado.
create or replace function public.sync_debt_entry_transaction()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.transaction_id is not null then
      delete from public.transactions where id = old.transaction_id;
    end if;

    return null;
  end if;

  if new.transaction_id is not null then
    update public.transactions
    set amount = new.amount,
        occurred_on = new.occurred_on,
        occurred_time = new.occurred_time
    where id = new.transaction_id
      and (
        amount <> new.amount
        or occurred_on <> new.occurred_on
        or occurred_time is distinct from new.occurred_time
      );
  end if;

  return null;
end;
$$;

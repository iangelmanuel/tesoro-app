-- Alinea los abonos con su movimiento enlazado cuando difieren (SPEC 26).
--
-- Antes de SPEC 26, editar desde Movimientos el movimiento de un pago de
-- préstamo o de un cobro de Me deben no llegaba al abono:
-- sync_debt_entry_transaction solo copia del abono al movimiento. El saldo de
-- la deuda quedaba con el monto viejo. Ahora el movimiento ya no se edita por
-- separado (lo frenan las actions), así que esto corrige solo lo histórico.
--
-- Manda el movimiento: es lo último que el usuario editó y lo que ve en
-- Movimientos. Se alinean monto, fecha y hora, los mismos campos que el
-- trigger sincroniza. La cuenta no: en préstamos y cuentas por cobrar vive
-- solo en el movimiento (check_debt_entry exige account_id nulo en el abono).
--
-- Fila por fila: si una viola un trigger (saldo negativo, deuda pagada o
-- archivada, fecha futura) se reporta con raise notice y queda sin tocar, en
-- vez de tumbar toda la migración.

do $$
declare
  v_row record;
  v_fixed integer := 0;
  v_skipped integer := 0;
begin
  for v_row in
    select e.id, e.debt_id,
           e.amount as entry_amount, t.amount,
           e.occurred_on as entry_on, t.occurred_on,
           t.occurred_time
    from public.debt_entries e
    join public.transactions t on t.id = e.transaction_id
    where (e.amount, e.occurred_on, e.occurred_time)
          is distinct from (t.amount, t.occurred_on, t.occurred_time)
    -- En cada deuda van primero los pagos que bajan de monto (devuelven
    -- saldo), así los que suben encuentran saldo y no fallan por un estado
    -- intermedio
    order by e.debt_id, t.amount - e.amount
  loop
    begin
      update public.debt_entries
      set amount = v_row.amount,
          occurred_on = v_row.occurred_on,
          occurred_time = v_row.occurred_time
      where id = v_row.id;

      v_fixed := v_fixed + 1;
    exception when others then
      v_skipped := v_skipped + 1;
      raise notice 'Abono % (deuda %) sin alinear: % (abono % el %, movimiento % el %)',
        v_row.id, v_row.debt_id, sqlerrm,
        v_row.entry_amount, v_row.entry_on, v_row.amount, v_row.occurred_on;
    end;
  end loop;

  raise notice 'Abonos alineados con su movimiento: %, sin alinear: %',
    v_fixed, v_skipped;
end;
$$;

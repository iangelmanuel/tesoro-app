-- Cuota de manejo de tarjeta (SPEC 17). El valor nuevo del enum va en su
-- propia migración: Postgres no deja usarlo en la misma transacción que lo
-- crea.

alter type public.debt_entry_kind add value 'fee';

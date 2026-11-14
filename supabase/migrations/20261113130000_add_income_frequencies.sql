-- Frecuencias nuevas de los ingresos fijos (SPEC 38). Van en su propia
-- migración: un valor nuevo de un enum no se puede usar en la misma
-- transacción que lo crea.

alter type public.income_frequency add value 'weekly';
alter type public.income_frequency add value 'daily';
alter type public.income_frequency add value 'every_n_days';

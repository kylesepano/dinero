-- Keeps debt and manual wallet entries outside the financial transaction UI.
-- Existing debt rows remain private, but are no longer selectable as income/expense.
begin;
alter table public.transactions drop constraint transactions_category_for_financial_types;
alter table public.transactions drop constraint transactions_type_check;
alter table public.transactions
  add constraint transactions_type_check
    check (type in ('income','expense','debt_borrowed','debt_lent','wallet_add','wallet_subtract')),
  add constraint transactions_category_for_financial_types
    check (
      (type in ('income','expense') and category_id is not null)
      or (type in ('debt_borrowed','debt_lent','wallet_add','wallet_subtract') and category_id is null)
    );

create or replace function public.load_workspace() returns jsonb
language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object(
  'revision',coalesce((select revision from public.settings where user_id=auth.uid()),0),
  'imports',coalesce((select jsonb_agg(fingerprint order by fingerprint) from public.import_receipts where user_id=auth.uid()),'[]'::jsonb),
  'data',jsonb_build_object(
   'version',1,'demo',coalesce((select demo from public.settings where user_id=auth.uid()),false),
   'settings',jsonb_build_object('currency',coalesce((select currency from public.settings where user_id=auth.uid()),'PHP')),
   'categories',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',id,'name',name,'type',type,'color',color,'icon',icon)) order by type,name) from public.categories where user_id=auth.uid()),'[]'::jsonb),
   'transactions',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',id,'type',type,'amount',amount,'categoryId',category_id,'date',to_char(date,'YYYY-MM-DD'),'time',to_char(time,'HH24:MI'),'note',note)) order by date desc,time desc nulls last,id) from public.transactions where user_id=auth.uid()),'[]'::jsonb),
   'budgets',coalesce((select jsonb_agg(jsonb_build_object('month',month,'amount',amount) order by month) from public.budgets where user_id=auth.uid()),'[]'::jsonb)
  )
 );
$$;
commit;

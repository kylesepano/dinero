-- Debt cash flow is stored alongside transactions so it shares the existing
-- owner-scoped snapshot and revision protection. It deliberately has no category.
begin;
alter table public.transactions
  alter column category_id drop not null,
  add column time time without time zone;
alter table public.transactions drop constraint transactions_type_check;
alter table public.transactions
  add constraint transactions_type_check
    check (type in ('income','expense','debt_borrowed','debt_lent')),
  add constraint transactions_category_for_financial_types
    check (
      (type in ('income','expense') and category_id is not null)
      or (type in ('debt_borrowed','debt_lent') and category_id is null)
    );

create or replace function public.load_workspace() returns jsonb
language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object(
  'revision',coalesce((select revision from public.settings where user_id=auth.uid()),0),
  'imports',coalesce((select jsonb_agg(fingerprint order by fingerprint) from public.import_receipts where user_id=auth.uid()),'[]'::jsonb),
  'data',jsonb_build_object(
   'version',1,
   'demo',coalesce((select demo from public.settings where user_id=auth.uid()),false),
   'settings',jsonb_build_object('currency',coalesce((select currency from public.settings where user_id=auth.uid()),'PHP')),
   'categories',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',id,'name',name,'type',type,'color',color,'icon',icon)) order by type,name) from public.categories where user_id=auth.uid()),'[]'::jsonb),
   'transactions',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',id,'type',type,'amount',amount,'categoryId',category_id,'date',to_char(date,'YYYY-MM-DD'),'time',to_char(time,'HH24:MI'),'note',note)) order by date desc,time desc nulls last,id) from public.transactions where user_id=auth.uid()),'[]'::jsonb),
   'budgets',coalesce((select jsonb_agg(jsonb_build_object('month',month,'amount',amount) order by month) from public.budgets where user_id=auth.uid()),'[]'::jsonb)
  )
 );
$$;

create or replace function public.save_workspace(payload jsonb, expected_revision bigint, import_hash text default null) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare owner uuid := auth.uid(); current_revision bigint;
begin
 if owner is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if payload->>'version' is distinct from '1' or jsonb_typeof(payload->'demo') is distinct from 'boolean'
 or jsonb_typeof(payload->'categories') is distinct from 'array'
 or jsonb_typeof(payload->'transactions') is distinct from 'array'
 or jsonb_typeof(payload->'budgets') is distinct from 'array'
 or jsonb_typeof(payload->'settings') is distinct from 'object'
 then raise exception 'invalid_workspace'; end if;
 if octet_length(payload::text)>5000000 then raise exception 'workspace_too_large'; end if;
 if (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(payload->'transactions') x)>9007199254740991 then raise exception 'unsafe_total'; end if;
 insert into public.settings(user_id) values(owner) on conflict(user_id) do nothing;
 select revision into current_revision from public.settings where user_id=owner for update;
 if import_hash is not null and exists(select 1 from public.import_receipts where user_id=owner and fingerprint=import_hash) then raise exception 'already_imported'; end if;
 if expected_revision is null or current_revision<>expected_revision then raise exception 'revision_conflict' using errcode='40001'; end if;

 delete from public.transactions where user_id=owner and id not in (select (x->>'id')::uuid from jsonb_array_elements(payload->'transactions') x);
 delete from public.categories where user_id=owner and id not in (select (x->>'id')::uuid from jsonb_array_elements(payload->'categories') x);
 insert into public.categories(id,user_id,name,type,color,icon)
 select (x->>'id')::uuid,owner,x->>'name',x->>'type',x->>'color',(x->>'icon')::smallint from jsonb_array_elements(payload->'categories') x
 on conflict(id) do update set name=excluded.name,type=excluded.type,color=excluded.color,icon=excluded.icon;
 insert into public.transactions(id,user_id,type,amount,category_id,date,time,note)
 select (x->>'id')::uuid,owner,x->>'type',(x->>'amount')::bigint,nullif(x->>'categoryId','')::uuid,(x->>'date')::date,nullif(x->>'time','')::time,x->>'note' from jsonb_array_elements(payload->'transactions') x
 on conflict(id) do update set type=excluded.type,amount=excluded.amount,category_id=excluded.category_id,date=excluded.date,time=excluded.time,note=excluded.note;
 delete from public.budgets where user_id=owner and month not in (select x->>'month' from jsonb_array_elements(payload->'budgets') x);
 insert into public.budgets(user_id,month,amount)
 select owner,x->>'month',(x->>'amount')::bigint from jsonb_array_elements(payload->'budgets') x
 on conflict(user_id,month) do update set amount=excluded.amount;
 update public.settings set currency=payload->'settings'->>'currency',demo=(payload->>'demo')::boolean,revision=current_revision+1 where user_id=owner;
 if import_hash is not null then insert into public.import_receipts(user_id,fingerprint) values(owner,import_hash); end if;
 return public.load_workspace();
end;
$$;
commit;

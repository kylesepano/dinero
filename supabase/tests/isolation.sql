-- Run only against a disposable/staging database after migrations.
-- All fixtures roll back. Real Supabase auth users are represented by two test UUIDs.
begin;
insert into auth.users(id,email) values
 ('a0000000-0000-4000-8000-000000000001','dinero-rls-a@example.invalid'),
 ('b0000000-0000-4000-8000-000000000002','dinero-rls-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
insert into public.categories(id,user_id,name,type,color) values('b1000000-0000-4000-8000-000000000001',auth.uid(),'B private','expense','#26876b');
insert into public.transactions(id,user_id,type,amount,category_id,date,note) values('b2000000-0000-4000-8000-000000000001',auth.uid(),'expense',100,'b1000000-0000-4000-8000-000000000001','2026-09-08','B private');
insert into public.budgets(user_id,month,amount) values(auth.uid(),'2026-09',10000);
insert into public.settings(user_id) values(auth.uid());
insert into public.import_receipts(user_id,fingerprint) values(auth.uid(),repeat('b',64));
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$
declare t text; n integer; blocked boolean;
begin
 foreach t in array array['categories','transactions','budgets','settings','import_receipts'] loop
  execute format('select count(*) from public.%I where user_id=''b0000000-0000-4000-8000-000000000002''',t) into n;
  if n<>0 then raise exception 'A read B in %',t; end if;
  execute format('update public.%I set user_id=user_id where user_id=''b0000000-0000-4000-8000-000000000002''',t);
  get diagnostics n=row_count; if n<>0 then raise exception 'A updated B in %',t; end if;
  execute format('delete from public.%I where user_id=''b0000000-0000-4000-8000-000000000002''',t);
  get diagnostics n=row_count; if n<>0 then raise exception 'A deleted B in %',t; end if;
 end loop;
 blocked=false;
 begin insert into public.categories(user_id,name,type,color) values('b0000000-0000-4000-8000-000000000002','stolen','expense','#26876b'); exception when insufficient_privilege then blocked=true; end;
 if not blocked then raise exception 'A inserted B category'; end if;
 blocked=false;
 begin insert into public.transactions(user_id,type,amount,category_id,date) values('b0000000-0000-4000-8000-000000000002','expense',1,'b1000000-0000-4000-8000-000000000001',current_date); exception when insufficient_privilege then blocked=true; end;
 if not blocked then raise exception 'A inserted B transaction'; end if;
 blocked=false;
 begin insert into public.budgets(user_id,month,amount) values('b0000000-0000-4000-8000-000000000002','2026-10',1); exception when insufficient_privilege then blocked=true; end;
 if not blocked then raise exception 'A inserted B budget'; end if;
 blocked=false;
 begin insert into public.settings(user_id) values('b0000000-0000-4000-8000-000000000002'); exception when insufficient_privilege then blocked=true; end;
 if not blocked then raise exception 'A inserted B settings'; end if;
 blocked=false;
 begin insert into public.import_receipts(user_id,fingerprint) values('b0000000-0000-4000-8000-000000000002',repeat('c',64)); exception when insufficient_privilege then blocked=true; end;
 if not blocked then raise exception 'A inserted B receipt'; end if;
 blocked=false;
 begin insert into public.transactions(user_id,type,amount,category_id,date) values(auth.uid(),'expense',1,'b1000000-0000-4000-8000-000000000001',current_date); exception when foreign_key_violation or restrict_violation then blocked=true; end;
 if not blocked then raise exception 'A attached B category'; end if;
end $$;
-- Positive own-account operations, ownership changes, category dependencies and atomic rollback.
insert into public.categories(id,user_id,name,type,color) values('a1000000-0000-4000-8000-000000000001',auth.uid(),'A private','expense','#26876b');
insert into public.transactions(user_id,type,amount,category_id,date) values(auth.uid(),'expense',100,'a1000000-0000-4000-8000-000000000001','2026-09-08');
insert into public.budgets(user_id,month,amount) values(auth.uid(),'2026-09',1000);
insert into public.settings(user_id) values(auth.uid());
insert into public.import_receipts(user_id,fingerprint) values(auth.uid(),repeat('a',64));
do $$
declare t text; n integer; blocked boolean; before_data jsonb; after_data jsonb; v jsonb;
begin
 foreach t in array array['categories','transactions','budgets','settings','import_receipts'] loop
  execute format('select count(*) from public.%I where user_id=auth.uid()',t) into n;
  if n<>1 then raise exception 'Own read failed in %',t; end if;
  blocked=false;
  begin execute format('update public.%I set user_id=''b0000000-0000-4000-8000-000000000002'' where user_id=auth.uid()',t); exception when insufficient_privilege then blocked=true; end;
  if not blocked then raise exception 'Ownership change allowed in %',t; end if;
 end loop;
 blocked=false;
 begin delete from public.categories where user_id=auth.uid(); exception when foreign_key_violation or restrict_violation then blocked=true; end;
 if not blocked then raise exception 'Used category deleted'; end if;
 before_data=public.load_workspace();
 v=public.save_workspace(before_data->'data',0,repeat('d',64));
 if (v->>'revision')::int<>1 then raise exception 'Save failed'; end if;
 blocked=false;
 begin perform public.save_workspace(v->'data',0); exception when serialization_failure then blocked=true; end;
 if not blocked then raise exception 'Stale revision accepted'; end if;
 blocked=false;
 begin perform public.save_workspace(v->'data',1,repeat('d',64)); exception when raise_exception then blocked=sqlerrm='already_imported'; end;
 if not blocked then raise exception 'Duplicate import accepted'; end if;
 before_data=public.load_workspace();
 blocked=false;
 begin perform public.save_workspace(jsonb_set(before_data->'data','{settings,currency}','"INVALID"'),1); exception when check_violation then blocked=true; end;
 after_data=public.load_workspace();
 if not blocked or before_data<>after_data then raise exception 'Failed save was not atomic'; end if;
end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
do $$
declare t text; blocked boolean;
begin
 foreach t in array array['categories','transactions','budgets','settings','import_receipts'] loop
  blocked=false;
  begin execute format('select * from public.%I',t); exception when insufficient_privilege then blocked=true; end;
  if not blocked then raise exception 'Anonymous access allowed in %',t; end if;
 end loop;
 blocked=false;
 begin perform public.load_workspace(); exception when insufficient_privilege then blocked=true; end;
 if not blocked then raise exception 'Anonymous RPC access'; end if;
end $$;
rollback;


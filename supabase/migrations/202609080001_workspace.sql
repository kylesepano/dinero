-- dinero Phase 3: owner-scoped data. Apply to a new Supabase project using SQL Editor or CLI.
begin;
create table public.categories (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (name = btrim(name) and char_length(name) between 1 and 50),
 type text not null check (type in ('income','expense')),
 color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
 icon smallint check (icon between 0 and 5),
 unique (id, user_id, type)
);
create unique index categories_owner_name on public.categories (user_id, type, lower(name));
create table public.transactions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 type text not null check (type in ('income','expense')),
 amount bigint not null check (amount between 1 and 999999999999),
 category_id uuid not null,
 date date not null check (date between date '0001-01-01' and date '9999-12-31'),
 note text not null default '' check (char_length(note) <= 250),
 foreign key (category_id,user_id,type) references public.categories(id,user_id,type) on delete restrict on update restrict
);
create index transactions_owner_date on public.transactions (user_id,date desc);
create index transactions_category on public.transactions (category_id,user_id,type);
create table public.budgets (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 amount bigint not null check (amount between 1 and 999999999999),
 unique (user_id,month)
);
create table public.settings (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references auth.users(id) on delete cascade,
 currency text not null default 'PHP' check (currency in ('PHP','USD','EUR','SGD')),
 demo boolean not null default false,
 revision bigint not null default 0 check (revision between 0 and 9007199254740991)
);
-- Retained when clearing financial records to prevent re-importing a backup by accident.
create table public.import_receipts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now(),
 unique (user_id,fingerprint)
);

-- Every table has explicit per-operation policies. No anonymous financial-data access.
do $$
declare t text;
begin
 foreach t in array array['categories','transactions','budgets','settings','import_receipts'] loop
  execute format('alter table public.%I enable row level security', t);
  execute format('alter table public.%I force row level security', t);
  execute format('revoke all on public.%I from public, anon, authenticated', t);
  execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  execute format('create policy owner_select on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
  execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
  execute format('create policy owner_update on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
  execute format('create policy owner_delete on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
 end loop;
end $$;
commit;

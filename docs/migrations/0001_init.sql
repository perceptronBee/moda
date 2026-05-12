-- Moda — initial schema
-- Supabase SQL Editor'da çalıştır.
-- Sıra: önce tablolar, sonra RLS, sonra storage politikaları.

-- =============================================================================
-- 1) Tablolar
-- =============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  kvkk_accepted_at timestamptz not null,
  kvkk_ip text,
  front_photo_path text,
  back_photo_path text,
  back_is_ai_generated boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.tryon_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  outfit_data jsonb not null,
  result_path text not null,
  created_at timestamptz default now() not null
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id text not null,
  size text,
  quantity int default 1 not null check (quantity > 0),
  created_at timestamptz default now() not null
);

create index if not exists idx_tryon_user on public.tryon_history(user_id);
create index if not exists idx_cart_user on public.cart_items(user_id);

-- updated_at otomatik tetikleyici
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 2) Row-Level Security
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.tryon_history enable row level security;
alter table public.cart_items enable row level security;

-- profiles
drop policy if exists "kendi profilini oku" on public.profiles;
create policy "kendi profilini oku" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "kendi profilini yarat" on public.profiles;
create policy "kendi profilini yarat" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "kendi profilini guncelle" on public.profiles;
create policy "kendi profilini guncelle" on public.profiles
  for update using (auth.uid() = id);

-- tryon_history
drop policy if exists "kendi try-on geçmişini oku" on public.tryon_history;
create policy "kendi try-on geçmişini oku" on public.tryon_history
  for select using (auth.uid() = user_id);

drop policy if exists "kendi try-on geçmişine ekle" on public.tryon_history;
create policy "kendi try-on geçmişine ekle" on public.tryon_history
  for insert with check (auth.uid() = user_id);

-- cart_items
drop policy if exists "kendi sepetini yonet" on public.cart_items;
create policy "kendi sepetini yonet" on public.cart_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- 3) Storage Buckets + Politikalar
-- =============================================================================
-- Önce Supabase Dashboard → Storage'da MANUEL OLARAK bu bucket'ları oluştur:
--   - user-photos  (Public: NO)
--   - tryon-results (Public: NO)
-- Sonra aşağıdaki politikaları çalıştır.

-- user-photos: kullanıcı sadece kendi klasörüne (id) yazıp okuyabilir
drop policy if exists "user-photos: kendi klasörüne yaz" on storage.objects;
create policy "user-photos: kendi klasörüne yaz" on storage.objects
  for insert
  with check (
    bucket_id = 'user-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "user-photos: kendi klasörünü oku" on storage.objects;
create policy "user-photos: kendi klasörünü oku" on storage.objects
  for select
  using (
    bucket_id = 'user-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "user-photos: kendi klasörünü güncelle" on storage.objects;
create policy "user-photos: kendi klasörünü güncelle" on storage.objects
  for update
  using (
    bucket_id = 'user-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "user-photos: kendi klasörünü sil" on storage.objects;
create policy "user-photos: kendi klasörünü sil" on storage.objects
  for delete
  using (
    bucket_id = 'user-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- tryon-results: aynı kurallar
drop policy if exists "tryon-results: kendi klasörüne yaz" on storage.objects;
create policy "tryon-results: kendi klasörüne yaz" on storage.objects
  for insert with check (
    bucket_id = 'tryon-results'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "tryon-results: kendi klasörünü oku" on storage.objects;
create policy "tryon-results: kendi klasörünü oku" on storage.objects
  for select using (
    bucket_id = 'tryon-results'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

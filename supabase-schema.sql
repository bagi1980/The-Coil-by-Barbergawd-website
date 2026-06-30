-- BarberApp — Supabase schema
-- Pokreni ovo u Supabase Dashboard > SQL Editor

create table if not exists appointments (
  id          text primary key,
  date        text not null,
  time        text not null,
  barber_id   text not null,
  service_id  text,
  name        text not null,
  phone       text not null,
  greeted     boolean default false,
  created_at  bigint
);

create table if not exists breaks (
  id          text primary key,
  barber_id   text not null,
  date        text not null,
  start_time  text not null,
  end_time    text not null
);

create table if not exists photos (
  client_key   text primary key,
  data_url     text,
  version      bigint,
  consent      boolean default false,
  consent_date bigint
);

-- Ako tabela photos već postoji bez consent kolona, pokreni ovo:
alter table photos add column if not exists consent boolean default false;
alter table photos add column if not exists consent_date bigint;

-- Indeksi za brže upite
create index if not exists appointments_date_idx on appointments(date);
create index if not exists breaks_date_idx on breaks(date);

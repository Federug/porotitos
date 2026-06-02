import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || ''
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseKey)

// SQL para crear las tablas en Supabase (ejecutar en SQL Editor)
export const SCHEMA_SQL = `
-- Jugadores
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  avatar_color text default '#6366f1',
  created_at timestamptz default now()
);

-- Categorías de porotos
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  points integer not null,
  description text,
  created_at timestamptz default now()
);

-- Partidas
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  map text not null,
  result text check (result in ('victoria', 'derrota', 'empate')) not null,
  played_at timestamptz default now(),
  notes text,
  score_us integer,
  score_them integer
);

-- Porotos asignados por partida
create table if not exists match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  points integer not null,
  created_at timestamptz default now()
);

-- Insertar categorías por defecto
insert into categories (name, points, description) values
  ('Clutch', -1, 'Ganó un round en desventaja'),
  ('MVP', -1, 'Salió MVP de la partida'),
  ('Último', 1, 'Salió último en el scoreboard'),
  ('Fakear y errar', 1, 'Hizo fake y falló'),
  ('Ace', -1, 'Mató a los 5 del equipo rival'),
  ('Dif 2 y perder', 1, 'Tenía diferencia de 2 kills y perdió'),
  ('Decisión general', 1, 'Tomó una mala decisión general')
on conflict do nothing;
`

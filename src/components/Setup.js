import React from 'react'

export default function Setup() {
  return (
    <div className="setup-page">
      <div className="setup-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 40 }}>🫘</span>
          <h1>POROTITOS</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 28, fontSize: 15 }}>
          Para comenzar, necesitás configurar Supabase como base de datos gratuita.
          Seguí estos pasos:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <h3>1. Crear cuenta en Supabase</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              Andá a{' '}
              <a href="https://supabase.com" target="_blank" rel="noreferrer"
                style={{ color: 'var(--accent-blue)' }}>supabase.com</a>
              {' '}→ New Project → ponerle nombre "porotitos"
            </p>
          </div>

          <div>
            <h3>2. Crear las tablas</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 8 }}>
              En Supabase → SQL Editor → pegá y ejecutá este SQL:
            </p>
            <div className="code-block">{`create table players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  avatar_color text default '#ff4655',
  created_at timestamptz default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  points integer not null,
  description text,
  created_at timestamptz default now()
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  map text not null,
  result text check (result in ('victoria','derrota','empate')) not null,
  played_at timestamptz default now(),
  notes text,
  score_us integer,
  score_them integer
);

create table match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  points integer not null,
  created_at timestamptz default now()
);

-- Categorías por defecto
insert into categories (name, points, description) values
  ('Clutch', -1, 'Ganó un round en desventaja'),
  ('MVP', -1, 'Salió MVP de la partida'),
  ('Último', 1, 'Salió último en el scoreboard'),
  ('Fakear y errar', 1, 'Hizo fake y falló'),
  ('Ace', -1, 'Mató a los 5 del equipo rival'),
  ('Dif 2 y perder', 1, 'Tenía diferencia de 2 kills y perdió'),
  ('Decisión general', 1, 'Tomó una mala decisión general');`}</div>
          </div>

          <div>
            <h3>3. Obtener las credenciales</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              En Supabase → Project Settings → API → copiá{' '}
              <strong style={{ color: 'var(--text-primary)' }}>Project URL</strong> y{' '}
              <strong style={{ color: 'var(--text-primary)' }}>anon/public key</strong>
            </p>
          </div>

          <div>
            <h3>4. Configurar el proyecto</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 8 }}>
              Creá el archivo <code style={{ background: 'var(--bg-base)', padding: '2px 6px', borderRadius: 4, color: 'var(--accent-green)' }}>.env</code> en la raíz del proyecto:
            </p>
            <div className="code-block">{`REACT_APP_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGci...`}</div>
          </div>

          <div>
            <h3>5. Deployar gratis en Vercel</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              Subí el proyecto a GitHub, conectalo en{' '}
              <a href="https://vercel.com" target="_blank" rel="noreferrer"
                style={{ color: 'var(--accent-blue)' }}>vercel.com</a>
              {' '}y configurá las variables de entorno ahí también. ¡Listo!
            </p>
          </div>
        </div>

        <div style={{ marginTop: 24, padding: 14, background: 'var(--accent-dim)', borderRadius: 8, border: '1px solid rgba(255,70,85,0.3)' }}>
          <p style={{ fontSize: 13, color: 'var(--accent)' }}>
            ⚡ Después de configurar el .env, reiniciá el servidor con <code>npm start</code>
          </p>
        </div>
      </div>
    </div>
  )
}

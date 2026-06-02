# 🫘 POROTITOS — Valorant Team Scoring System

Sistema de tracking de "porotos" para tu squad de Valorant.

## ¿Qué hace?

- Registrá partidas con mapa, resultado y score
- Asigná porotos a cada jugador según categorías (Clutch, MVP, Último, etc.)
- Dashboard con ranking, gráficos y estadísticas del equipo
- Gestión de jugadores y categorías personalizables
- Historial completo de partidas expandible

## Stack

- **Frontend**: React 18
- **Base de datos**: Supabase (PostgreSQL gratuito)
- **Hosting**: Vercel o Netlify (gratis)
- **Gráficos**: Recharts

---

## Setup completo

### 1. Crear proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com) → Sign up → New Project
2. Nombre: `porotitos`, elegí región (South America si está disponible, sino US East)
3. Guardá la contraseña de la DB

### 2. Crear las tablas

En Supabase → **SQL Editor** → New query → pegá y ejecutá:

```sql
create table players (
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
  ('Decisión general', 1, 'Tomó una mala decisión general');
```

### 3. Configurar Row Level Security (para que sea público entre el squad)

En Supabase → **Authentication → Policies** o en SQL Editor:

```sql
-- Permitir lectura y escritura pública (todos en el squad pueden usar la app)
alter table players enable row level security;
alter table categories enable row level security;
alter table matches enable row level security;
alter table match_events enable row level security;

create policy "public_all" on players for all using (true) with check (true);
create policy "public_all" on categories for all using (true) with check (true);
create policy "public_all" on matches for all using (true) with check (true);
create policy "public_all" on match_events for all using (true) with check (true);
```

### 4. Obtener credenciales

Supabase → **Project Settings** → **API**:
- Copiá `Project URL`
- Copiá `anon / public` key

### 5. Configurar variables de entorno

Copiá `.env.example` a `.env` y completá:

```
REACT_APP_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGci...
```

### 6. Instalar y correr local

```bash
npm install
npm start
```

### 7. Deploy en Vercel (gratis)

1. Subí el proyecto a GitHub
2. Ir a [vercel.com](https://vercel.com) → New Project → importar el repo
3. En **Environment Variables** agregar las mismas variables del `.env`
4. Deploy → ¡listo! Compartí la URL con tu squad

---

## Estructura del proyecto

```
porotitos/
├── src/
│   ├── components/
│   │   ├── Dashboard.js      # Dashboard principal con métricas
│   │   ├── NewMatch.js       # Registro de partidas
│   │   ├── MatchHistory.js   # Historial expandible
│   │   ├── Players.js        # Gestión de jugadores
│   │   ├── Categories.js     # Gestión de categorías
│   │   └── Setup.js          # Pantalla de configuración inicial
│   ├── lib/
│   │   └── supabase.js       # Cliente Supabase
│   ├── App.js                # Routing y layout
│   └── App.css               # Estilos (dark tactical theme)
├── public/
│   └── index.html
├── .env.example
└── package.json
```

## Categorías por defecto

| Categoría | Puntos | Descripción |
|---|---|---|
| Clutch | -1 🟢 | Ganó un round en desventaja |
| MVP | -1 🟢 | Salió MVP de la partida |
| Ace | -1 🟢 | Mató a los 5 rivales |
| Último | +1 🔴 | Salió último en el scoreboard |
| Fakear y errar | +1 🔴 | Hizo fake y falló |
| Dif 2 y perder | +1 🔴 | Tenía +2 kills y perdió el round |
| Decisión general | +1 🔴 | Tomó una mala decisión |

Podés agregar, modificar o eliminar categorías desde la app.

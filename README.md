# ✦ Constellations of Us

A poetry showcase app with three user tiers, Supabase Auth, a Laravel API backend on **Koyeb** (free, always-on), and a Next.js frontend on **Vercel** (free).

---

## 💸 Completely Free Stack

| Service | Platform | Free Tier |
|---------|----------|-----------|
| Frontend | Vercel | ✅ Free forever |
| Backend API | Koyeb | ✅ Free, always-on, no credit card |
| Database + Auth | Supabase | ✅ Free tier (500MB, 50k MAU) |

---

## Architecture

```
┌─────────────────────────────────────────┐
│  Vercel (Next.js Frontend)              │
│  Free · Global CDN · Auto deploys       │
└──────────────┬──────────────────────────┘
               │ HTTPS
┌──────────────▼──────────────────────────┐
│  Koyeb (Laravel 11 API)                 │
│  Free · Always-on · Docker-based        │
│  Verifies JWTs · Enforces roles         │
└──────────────┬──────────────────────────┘
               │ Service Key (server-side only)
┌──────────────▼──────────────────────────┐
│  Supabase                               │
│  PostgreSQL · Auth · Row Level Security │
│  Tables: cards, reactions, comments     │
└─────────────────────────────────────────┘
```

---

## User Roles

| Feature | Guest | Registered | Admin |
|---------|:-----:|:----------:|:-----:|
| View verses | ✅ | ✅ | ✅ |
| Heart reaction | ✅ | ✅ | ✅ |
| Leave comments | ❌ | ✅ | ✅ |
| Add / Edit / Delete verses | ❌ | ❌ | ✅ |
| Schedule verses | ❌ | ❌ | ✅ |
| Delete any comment | ❌ | ❌ | ✅ |

---

## STEP 1 — Supabase Setup

1. Go to your existing Supabase project → **SQL Editor**
2. Paste and run the full contents of `backend/database/migrations/supabase_setup.sql`
3. Go to **Project Settings → API** and note down:
   - **Project URL** → used as `SUPABASE_URL`
   - **service_role** secret → used as `SUPABASE_SERVICE_KEY`

---

## STEP 2 — Deploy Backend to Koyeb

### 2a. Push backend to GitHub

```bash
cd backend
composer install          # generates composer.lock
git init
git add .
git commit -m "feat: initial Laravel API"
git remote add origin https://github.com/YOUR_USERNAME/constellations-api.git
git push -u origin main
```

### 2b. Create Koyeb Service

1. Sign up at [koyeb.com](https://koyeb.com) — no credit card needed
2. Click **Create Service** → choose **GitHub**
3. Select your `constellations-api` repo
4. Koyeb auto-detects the `Dockerfile` ✓
5. Set **Port** to `8000`

### 2c. Set Environment Variables in Koyeb

```
APP_NAME=Constellations of Us
APP_ENV=production
APP_DEBUG=false
APP_KEY=base64:GENERATE_THIS_BELOW
APP_URL=https://YOUR-APP.koyeb.app

FRONTEND_URL=https://YOUR-APP.vercel.app

SUPABASE_URL=https://bjimbgyfiytsqoinvngg.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here

ADMIN_SETUP_KEY=choose-any-random-secret-string

LOG_LEVEL=error
DB_CONNECTION=sqlite
DB_DATABASE=/tmp/db.sqlite
CACHE_STORE=file
SESSION_DRIVER=file
```

**Generate APP_KEY** (run locally in the backend folder):
```bash
php artisan key:generate --show
# Paste the output (starts with base64:) as APP_KEY
```

### 2d. Deploy & test

Click **Deploy**. Once live, test it:
```bash
curl https://YOUR-APP.koyeb.app/api/health
# → {"status":"ok","timestamp":"..."}
```

---

## STEP 3 — Deploy Frontend to Vercel

### 3a. Push frontend to GitHub

```bash
cd frontend
npm install
git init
git add .
git commit -m "feat: initial Next.js frontend"
git remote add origin https://github.com/YOUR_USERNAME/constellations-frontend.git
git push -u origin main
```

### 3b. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project** → import your frontend repo
2. Framework: **Next.js** (auto-detected)
3. Add Environment Variable:
   ```
   NEXT_PUBLIC_API_URL = https://YOUR-APP.koyeb.app/api
   ```
4. Click **Deploy** ✓

---

## STEP 4 — Create Your Admin Account

### 4a. Register via the live app
Open your Vercel URL → click **Join** → register with email & password → confirm via email link → log in.

### 4b. Get your User ID
Go to Supabase → **Authentication → Users** → find your email → copy the **UUID**.

### 4c. Promote yourself to Admin

```bash
curl -X POST https://YOUR-APP.koyeb.app/api/auth/set-admin \
  -H "Content-Type: application/json" \
  -H "X-Admin-Setup-Key: your-ADMIN_SETUP_KEY-from-env" \
  -d '{"user_id": "PASTE-YOUR-UUID-HERE"}'
```

Response: `{"message":"User promoted to admin"}`

### 4d. Log out and log back in
Your **✦ Admin** badge will appear after re-login.

---

## Scheduling — How It Works

When you schedule a verse for tomorrow at 8pm:

1. Card saved with `scheduled_at = tomorrow 8pm`
2. `display_date` is **automatically set to match** (e.g. "May 2, 2026") — no manual entry needed
3. Card is **invisible** to all visitors until then
4. Every **30 seconds** the frontend polls — at 8pm the card auto-appears
5. Admin can hit **▶ Publish Now** in the queue to release it early

---

## Local Development

```bash
# Terminal 1 — Backend (requires PHP 8.2 + Composer)
cd backend
composer install
cp .env.example .env
# Fill in SUPABASE_URL and SUPABASE_SERVICE_KEY in .env
php artisan key:generate
php artisan serve
# → http://localhost:8000

# Terminal 2 — Frontend
cd frontend
npm install
cp .env.local.example .env.local
# Set: NEXT_PUBLIC_API_URL=http://localhost:8000/api
npm run dev
# → http://localhost:3000
```

---

## Project Structure

```
constellations/
├── README.md
│
├── backend/                            ← Laravel 11 → Koyeb
│   ├── Dockerfile                      ← Koyeb builds this
│   ├── docker/
│   │   ├── nginx.conf                  ← serves Laravel on port 8000
│   │   └── supervisord.conf            ← runs nginx + php-fpm
│   ├── app/Http/
│   │   ├── Controllers/
│   │   │   ├── AuthController.php      ← register / login / set-admin
│   │   │   ├── CardController.php      ← CRUD + scheduling
│   │   │   ├── CommentController.php   ← post / delete comments
│   │   │   └── ReactionController.php  ← toggle heart
│   │   └── Middleware/
│   │       ├── CorsMiddleware.php      ← locks to Vercel domain
│   │       ├── SupabaseAuth.php        ← verifies Supabase JWTs
│   │       └── RequireRole.php         ← admin / registered gates
│   ├── app/Services/
│   │   └── SupabaseService.php         ← all DB operations
│   ├── routes/api.php                  ← all API routes
│   └── database/migrations/
│       └── supabase_setup.sql          ← run once in Supabase SQL Editor
│
└── frontend/                           ← Next.js 14 → Vercel
    └── src/
        ├── app/
        │   ├── layout.tsx
        │   ├── page.tsx                ← main page + state management
        │   └── globals.css
        ├── components/
        │   ├── AuthModal.tsx           ← login + register tabs
        │   ├── CardFormModal.tsx       ← add/edit verse + schedule picker
        │   ├── CardGrid.tsx            ← animated card grid
        │   ├── ViewModal.tsx           ← poem viewer + reactions + comments
        │   ├── DeleteModal.tsx         ← confirm delete
        │   ├── ScheduleQueue.tsx       ← admin scheduled verse panel
        │   └── Toast.tsx               ← toast notifications
        ├── hooks/useAuth.tsx           ← auth context + session
        ├── lib/api.ts                  ← typed API client + token refresh
        └── types/index.ts              ← TypeScript interfaces
```

---

## Security

- 🔐 **Service key never reaches the browser** — all Supabase calls go through Laravel on Koyeb
- 🛡️ **JWT verified server-side** on every protected request
- 🚧 **Role middleware** enforces access at the API layer — can't be bypassed from client
- 🔒 **RLS enabled** on all Supabase tables — no direct client DB access
- 🌐 **CORS** locked to your Vercel frontend domain only
- 👤 **Guest reactions** use a client localStorage UUID; authenticated users always use their real Supabase ID

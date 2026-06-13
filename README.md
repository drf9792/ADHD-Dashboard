# My Dashboard

A personal task dashboard with four buckets (Today / This week / Next week / Someday)
and a recruiting pipeline tracker with a contact log. Data is stored in Supabase
(a free cloud database), so it persists reliably across sessions and devices.

This guide assumes you've used GitHub/Vercel before but want a step-by-step refresher.
Total time: roughly 20-30 minutes.

---

## Part 1: Set up the database (Supabase)

1. Go to https://supabase.com and sign in (or create a free account).
2. Click **New project**. Choose any name (e.g. "my-dashboard") and a strong
   database password (save it somewhere, though you won't need it for this app).
   Pick the region closest to you. Click **Create new project** and wait ~1-2
   minutes for it to provision.
3. Once the project is ready, go to the **SQL Editor** (left sidebar).
4. Click **New query**, then open the `supabase_schema.sql` file from this
   project, copy its entire contents, and paste it into the editor.
5. Click **Run**. You should see "Success. No rows returned." This creates two
   tables: `tasks` and `pipeline`.
6. Go to **Project Settings** (gear icon) > **Data API**. You'll need two values
   from this page for the next part:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public** key (a long string under "Project API keys")

Keep this tab open — you'll copy these into Vercel shortly.

---

## Part 2: Put the code on GitHub

1. Go to https://github.com and create a new repository (e.g. `my-dashboard`).
   It can be private. Don't initialize it with a README (we already have one).
2. On your computer, open a terminal in this project folder and run:

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/my-dashboard.git
   git push -u origin main
   ```

   Replace `YOUR_USERNAME` with your GitHub username.

---

## Part 3: Deploy to Vercel

1. Go to https://vercel.com and sign in (you can sign in with your GitHub account).
2. Click **Add New** > **Project**.
3. Find your `my-dashboard` repo in the list and click **Import**.
4. Vercel should auto-detect this as a Vite project. Before deploying, expand
   **Environment Variables** and add two entries:
   - `VITE_SUPABASE_URL` → paste your Supabase Project URL from Part 1
   - `VITE_SUPABASE_ANON_KEY` → paste your Supabase anon public key from Part 1
5. Click **Deploy**. Wait 1-2 minutes.
6. Once it's done, click the preview link — your dashboard is live! You can
   bookmark this URL or add it to your phone's home screen for quick access.

---

## Making changes later

- Any time you want to tweak the design or add features, edit the files and
  push to GitHub (`git add .`, `git commit -m "..."`, `git push`). Vercel will
  automatically redeploy.
- If you ever need to update environment variables, go to your project in
  Vercel > **Settings** > **Environment Variables**, then redeploy.

---

## What's stored where

- `tasks` table: every brain-dump item, which bucket it's in, and whether it's done.
- `pipeline` table: each candidate/role, follow-up date, next action, notes,
  and a JSON log of contact attempts (call/text/email with dates).

Everything saves automatically as you type or click — no save button needed,
and it'll be there next time you open the app from any device.

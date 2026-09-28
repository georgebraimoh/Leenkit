# LEENKIT — Real-Life Hangouts Platform

LEENKIT is a location-first social discovery platform built with React, Vite, Tailwind CSS, Supabase Auth, PostgreSQL, and Supabase Realtime.

## Production Website
- **Canonical Site**: [https://leenkit.netlify.app](https://leenkit.netlify.app)

## Local Development Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   Copy `.env.example` to `.env` and set your public Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

3. **Run Dev Server**:
   ```bash
   npm run dev
   ```

4. **Production Build**:
   ```bash
   npm run build
   ```

## Tech Stack & Architecture
- **Frontend**: React 19, Vite, React Router 7, Tailwind CSS, Framer Motion, Lucide Icons
- **Backend & Database**: Supabase PostgreSQL, Supabase Auth, Supabase Realtime
- **Deployment**: Netlify SPA ([`https://leenkit.netlify.app`](https://leenkit.netlify.app))

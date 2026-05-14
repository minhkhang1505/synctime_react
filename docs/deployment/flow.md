# Deployment Flow

## 1. Purpose
Outline the deployment pipelines for Frontend and Backend.

## 2. Frontend Deployment (Vercel)
- Connect GitHub repository to Vercel.
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables configured in Vercel Dashboard.
- Auto-deploy on push to `main` branch.
- Preview deployments on Pull Requests.

## 3. Backend Deployment (Supabase Cloud)
- Database schema and RLS policies are managed via Supabase CLI migrations.
- `supabase db push` to apply local migrations to the remote production project.
- Auth settings (Google OAuth credentials) configured in Supabase Dashboard.

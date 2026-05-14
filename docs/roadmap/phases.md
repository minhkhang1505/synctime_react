# Development Roadmap

## 1. Purpose
Step-by-step feature planning for building the MVP.

## Phase 1: Foundation & Auth
- Set up React + Vite + Tailwind + TypeScript project.
- Set up Supabase project and database schema via CLI.
- Implement UI Shell (Layout, Bottom Nav for mobile).
- Implement Google OAuth Login.
- Create basic profile page.

## Phase 2: Group Management
- Implement `Create Group` feature.
- Implement `Join Group` via Invite Code.
- Implement Group Dashboard (List of members).
- Implement Row Level Security (RLS) for groups.

## Phase 3: Availability Selection
- Build Calendar Selection UI component.
- Build Time Slot Picker component.
- Implement API to save and retrieve `availability_slots`.
- Ensure mobile-first responsiveness for all selectors.

## Phase 4: Realtime Matching & UI Polish
- Build the "Matching Engine" on the frontend to calculate overlapping free times.
- Implement Supabase Realtime subscriptions to update data instantly.
- Highlight "Best Matching Slots" in the UI.
- Final UI polish (Dark mode, animations, loading states).
- Testing and Deployment to Vercel.

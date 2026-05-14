# Frontend Architecture

## 1. Purpose
Define the React folder structure, state management, and API layers to ensure a clean, scalable, and maintainable codebase.

## 2. Folder Structure
```text
src/
├── assets/          # Static files (images, icons)
├── components/      # Shared/Global components (Buttons, Modals, Layout)
│   ├── ui/          # Generic UI elements
│   └── layout/      # Shell, Navigation
├── features/        # Feature-based modules (Domain logic)
│   ├── auth/        # Auth components, hooks, api
│   ├── groups/      # Group management
│   └── scheduler/   # Calendar, Time slots, Matching logic
├── hooks/           # Global custom hooks
├── lib/             # Third-party setups (Supabase client, axios, etc.)
├── pages/           # Route components (Pages)
├── routes/          # React Router configuration
├── store/           # Global state (Zustand)
├── styles/          # Global CSS, Tailwind config
├── types/           # Global TypeScript definitions
└── utils/           # Helper functions
```

## 3. Feature-Based Architecture
Each feature inside `src/features/` should encapsulate its own concerns:
```text
features/groups/
├── api/             # React Query hooks for fetching/mutating groups
├── components/      # Group-specific UI components
├── types/           # Local types
└── index.ts         # Public API for this feature
```

## 4. State Management Strategy
- **Server State**: `TanStack Query` (React Query) for fetching, caching, and updating asynchronous data from Supabase.
- **Client State (Global)**: `Zustand` for simple UI state (e.g., current selected date, theme toggle, mobile menu state).
- **Client State (Local)**: React `useState` / `useReducer` for component-specific state.

## 5. Error Handling & Environment
- **Error Boundaries**: Wrap key feature sections in React Error Boundaries to prevent full app crashes.
- **API Errors**: Centralized error handling in API interceptors or React Query global callbacks.
- **Environment Variables**:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

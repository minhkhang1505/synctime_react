# Coding Conventions

## 1. Purpose
Define code styling, naming, and architectural conventions for the frontend.

## 2. Naming Conventions
- **Components**: PascalCase (e.g., `TimeSlotPicker.tsx`)
- **Hooks**: camelCase with 'use' prefix (e.g., `useGroupData.ts`)
- **Types/Interfaces**: PascalCase (e.g., `GroupMember`)
- **Files/Folders**: kebab-case for non-components (e.g., `auth-utils.ts`, `features/group-management/`)

## 3. Styling Conventions
- Use Tailwind CSS for all styling.
- Avoid inline styles.
- Use `clsx` or `tailwind-merge` for dynamic class names.
- Extract repeated complex UI patterns into small reusable React components, not `@apply` in CSS.

## 4. Architectural Rules
- Avoid importing directly across different feature modules.
- Components in `src/components/ui` should be purely presentational (no API calls).
- Domain logic and API calls belong in `src/features/`.
- Keep components small and focused.

# Tech Stack

- **Runtime**: React 19 + TypeScript
- **Build**: Vite 6
- **Backend**: AWS Amplify Gen2 (Cognito for auth)
- **Routing**: TanStack Router (file-based routing via Vite plugin)
- **Data fetching**: TanStack Query
- **Forms**: TanStack Form
- **UI**: MUI (Material UI) v6 + Emotion

## Build & Dev Commands

- `npm run dev` — Start Vite dev server (localhost:5173)
- `npm run build` — TypeScript check + Vite production build
- `npm run preview` — Preview production build
- `npm run lint` — ESLint
- `npx ampx sandbox` — Start Amplify cloud sandbox (deploys backend)
- `npx ampx sandbox secret set GOOGLE_CLIENT_ID` — Set Google OAuth client ID secret
- `npx ampx sandbox secret set GOOGLE_CLIENT_SECRET` — Set Google OAuth client secret

## Conventions

- Use file-based routing: add route files under `src/routes/`
- Auth context is available via `Route.useRouteContext()` in any route
- Protect routes using `beforeLoad` with `redirect`
- Amplify secrets (OAuth credentials) are managed via `secret()` helper, never hardcoded
- UI components use MUI; follow MUI `sx` prop pattern for styling

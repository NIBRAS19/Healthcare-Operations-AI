# CareOps AI - Frontend (React + Vite)

React 18 + React Router 6 frontend for the CareOps AI PRD and UI/UX spec. Part of a MERN app: pair it with an Express/Node + MongoDB API.

## Run
```
npm install
cp .env.example .env     # VITE_USE_MOCK=true runs with synthetic demo data, no backend needed
npm run dev              # http://localhost:5173
```
Sign in with any email and password in demo mode.

## Connect to your Express API
1. Set `VITE_USE_MOCK=false`. Vite proxies `/api` to `http://localhost:5000` (see vite.config.js).
2. All calls live in `src/api/client.js`. Expected endpoints: `POST /auth/login`, `POST /auth/logout`, `GET /cases`, `GET /documents`, `GET /tasks`, `GET /audit`, `GET /users`, `GET /integrations`, `GET /workflows`, `GET /cases/:id/summary`, `GET /documents/:id/fields`, `POST /cases`, `POST /cases/bulk-assign`, `POST /cases/:id/summary/approve`, `POST /integrations/:id/pause`.
3. Auth uses an httpOnly session cookie (`credentials: "include"`). A 401 sends the user to /login; a 403 shows a permission-denied state.

## Important
- Role-based hiding in the UI is cosmetic. Enforce RBAC, tenant isolation and audit logging in Express for every route.
- Demo data is synthetic and labelled. Don't load real patient data until the PRD launch gates are met.

## Structure
`src/components/ui.jsx` shared components (status chip, data table, drawer, confirm, AI suggestion panel, toasts, async states) · `src/pages/*` screens · `src/data/mock.js` synthetic data.

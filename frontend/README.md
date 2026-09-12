# Kusama frontend

React + TypeScript + Vite. Run `npm ci` then `npm run dev` from this directory. The app runs at http://127.0.0.1:5173.

`npm run build` typechecks and produces `dist/`. `npm run lint` runs Oxlint.

The Nest backend lives in `../backend` and runs on port 3000. Vite proxies `/api` to it. `/backend-health` proxies the starter's `GET /` response. The backend currently has no group/planner endpoints; the frontend uses clearly labeled demo content while those are built.

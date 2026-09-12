# Agent Plans · Kusama

A group outing planner, with one agent representing each person's preferences.

## Project layout

- `backend/` — the existing NestJS service, moved without source changes.
- `frontend/` — Kusama, the React + TypeScript planning interface.

## Develop

Run the apps in separate terminals:

```sh
cd backend
npm ci
npm run start:dev
```

```sh
cd frontend
npm ci
npm run dev
```

Frontend: http://127.0.0.1:5173. Backend: http://127.0.0.1:3000.

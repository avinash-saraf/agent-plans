# Agent Plans · Kusama

A group outing planner, with one agent representing each person's preferences.

The product brief from the Google Doc's third tab is saved in [context.md](context.md).
The frontend centers on four personal blurbs, an agent transcript, and a linked
itinerary with a named compromise. See [frontend integration notes](frontend/README.md)
for the demo boundary and the response contract.

## Project layout

- `backend/` — the teammate's NestJS service, including PostgreSQL/Prisma and JWT authentication, relocated without source changes.
- `frontend/` — Kusama, the React + TypeScript planning interface.

## Develop

Run the apps in separate terminals:

First follow [backend setup](backend/INTEGRATION.md) to configure PostgreSQL, the auth secret, and migrations.

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

Frontend example: http://127.0.0.1:5173/g/hackathon?demo=1. Backend: http://127.0.0.1:3000.

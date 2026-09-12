# Kusama backend integration

This directory contains the backend from `origin/main` commit `fa0d8ee`
(`auth + db`), relocated from the repository root. Run backend commands from
this directory.

## Local setup

1. Run `npm ci`.
2. If `.env` is absent, copy `.env.example` to `.env`. Set `DATABASE_URL` to
   your PostgreSQL database and set `JWT_SECRET` to a random secret. Preserve
   existing local configuration when the environment is already set up.
3. Run `npm run prisma:generate`.
4. For a database you own, apply the committed migration with `npx prisma migrate deploy`.
   Coordinate migration ownership with the backend teammate for a shared database.
5. Run `npm run start:dev`.

The server listens on port 3000. Prisma uses PostgreSQL and stores a `users`
table. The migration creates that table and its unique email index. Environment
files containing credentials are ignored by Git.

## HTTP contract

Routes have no `/api` prefix. The frontend development proxy may expose them
under `/api`, provided that it strips that prefix before forwarding to port 3000.

| Method | Path | Request | Success |
| --- | --- | --- | --- |
| GET | `/` | None | 200, plain text `Hello World!` |
| POST | `/auth/register` | `{ "name": string, "email": string, "password": string }` | 201, `{ user, accessToken }` |
| POST | `/auth/login` | `{ "email": string, "password": string }` | 200, `{ user, accessToken }` |
| GET | `/auth/me` | `Authorization: Bearer <accessToken>` | 200, profile |

Registration and login return a user with `id`, `name`, `email`, and `createdAt`.
The profile response also includes `updatedAt`. Date fields serialize as ISO
strings. Password hashes are omitted from responses. Access tokens expire after
15 minutes. There is no refresh-token or logout endpoint; clients can discard
their token to sign out and must sign in again after expiry.

Registration requires a name of 2–100 characters, a valid email, and a password
of 8–72 characters. Login requires a valid email and a string password. The
global validation pipe rejects unknown fields. Emails are lowercased before
storage and lookup; submitted values must already satisfy email validation.

Failures use Nest's JSON exception response, including `statusCode`, `message`
(a string or an array of validation messages), and usually `error`:

- 400: Invalid fields or unknown request properties.
- 401: Invalid login, missing/invalid/expired bearer token, or deleted user.
- 409: An account with this email already exists.

The server does not enable browser CORS. Use the development proxy, or serve the
frontend and backend behind the same origin in production.

## Remaining application APIs

This snapshot implements authentication only. The product contract in
[`context.md`](../context.md) calls for slug-based member profiles and a single
planning round. The frontend currently stores profiles locally and renders the
documented six-turn transcript from an explicitly labeled fixture.

The planning HTTP route and request DTO still need to be agreed with the backend
teammate. See the [frontend handoff](../frontend/README.md#planning-handoff).
Optional account actions remain available per the user's later preference.

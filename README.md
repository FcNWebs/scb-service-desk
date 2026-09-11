# SCB Service Desk

Suhum Community Bank incident reporting, ticket management, and employee-to-IT chat portal.

## Local setup

1. Create a PostgreSQL database with a provider such as Supabase, Neon, or a local PostgreSQL installation.
2. Copy `.env.example` to `.env`.
3. Set `DATABASE_URL` in `.env` to the PostgreSQL connection string.
4. Set `DATABASE_SSL=true` when your provider requires SSL, such as Supabase.
5. Install dependencies:

```powershell
npm install
```

6. Start the server:

```powershell
npm start
```

Open `http://localhost:3000`.

The server creates the required tables and seeds the initial accounts on first startup. Do not commit `.env` or database credentials.

## Render deployment

Create a Render Web Service connected to this GitHub repository:

- Build command: `npm install`
- Start command: `node server.js`

Add the `DATABASE_URL` environment variable in Render using the connection string from your PostgreSQL provider. Set `NODE_ENV` to `production`.

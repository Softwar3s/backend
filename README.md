# Built with **Bun**, **Hono**, **Drizzle ORM**, **PostgreSQL**, and **Better Auth**.

## Prerequisites

- [Bun](https://bun.sh) >= 1.2
- PostgreSQL running locally (or a remote DATABASE_URL)

## Setup

```sh
# 1. Install dependencies
bun install

# 2. Configure environment
cp .env.example .env
# Edit .env with your values (DATABASE_URL, BETTER_AUTH_SECRET, etc.)

# 3. Run database migrations
bun run db:migrate

# 4. Start dev server (hot reload)
bun run dev
```

Server runs at `http://localhost:3001` (or the `PORT` you set in `.env`).

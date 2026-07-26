# Lobby Night

A Vercel-ready Steam game night planner built with Next.js, TypeScript, Supabase, and Steam OpenID/Web API.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

The complete UI uses demo data until credentials are configured. Run `supabase/schema.sql` in a new Supabase project, set the variables in `.env.example`, and deploy to Vercel.

Steam returns to `/api/auth/steam/callback`, provisions the verified Steam identity through the server-only Supabase Admin API, and establishes normal refreshable Supabase cookies. Set `SUPABASE_SERVICE_ROLE_KEY` only in local/Vercel server secrets; never prefix or expose it publicly. Sync libraries server-side with `IPlayerService/GetOwnedGames/v1?include_appinfo=true`.

Scheduling should normalize weekly intervals from each member's IANA timezone to UTC, find the full intersection first, then rank partial overlaps by attendance, preference, and duration. Shared games are the `user_games` intersection filtered by `max_players >= member count`. Because Steam does not reliably include player capacity in owned-game data, enrich that field from curated or licensed metadata.

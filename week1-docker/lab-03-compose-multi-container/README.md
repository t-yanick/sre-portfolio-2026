# Lab 03 — Multi-container App with Docker Compose

A Node.js API + Postgres stack orchestrated with `docker-compose.yml`, demonstrating service discovery, healthchecks, dependency ordering, and volume-based data persistence.

## What it demonstrates

- **Multi-service orchestration** — two containers (`api` + `db`) coordinated as a single stack
- **Service discovery via DNS** — the API connects to Postgres by service name `db`, not by IP or localhost
- **Health-gated dependency ordering** — `api` only starts after `db` passes its `pg_isready` healthcheck
- **Named volume persistence** — Postgres data survives `docker compose down` but not `docker compose down -v`
- **Environment-based configuration** — DB credentials injected at runtime, never baked into images
- **Custom Dockerfile + official image mix** — application built from local Dockerfile, database pulled from Docker Hub

## Architecture

localhost:3000
│
▼
┌─────────┐       ┌─────────┐
│   api   │──────▶│   db    │
│ Node 20 │  DNS  │ Postgres│
└─────────┘       └─────────┘
│
▼
[db-data volume]

## Run it

```bash
docker compose up -d --build
curl http://localhost:3000
```

You should see a JSON response with `total_visits` that increments on each request.

## Test persistence

```bash
docker compose down        # stops containers, KEEPS the volume
docker compose up -d
curl http://localhost:3000  # total_visits continues from previous count

docker compose down -v     # stops containers AND removes the volume
docker compose up -d --build
curl http://localhost:3000  # total_visits resets to 1
```

## Files in this lab

- `docker-compose.yml` — the orchestration definition
- `app/Dockerfile` — Node.js API container build
- `app/server.js` — minimal Express API with Postgres connection
- `app/package.json` — dependencies

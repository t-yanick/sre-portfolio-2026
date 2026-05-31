# Lab 02 — Containerize a Production Next.js App

Containerized my deployed Gemma 4 immigration assistant (live at gemma-canada-assistant.vercel.app) using a multi-stage Dockerfile with Next.js standalone output mode.

## The optimization story

| Version | Image Size | Approach |
|---------|------------|----------|
| `:1.0` | 1.37 GB | Multi-stage build, `npm ci --omit=dev`, copy full `node_modules` + full `.next` |
| `:1.1` | 269 MB | Multi-stage build with Next.js standalone output — copy only `.next/standalone` + `.next/static` |

**80% reduction. 5x smaller.**

## Why standalone mode wins

`npm ci --omit=dev` produced a 493 MB `node_modules` because Next.js packaging treats several runtime helpers as devDependencies. Standalone mode uses Next.js's tracer to identify what the compiled app *actually* needs at runtime — typically ~10 directories, ~18 MB — and bundles only that.

The full `.next` directory is also 326 MB because it contains build caches, source maps, and intermediate compiler artifacts. Standalone strips that down to just the runtime artifacts (~18 MB).

## What this demonstrates

- **Multi-stage Docker builds** — separated build environment from runtime
- **Image size optimization** — applied the industry-standard Next.js standalone pattern
- **Layer analysis** — used `docker history` to diagnose where bytes lived before applying the fix
- **Security best practice** — runs as non-root user (nextjs:nodejs, uid 1001)
- **Secret management** — API keys passed at runtime via `-e` flags, never baked into the image
- **`.dockerignore` discipline** — explicitly excludes `.env*.local`, `node_modules`, `.git`, build artifacts
- **`HOSTNAME=0.0.0.0`** — required for Next.js standalone to bind on all interfaces inside a container

## Image on Docker Hub

`docker pull tyanick237/gemma-canada-assistant:1.1`

## Run it

```bash
docker run -d \
  -p 3001:3000 \
  -e OPENROUTER_API_KEY="your_key_here" \
  -e GOOGLE_AI_STUDIO_KEY="your_key_here" \
  --name gemma-app \
  tyanick237/gemma-canada-assistant:1.1
```

Then open http://localhost:3001.

## Files in this lab

- `Dockerfile` — multi-stage build using Next.js standalone output
- `.dockerignore` — excludes secrets, node_modules, build artifacts
- `README.md` — this file

# Lab 01 — Hello Node Containerization

First Docker lab. Containerizes a minimal Node.js HTTP server.

## What it demonstrates

- Writing a Dockerfile from scratch
- Building an image with `docker build`
- Running a container with port mapping
- Inspecting a running container with `docker logs`, `inspect`, `exec`
- Pushing the image to Docker Hub

## Image on Docker Hub

`docker pull YOUR_DOCKERHUB_USERNAME/hello-node:1.0`

## Run it

```bash
docker run -d -p 3000:3000 --name hello-node YOUR_DOCKERHUB_USERNAME/hello-node:1.0
curl http://localhost:3000
```

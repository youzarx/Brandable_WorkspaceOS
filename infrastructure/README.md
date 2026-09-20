# Infrastructure

This directory is reserved for infrastructure-as-code configuration.

**Day 1 Status:** Empty. Docker Compose for local development lives in the root `docker-compose.yml`.

## Planned Contents (Future)

```
infrastructure/
  terraform/        # Cloud infrastructure provisioning (AWS, GCP, etc.)
  kubernetes/       # K8s manifests for production deployment
  helm/             # Helm charts
  scripts/          # Deployment and operational scripts
```

## Local Development

Local infrastructure (PostgreSQL + Redis) is managed via Docker Compose in the project root:

```bash
docker compose up -d    # Start PostgreSQL + Redis
docker compose down     # Stop containers
docker compose ps       # Check status
```

See the root `README.md` for full setup instructions.

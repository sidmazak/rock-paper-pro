# Coolify Auto Deploy Guide (GitHub Actions + GHCR)

This guide explains the full setup used in this project so every push to `main` automatically:

1. builds a Docker image in GitHub Actions,
2. pushes it to GHCR,
3. triggers a deployment in Coolify.

---

## 1) Prerequisites

- GitHub repository: `sidmazak/rock-paper-pro`
- Coolify app already created
- App is configured to deploy from a Docker image
- Dockerfile and workflow files committed to your repo

---

## 2) Required Files in This Repo

### `Dockerfile`

The Docker image definition in project root.  
This repo already has it at:

- `Dockerfile`

### GitHub Actions workflow

The CI/CD workflow file is:

- `.github/workflows/docker-build-push.yml`

It runs on pushes to `main`.

---

## 3) GitHub Secrets (Required)

Go to:

- GitHub repo -> `Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`

Create these secrets:

1. `COOLIFY_DEPLOY_WEBHOOK`
   - Value: the **Deploy Webhook (auth required)** URL from your Coolify app.
2. `COOLIFY_API_TOKEN`
   - Value: your Coolify API token.

> Important: put only the secret name in the **Name** field, and the real URL/token in the **Secret** field.

---

## 4) Coolify App Configuration

In Coolify, open your app and set:

- Source type: **Docker Image**
- Image: `ghcr.io/sidmazak/rock-paper-pro:latest`
- Port: `3000`

If your GHCR package is private, configure registry credentials in Coolify:

- Registry: `ghcr.io`
- Username: your GitHub username
- Password: GitHub PAT with `read:packages`

---

## 5) How the Workflow Works

Current workflow (`.github/workflows/docker-build-push.yml`) does:

1. Checkout code
2. Set up Buildx
3. Login to GHCR with `${{ secrets.GITHUB_TOKEN }}`
4. Build Docker image
5. Push tags:
   - `ghcr.io/sidmazak/rock-paper-pro:latest`
   - `ghcr.io/sidmazak/rock-paper-pro:sha-<commit>`
6. Trigger Coolify deploy webhook using:
   - `COOLIFY_DEPLOY_WEBHOOK`
   - `Authorization: Bearer $COOLIFY_API_TOKEN`

---

## 6) First Deployment Test

1. Commit and push to `main`.
2. Open GitHub -> `Actions` -> latest run.
3. Confirm these steps pass:
   - `Build and push image`
   - `Trigger Coolify deploy`
4. Open Coolify -> app -> Deployments/Logs.
5. Confirm a new deployment started and became healthy.

---

## 7) Troubleshooting

### Error: `401` in webhook step

Cause: webhook auth failed.

Check:

- `COOLIFY_API_TOKEN` secret exists and is correct
- `COOLIFY_DEPLOY_WEBHOOK` is the **auth required deploy** URL
- no extra spaces/newlines in secret values

### Error: Docker build fails with `/app/public: not found`

Cause: `public` folder is not present in repo.

Fix used in this project:

- removed `COPY --from=builder /app/public ./public` from `Dockerfile`

### Coolify not pulling new image

Check:

- image is `ghcr.io/sidmazak/rock-paper-pro:latest`
- GHCR credentials configured (if package private)
- webhook step succeeded in GitHub Actions logs

---

## 8) Daily Usage

For normal use, just:

1. push code to `main`,
2. wait for GitHub Actions to finish,
3. Coolify auto-deploys the new image.

No manual rebuild on server required.


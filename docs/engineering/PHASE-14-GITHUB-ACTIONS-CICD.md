# Phase 14 — GitHub Actions CI/CD

## Scope

Phase 14 establishes the repository's GitHub Actions CI/CD foundation. It validates pull requests and main, builds the production Docker images, and publishes immutable container artifacts to GitHub Container Registry (GHCR).

It does not introduce AWS, Kubernetes, Terraform, Kafka, staging infrastructure, or production deployment automation.

## Current workflow

### CI

.github/workflows/ci.yml runs for:

- pull requests targeting main
- pushes to main

The workflow exposes four branch-protection-friendly jobs:

- backend-validation
- frontend-validation
- security
- docker-validation

Backend validation uses disposable GitHub Actions service containers for PostgreSQL 16.10 and Redis 7.4.11. It installs dependencies with npm ci, runs typechecking, the authoritative backend regression suite, coverage, and the production TypeScript build.

Frontend validation installs dependencies with npm ci, then runs lint, typecheck, Vitest, and the production Vite build.

The security job runs npm audit --audit-level=high independently against both lockfiles, stores the JSON reports as workflow artifacts, and emits a warning when vulnerabilities are found. The audit is intentionally advisory in Phase 14 because the repository enters this phase with known dependency security debt from the earlier security work; making the status check permanently red would obscure the distinction between CI health and an already-known remediation backlog. The vulnerabilities remain visible in every run and are not suppressed.

Docker validation checks Compose interpolation and builds the actual production target for both application images. It does not publish images for pull requests.

## Node and dependency determinism

The repository's current Dockerfiles use Node.js 24.15.0, so CI uses the same Node version.

Both applications have their own npm lockfile. CI uses npm ci and setup-node's npm cache keyed from the relevant lockfile. The cache stores npm's package cache, not node_modules, so a cache miss never changes correctness.

## Security model

CI workflows request read-only repository contents by default. Only the image-publishing job requests packages: write, which is required for GHCR publication.

No application, database, Redis, cloud, or registry credentials are stored in the repository. CI uses disposable test credentials defined directly in the backend validation job because they have no access to external infrastructure.

The workflows use pull_request, not pull_request_target. Pull-request jobs do not consume repository secrets. GitHub does not expose normal repository secrets to fork-originated pull requests.

Frontend VITE_* values are treated as public build-time configuration. The CI/CD workflows therefore pass non-secret placeholder backend URLs to the Vite production build.

## Concurrency

CI cancels superseded runs for the same ref. This saves runner capacity and avoids reporting stale validation for an older commit.

The CD workflow intentionally does not cancel in-progress runs. Published production artifacts must not be interrupted simply because another commit reached main.

## Container artifact strategy

GHCR is used because the source repository and CI system are already GitHub-based, so no additional registry credential or third-party CI service is required.

Two production images are published:

ghcr.io/<owner>/mern-chat-app-backend
ghcr.io/<owner>/mern-chat-app-frontend

Every main commit gets an immutable commit-SHA tag:

:<full-git-commit-sha>

A mutable :main convenience tag is also maintained. Deployment tooling must use the commit-SHA tag (or the registry digest), not :main, as the deployment identity.

The workflow uses the repository's existing production Docker targets. No application behavior is changed by publishing the images.

## CD boundary

The repository currently has source-based deployment configuration for Render/Vercel. Phase 14 does not replace or pretend to replace that deployment infrastructure.

The new CD workflow ends at:

main commit
  ↓
production Docker build
  ↓
GHCR publication
  ↓
immutable image tag

Actual cloud deployment and promotion remain outside this phase and belong to the later cloud/deployment phase unless an independently verified deployment integration is added.

## Environment separation

### CI

Uses disposable PostgreSQL/Redis containers and synthetic credentials.

### Staging

No staging infrastructure is currently implemented by this repository. Future staging credentials should be stored in a GitHub Environment or the deployment platform's secret store.

### Production

Production secrets must remain in the deployment platform or a protected GitHub Environment. They must never be copied into workflow YAML, Dockerfiles, frontend VITE_* variables, or committed .env files.

## Failure behavior

- npm ci failure fails the relevant job.
- Typecheck/test/build failure fails the relevant validation job.
- Migration failure fails backend integration tests because the test database is prepared through the repository's migration path.
- Docker build failure fails docker-validation.
- GHCR authentication/publication failure fails publish-images.
- A missing future deployment secret should fail the future deployment job rather than silently falling back to an unsafe value.
- CI can cancel stale validation; CD cannot cancel an in-progress artifact publication.
- No production deployment is performed by Phase 14, so there is no partially executed production deployment to roll back.

## Rollback model

The deployable unit is a production Docker image identified by the source commit SHA.

For example:

running: <sha-A>
new:     <sha-B>
rollback: redeploy <sha-A>

The repository does not automate that redeployment yet because the target cloud runtime is not part of Phase 14.

## Branch protection

The four CI job names are intentionally stable and suitable for required status checks. Actual GitHub branch protection/ruleset configuration is not claimed as part of this repository change.

A protected main branch should require the validation jobs before merge once the repository owner configures the corresponding rules.

## Local verification

The exact commands used for Phase 14 verification are recorded in the final phase report/PR rather than this document. The CI workflow is the authoritative automation contract; local verification should use the same underlying npm and Docker commands.

## Deliberate deferrals

- staging deployment
- smoke tests against deployed staging
- production deployment
- AWS/ECR/ECS/EKS
- Kubernetes
- Terraform
- automated cloud rollback
- Kafka/event-driven architecture (Phase 15)

These are not missing pieces of the Phase 14 CI foundation; they are later-phase responsibilities.

# ADR 004: GitHub Actions CI/CD and container artifacts

## Status

Accepted

## Context

The repository has separate backend and frontend npm lockfiles, a real PostgreSQL/Redis integration test suite, and production Docker targets established in Phase 13. There was no automated CI/CD workflow.

The immediate problem is to make pull-request validation deterministic and to produce a traceable container artifact after changes reach main, without prematurely coupling the project to AWS or Kubernetes.

## Decision

Use GitHub Actions for CI and the initial CD artifact pipeline.

CI runs on pull requests to main and pushes to main. It validates:

1. backend dependency installation, typecheck, regression tests, coverage, and build;
2. frontend dependency installation, lint, typecheck, tests, and build;
3. npm dependency security reporting with npm audit --audit-level=high;
4. Docker Compose interpolation and production-target Docker builds.

Backend integration tests use GitHub Actions service containers for PostgreSQL and Redis rather than developer infrastructure.

Use setup-node's npm cache keyed by each application's lockfile. Do not cache node_modules.

After a successful push to main, publish the existing production Docker targets to GHCR. Tag each image with the full source commit SHA and also maintain a mutable :main convenience tag.

The commit-SHA tag is the deployment identity. A future deployment system may promote that immutable artifact through staging and production.

## Alternatives considered

### Keep only local verification

Rejected because pull requests would have no reproducible server-side quality gate.

### Add a third-party CI platform

Rejected because GitHub Actions is already integrated with the repository and provides the required execution, permissions, caching, and package-registry integration without another service.

### Publish directly to a cloud runtime

Deferred. AWS/Kubernetes/cloud deployment infrastructure is a later phase. Publishing a verified immutable container artifact establishes the correct boundary without inventing infrastructure.

### Use :latest as the deployment identity

Rejected. A mutable tag does not uniquely identify the source commit. :main is retained only as a convenience pointer.

### Cache node_modules

Rejected. Caching npm's package cache is sufficient and avoids making restored dependency directories a correctness dependency.

## Security considerations

The default workflow token permission is read-only for repository contents. Only the GHCR publishing job receives packages: write.

CI uses pull_request, not pull_request_target, and no pull-request job consumes repository secrets. Test credentials are disposable and scoped to the local service containers.

Frontend Vite variables are treated as public build-time configuration; no secret is passed through VITE_*.

## Failure and recovery

Code quality, tests, builds, and Docker validation block their jobs. The dependency audit is advisory in Phase 14 because the current lockfiles contain known high/critical vulnerabilities; the workflow preserves the full JSON report and emits a warning instead of turning the repository's status permanently red while remediation belongs to the security backlog.

A failed image publication does not leave a claimed deployment state because no production deployment occurs in this phase.

A future deployment can roll back by selecting the previous successful commit-SHA image or registry digest.

## Consequences

Positive:

- reproducible PR validation
- real PostgreSQL/Redis integration testing in CI
- production Docker build validation
- traceable container artifacts
- minimal GitHub token permissions
- clear boundary for later cloud deployment

Costs:

- CI consumes runner minutes
- backend integration tests require service containers
- GHCR becomes an additional artifact store
- known dependency vulnerabilities remain visible and require deliberate remediation

## Follow-up

Phase 20 may consume the immutable GHCR images from this pipeline when the cloud runtime and deployment strategy are implemented and verified.

# Repository workflow

Develop locally on a `codex/<topic>` branch created from `main`. Keep all work
local until it has been reviewed. Publish reviewed changes to remote `main`.

- Read `CONTRIBUTING.md` and run the repository-local setup after cloning.
- Make focused commits on the work branch; never commit directly on `main`.
- Review the complete diff and run checks appropriate to the change. Resolve
  review findings before approving the exact commit SHA. Approval is an explicit
  attestation of completed review; do not record it just to bypass a failed push.
- New commits require fresh review and approval. Integrating remote changes also
  requires another review of the resulting commit.
- Use the publish command to fast-forward local `main` and push it to `origin`.
  Do not bypass hooks, force-push, or rewrite published history.
- The initial repository setup commit is the sole bootstrap exception to the
  direct-commit rule; review and validate it before its first push.

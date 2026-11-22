# Local development and review

The remote is `https://github.com/hoangv77/hoang_library.git`. Develop on local
branches, review changes locally, then fast-forward and push `main`.

Run these commands in PowerShell from the repo root. After cloning, install the
repository-local settings and hooks once:

```powershell
.\tools\git-workflow.ps1 setup
```

Create a branch, edit files, and make focused commits:

```powershell
.\tools\git-workflow.ps1 start -Topic describe-the-change
git add <files>
git commit -m "Describe the change"
```

Review the complete committed diff against `main`, run relevant checks, and
resolve any findings. This empty starter repo has no application test suite yet;
add and document the appropriate checks as application code is introduced.

To validate the Git workflow itself, run `powershell -NoProfile -ExecutionPolicy
Bypass -File .\tests\git-workflow.ps1`. It tests the hooks and publishing process
against disposable local repositories without contacting GitHub.

```powershell
.\tools\git-workflow.ps1 review
```

After completing the review, record approval using the full SHA printed by the
review command, then publish:

```powershell
.\tools\git-workflow.ps1 approve -Commit <full-reviewed-commit-SHA>
.\tools\git-workflow.ps1 publish
```

Approval records the exact commit in the local `refs/reviews/approved` ref.
Reviewers may be a person or a coding agent, but must inspect the diff and run
relevant checks before recording approval. Every subsequent commit needs a new
review. The review command displays changes; it does not perform a code review
or run application tests automatically.

Publishing fetches `origin`, checks that the approved commit contains both local
and remote `main`, fast-forwards local `main`, then pushes it. If remote changes
need integration, merge or rebase `origin/main` into the work branch, resolve any
conflicts, and repeat validation and review. The work branch remains available
locally after publishing. Start a new branch for the next change.

The hooks block direct commits on `main`, commits with whitespace errors, pushes
with uncommitted changes, unapproved commits, non-fast-forward updates, and
pushes to branches other than `main`. Local hooks are workflow guardrails and
can be bypassed; they are not server-side access controls. Hook settings and
review approvals are local to each clone and are not pushed.

If PowerShell blocks script execution, use an allowed PowerShell installation
with a process-scoped execution policy, for example:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\git-workflow.ps1 setup
```

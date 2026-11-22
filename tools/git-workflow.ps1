[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('setup', 'start', 'review', 'approve', 'publish')]
    [string]$Action,
    [string]$Topic,
    [string]$Commit
)

$ErrorActionPreference = 'Stop'

function Invoke-Git {
    & git @args
    if ($LASTEXITCODE -ne 0) {
        throw "Git failed: git $($args -join ' ')"
    }
}

function Assert-Clean {
    $changes = @(Invoke-Git status --porcelain)
    if ($changes.Count -gt 0) {
        throw 'Commit or stash all local changes before continuing.'
    }
}

function Assert-Ancestor([string]$Base, [string]$Tip) {
    & git merge-base --is-ancestor $Base $Tip
    if ($LASTEXITCODE -ne 0) {
        throw "Integrate $Base into your work branch, then repeat checks and review."
    }
}

$repoRoot = Invoke-Git rev-parse --show-toplevel
Push-Location -LiteralPath $repoRoot
try {
    switch ($Action) {
        'setup' {
            Invoke-Git config --local core.hooksPath .githooks
            Invoke-Git config --local core.autocrlf false
            Invoke-Git config --local pull.ff only
            Invoke-Git config --local pull.rebase false
            Invoke-Git config --local fetch.prune true
            Invoke-Git config --local push.default simple
            Invoke-Git config --local push.followTags false
            Invoke-Git config --local branch.main.pushRemote origin
            Write-Output 'Local Git settings and hooks installed.'
        }
        'start' {
            Assert-Clean
            if ([string]::IsNullOrWhiteSpace($Topic)) { throw 'Supply -Topic <short-topic>.' }
            $branch = "codex/$Topic"
            Invoke-Git check-ref-format --branch $branch
            Invoke-Git switch -c $branch main
        }
        'review' {
            Assert-Clean
            Invoke-Git log --oneline main..HEAD
            Invoke-Git diff --check main...HEAD
            Invoke-Git --no-pager diff --stat main...HEAD
            Invoke-Git --no-pager diff main...HEAD
            $headCommit = Invoke-Git rev-parse HEAD
            Write-Output "Review commit: $headCommit"
            Write-Output 'Inspect the full diff and run relevant checks before recording approval.'
        }
        'approve' {
            Assert-Clean
            $headCommit = Invoke-Git rev-parse HEAD
            if ($Commit -cne $headCommit) {
                throw 'Supply -Commit with the full SHA of the current commit you reviewed.'
            }
            Invoke-Git update-ref refs/reviews/approved $headCommit
            Write-Output "Recorded review approval for $headCommit."
        }
        'publish' {
            Assert-Clean
            $headCommit = Invoke-Git rev-parse HEAD
            $approvedCommit = & git rev-parse --verify --quiet refs/reviews/approved
            if ($LASTEXITCODE -ne 0 -or $headCommit -ne $approvedCommit) {
                throw 'Review and approve this exact commit first.'
            }
            Invoke-Git fetch origin --prune
            & git show-ref --verify --quiet refs/remotes/origin/main
            $remoteMainStatus = $LASTEXITCODE
            if ($remoteMainStatus -eq 0) {
                Assert-Ancestor refs/remotes/origin/main $headCommit
            } elseif ($remoteMainStatus -ne 1) {
                throw 'Unable to inspect origin/main.'
            }
            Assert-Ancestor main $headCommit
            Invoke-Git switch main
            Invoke-Git merge --ff-only $headCommit
            Invoke-Git push --set-upstream origin main
        }
    }
} finally {
    Pop-Location
}

# Integration checks use disposable local repositories; GitHub is never contacted.
$ErrorActionPreference = 'Stop'
$sourceRoot = Split-Path -Parent $PSScriptRoot
$engine = (Get-Process -Id $PID).Path
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('hoang-git-test-' + [guid]::NewGuid())
$repo = Join-Path $testRoot 'work'
$remote = Join-Path $testRoot 'remote.git'
$other = Join-Path $testRoot 'other'
$script:checks = 0

function Check-Git {
    param([bool]$Success, [string[]]$GitArgs)
    & git @GitArgs | Out-Host
    $passed = $LASTEXITCODE -eq 0
    if ($passed -ne $Success) { throw "Unexpected Git result: $($GitArgs -join ' ')" }
    $script:checks++
}

function Check-Workflow {
    param([bool]$Success, [string[]]$WorkflowArgs)
    & $engine -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'tools/git-workflow.ps1') @WorkflowArgs | Out-Host
    $passed = $LASTEXITCODE -eq 0
    if ($passed -ne $Success) { throw "Unexpected workflow result: $($WorkflowArgs -join ' ')" }
    $script:checks++
}

New-Item -ItemType Directory -Path $repo -Force | Out-Null
Push-Location -LiteralPath $repo
try {
    Check-Git $true @('init', '-b', 'main')
    Check-Git $true @('config', 'user.name', 'Workflow Test')
    Check-Git $true @('config', 'user.email', 'workflow@example.invalid')
    Check-Git $true @('config', 'commit.gpgsign', 'false')
    foreach ($path in @('.githooks', 'tools', '.gitattributes')) {
        Copy-Item -LiteralPath (Join-Path $sourceRoot $path) -Destination $repo -Recurse
    }
    Check-Git $true @('add', '.')
    Check-Git $true @('commit', '-m', 'Bootstrap test repository')
    Check-Git $true @('init', '--bare', '-b', 'main', $remote)
    Check-Git $true @('remote', 'add', 'origin', $remote)
    Check-Workflow $true @('setup')
    Check-Git $false @('commit', '--allow-empty', '-m', 'Blocked direct commit')
    Check-Workflow $true @('start', '-Topic', 'integration-check')
    Set-Content -LiteralPath 'sample.txt' -Value 'Trailing whitespace '
    Check-Git $true @('add', 'sample.txt')
    Check-Git $false @('commit', '-m', 'Blocked whitespace error')
    Set-Content -LiteralPath 'sample.txt' -Value 'First change'
    Check-Git $true @('add', 'sample.txt')
    Check-Git $true @('commit', '-m', 'Add sample')
    Check-Workflow $true @('review')
    Check-Workflow $false @('approve', '-Commit', 'wrong-sha')
    Check-Workflow $false @('publish')
    $first = git rev-parse HEAD
    Set-Content -LiteralPath 'untracked.txt' -Value 'Dirty worktree'
    Check-Workflow $false @('approve', '-Commit', $first)
    Remove-Item -LiteralPath 'untracked.txt'
    Check-Git $true @('switch', 'main')
    Check-Git $true @('merge', '--ff-only', $first)
    Check-Git $false @('push', 'origin', 'main')
    Check-Git $true @('switch', 'codex/integration-check')
    Check-Workflow $true @('approve', '-Commit', $first)
    Set-Content -LiteralPath 'untracked.txt' -Value 'Dirty worktree'
    Check-Git $false @('push', 'origin', 'main')
    Remove-Item -LiteralPath 'untracked.txt'
    Check-Git $false @('push', 'origin', 'HEAD:refs/heads/topic')
    Check-Workflow $true @('publish')
    $published = git --git-dir=$remote rev-parse main
    if ($published -ne $first) { throw 'Published commit did not match reviewed commit.' }

    Check-Git $true @('switch', 'codex/integration-check')
    Set-Content -LiteralPath 'sample.txt' -Value 'Second change'
    Check-Git $true @('add', 'sample.txt')
    Check-Git $true @('commit', '-m', 'Update sample')
    Check-Workflow $false @('publish')
    $second = git rev-parse HEAD
    Check-Workflow $true @('approve', '-Commit', $second)

    Check-Git $true @('clone', $remote, $other)
    Check-Git $true @('-C', $other, 'config', 'user.name', 'Other Reviewer')
    Check-Git $true @('-C', $other, 'config', 'user.email', 'other@example.invalid')
    Check-Git $true @('-C', $other, 'config', 'commit.gpgsign', 'false')
    Set-Content -LiteralPath (Join-Path $other 'remote-change.txt') -Value 'Concurrent remote change'
    Check-Git $true @('-C', $other, 'add', '.')
    Check-Git $true @('-C', $other, 'commit', '-m', 'Advance remote main')
    Check-Git $true @('-C', $other, 'push', 'origin', 'main')
    Check-Workflow $false @('publish')
    Check-Git $true @('switch', 'main')
    Check-Workflow $true @('approve', '-Commit', $first)
    Check-Git $false @('push', '--force', 'origin', 'main')
    Check-Git $true @('switch', 'codex/integration-check')
    Check-Git $true @('merge', '--no-edit', 'origin/main')
    Check-Workflow $false @('publish')
    $merged = git rev-parse HEAD
    Check-Workflow $true @('approve', '-Commit', $merged)
    Check-Workflow $true @('publish')
    $published = git --git-dir=$remote rev-parse main
    if ($published -ne $merged) { throw 'Merged commit was not published.' }
    Write-Output "Passed $script:checks integration checks."
} finally {
    Pop-Location
    # Validate the generated absolute path before removing the disposable tree.
    $tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    $resolvedTest = [IO.Path]::GetFullPath($testRoot)
    if ($resolvedTest.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase) -and
        (Split-Path -Leaf $resolvedTest) -like 'hoang-git-test-*') {
        Remove-Item -LiteralPath $resolvedTest -Recurse -Force
    }
}

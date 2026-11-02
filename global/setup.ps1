param([switch]$Help)

$ErrorActionPreference = "Stop"
$GroundworkHome = if ($env:GROUNDWORK_HOME) { $env:GROUNDWORK_HOME } else { Join-Path $HOME ".groundwork" }

$Usage = @"
setup.ps1 - give every coding agent on this Windows machine our stack rule and the our-stack skill.

    gh auth login
    gh repo clone thealexsan/agent-groundwork `$HOME\.groundwork
    powershell -ExecutionPolicy Bypass -File `$HOME\.groundwork\global\setup.ps1

Needs git, node and gh. Clones groundwork into ~\.groundwork (GROUNDWORK_HOME to change it),
lets git and Go reach the owner's private repositories, then writes the rule into every agent it finds,
shares the skill, links every ~\.claude_account*, and registers the session-start hook that
keeps all of it current. Safe to run again; run it after installing a new agent.
"@

function Invoke-Step([string]$What, [scriptblock]$Step) {
    & $Step
    if ($LASTEXITCODE -ne 0) {
        [Console]::Error.WriteLine("$What failed (exit $LASTEXITCODE)")
        exit 1
    }
}

if ($Help) {
    Write-Output $Usage
    exit 0
}

$missing = @("git", "node", "gh") | Where-Object { -not (Get-Command $_ -ErrorAction SilentlyContinue) }
if ($missing) {
    [Console]::Error.WriteLine("Install these first: $($missing -join ' ')")
    exit 1
}

gh auth status *> $null
if ($LASTEXITCODE -ne 0) { Invoke-Step "gh auth login" { gh auth login } }
Invoke-Step "gh auth setup-git" { gh auth setup-git }

if (Test-Path (Join-Path $GroundworkHome ".git")) {
    Invoke-Step "git pull" { git -C $GroundworkHome pull --ff-only -q }
} else {
    Invoke-Step "gh repo clone" { gh repo clone thealexsan/agent-groundwork $GroundworkHome -- -q }
}

if (Get-Command go -ErrorAction SilentlyContinue) {
    Invoke-Step "go env" { $owner = if ($env:GROUNDWORK_OWNER) { $env:GROUNDWORK_OWNER } else { gh api user --jq .login }; go env -w "GOPRIVATE=github.com/$owner/*" }
}

New-Item -ItemType Directory -Force -Path (Join-Path $HOME ".claude") | Out-Null
Invoke-Step "the sync" { node (Join-Path $GroundworkHome "global/sync.mjs") }

Write-Output ""
Write-Output "Done. Restart open agent chats so they read the new rules."

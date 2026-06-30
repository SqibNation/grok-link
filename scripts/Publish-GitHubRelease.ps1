# Create GitHub repo (if needed), push, and publish v0.3.0 release with assets.
param(
    [string]$Repo = "",
    [string]$Tag = "",
    [switch]$Private,
    [switch]$SkipPackage
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$gh = Get-Command gh -ErrorAction SilentlyContinue
if (-not $gh) {
    $ghPath = "$env:ProgramFiles\GitHub CLI\gh.exe"
    if (Test-Path $ghPath) { $gh = Get-Item $ghPath }
}
if (-not $gh) {
    Write-Error "GitHub CLI (gh) not found. Install: winget install GitHub.cli"
}

$ver = Get-Content (Join-Path $root "version.json") -Raw | ConvertFrom-Json
$version = if ($Tag) { $Tag.TrimStart('v') } else { "{0}.{1}.{2}" -f $ver.major, $ver.minor, $ver.iteration }
$tagName = "v$version"
$releaseName = "Grok-Link-$version-win64"

& $gh auth status 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) {
    Write-Host "Run: gh auth login" -ForegroundColor Yellow
    exit 1
}

if (-not $SkipPackage) {
    & (Join-Path $PSScriptRoot "Package-Release.ps1")
}

$zip = Join-Path $root "dist\release\$releaseName.zip"
$zipSha = "$zip.sha256"
$notes = Join-Path $root "RELEASE_NOTES_v$version.md"
if (-not (Test-Path $zip)) { Write-Error "Missing release zip: $zip" }
if (-not (Test-Path $notes)) { Write-Error "Missing release notes: $notes" }

if (-not $Repo) {
    $remote = git remote get-url origin 2>$null
    if ($remote -match 'github\.com[:/](.+?)(?:\.git)?$') {
        $Repo = $Matches[1]
    }
}
if (-not $Repo) {
    $user = (& $gh api user -q .login 2>$null)
    if (-not $user) { Write-Error "Could not detect GitHub user. Pass -Repo owner/grok-link" }
    $Repo = "$user/grok-link"
    Write-Host "Using repo: $Repo" -ForegroundColor Cyan
    $exists = & $gh repo view $Repo 2>$null
    if ($LASTEXITCODE -ne 0) {
        $createArgs = @("repo", "create", $Repo, "--source=.", "--remote=origin", "--push")
        if ($Private) { $createArgs += "--private" } else { $createArgs += "--public" }
        & $gh @createArgs
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    } else {
        git remote get-url origin 2>$null
        if ($LASTEXITCODE -ne 0) {
            git remote add origin "https://github.com/$Repo.git"
        }
        git push -u origin master
    }
} else {
    git remote get-url origin 2>$null
    if ($LASTEXITCODE -ne 0) {
        git remote add origin "https://github.com/$Repo.git"
    }
    git push -u origin master
}

$releaseExists = & $gh release view $tagName --repo $Repo 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Release $tagName exists; uploading assets..." -ForegroundColor Yellow
    & $gh release upload $tagName $zip $zipSha --repo $Repo --clobber
} else {
    & $gh release create $tagName `
        --repo $Repo `
        --title "Grok Link $tagName" `
        --notes-file $notes `
        $zip $zipSha
}

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Published: https://github.com/$Repo/releases/tag/$tagName" -ForegroundColor Green
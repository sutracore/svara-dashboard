[CmdletBinding()]
param(
    [string]$SourcePath = (Join-Path $PSScriptRoot '..\..'),
    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'
$sourceRoot = (Resolve-Path -LiteralPath $SourcePath).Path.TrimEnd('\', '/')
if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot 'package.json') -PathType Leaf) -or
    -not (Test-Path -LiteralPath (Join-Path $sourceRoot 'app') -PathType Container)) {
    throw 'SourcePath must be the Svara application root containing package.json and app.'
}

if (-not $OutputPath) {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $OutputPath = Join-Path (Split-Path $sourceRoot -Parent) "svara-app-final-release-$stamp.zip"
}
$archivePath = [System.IO.Path]::GetFullPath($OutputPath)
if ([System.IO.Path]::GetExtension($archivePath) -ne '.zip') { throw 'OutputPath must end in .zip.' }
if (Test-Path -LiteralPath $archivePath) { throw "Refusing to overwrite existing file: $archivePath" }
if (-not (Test-Path -LiteralPath (Split-Path $archivePath -Parent) -PathType Container)) {
    throw 'Create the destination directory before running this script.'
}

$folders = @('app', 'components', 'emails', 'hooks', 'lib', 'public', 'scripts', 'drizzle', 'docs')
$rootFiles = @(
    'package.json', 'bun.lock', 'README.md', '.gitignore', 'auth-schema.ts',
    'biome.json', 'components.json', 'docker-compose.yml', 'drizzle.config.ts',
    'next.config.ts', 'next-env.d.ts', 'postcss.config.mjs', 'tsconfig.json'
)

function Test-DeliverablePath([string]$RelativePath) {
    $normalized = $RelativePath.Replace('\', '/')
    if ($normalized -match '(^|/)(node_modules|\.git|\.next|\.vercel|\.idea|\.vscode|\.openai|\.cache|coverage|dist|build|out|reference-code|__pycache__)(/|$)') { return $false }
    $leaf = [System.IO.Path]::GetFileName($RelativePath)
    if ($leaf -like '.env*' -and $normalized -ne 'docs/config/.env.example') { return $false }
    if ($leaf -match '(?i)\.(pem|key|p12|pfx|crt|cer|dump|backup|bak|log|zip|7z|tar|gz|tsbuildinfo|pyc)$') { return $false }
    return $true
}

$tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd('\', '/')
$stagePath = Join-Path $tempRoot ('svara-release-' + [guid]::NewGuid().ToString('N'))
$payloadRoot = Join-Path $stagePath 'svara-app'
New-Item -ItemType Directory -Path $payloadRoot | Out-Null

try {
    $files = @()
    foreach ($folder in $folders) {
        $folderPath = Join-Path $sourceRoot $folder
        if (Test-Path -LiteralPath $folderPath -PathType Container) {
            $files += Get-ChildItem -LiteralPath $folderPath -File -Recurse -Force
        }
    }
    foreach ($rootFile in $rootFiles) {
        $filePath = Join-Path $sourceRoot $rootFile
        if (Test-Path -LiteralPath $filePath -PathType Leaf) { $files += Get-Item -LiteralPath $filePath }
    }
    $copied = 0
    foreach ($file in $files) {
        if (($file.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { continue }
        $relative = $file.FullName.Substring($sourceRoot.Length).TrimStart('\', '/')
        if (-not (Test-DeliverablePath $relative)) { continue }
        $destination = Join-Path $payloadRoot $relative
        $destinationParent = Split-Path $destination -Parent
        if (-not (Test-Path -LiteralPath $destinationParent)) { New-Item -ItemType Directory -Path $destinationParent -Force | Out-Null }
        Copy-Item -LiteralPath $file.FullName -Destination $destination
        $copied++
    }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory($stagePath, $archivePath)
    $archive = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
    try {
        foreach ($entry in $archive.Entries) {
            if ($entry.FullName.EndsWith('/')) { continue }
            if (-not $entry.FullName.StartsWith('svara-app/')) { throw 'Unexpected archive root.' }
            if (-not (Test-DeliverablePath $entry.FullName.Substring('svara-app/'.Length))) {
                throw "Archive verification rejected entry: $($entry.FullName)"
            }
        }
    } finally { $archive.Dispose() }
    $hash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
    Write-Output "Created: $archivePath"
    Write-Output "Files: $copied"
    Write-Output "SHA256: $hash"
    Write-Output 'Excluded real environment files, dependencies, build output, private-key files, dumps, logs, and archives.'
    Write-Output 'Database records, R2 objects, provider accounts, and credentials must be transferred separately.'
} finally {
    if (Test-Path -LiteralPath $stagePath) {
        $resolvedStage = (Resolve-Path -LiteralPath $stagePath).Path
        $expectedStage = [System.IO.Path]::GetFullPath($stagePath)
        $insideTemp = $resolvedStage.StartsWith($tempRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)
        if ($insideTemp -and $resolvedStage -eq $expectedStage -and (Split-Path $resolvedStage -Leaf) -match '^svara-release-[a-f0-9]{32}$') {
            Remove-Item -LiteralPath $resolvedStage -Recurse -Force
        } else { Write-Warning "Staging cleanup skipped because path verification failed: $resolvedStage" }
    }
}

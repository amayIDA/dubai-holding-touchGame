param([ValidateSet('Run', 'Build')][string]$Mode = 'Run')
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$runtimeRoot = Join-Path $projectRoot '.runtime'
$nodeHome = Join-Path $runtimeRoot 'node'
$nodeExe = Join-Path $nodeHome 'node.exe'
$npmCli = Join-Path $nodeHome 'node_modules/npm/bin/npm-cli.js'
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    if (!(Test-Path -LiteralPath $nodeExe) -or !(Test-Path -LiteralPath $npmCli)) {
        Write-Host 'Preparing a private Node.js runtime (first launch needs internet)...' -ForegroundColor Green
        New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
        $architecture = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') { 'arm64' } else { 'x64' }
        $releases = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json'
        $release = $releases | Where-Object { $_.version -like 'v24.*' -and $_.lts } | Select-Object -First 1
        if (!$release) { throw 'Could not find a supported Node.js 24 LTS release.' }
        $filename = 'node-' + $release.version + '-win-' + $architecture + '.zip'
        $baseUri = 'https://nodejs.org/dist/' + $release.version + '/'
        $zipPath = Join-Path $runtimeRoot $filename
        Invoke-WebRequest -UseBasicParsing -Uri ($baseUri + $filename) -OutFile $zipPath
        $checksums = (Invoke-WebRequest -UseBasicParsing -Uri ($baseUri + 'SHASUMS256.txt')).Content
        $checksumLine = ($checksums -split "`n" | Where-Object { $_.Trim().EndsWith('  ' + $filename) } | Select-Object -First 1)
        if (!$checksumLine) { throw 'Node.js checksum was not found.' }
        $expected = ($checksumLine.Trim() -split '\s+')[0]
        $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $zipPath).Hash
        if ($actual -ne $expected) { throw 'Node.js download checksum mismatch. Please try again.' }
        Expand-Archive -LiteralPath $zipPath -DestinationPath $runtimeRoot -Force
        $extracted = Join-Path $runtimeRoot ([IO.Path]::GetFileNameWithoutExtension($filename))
        if (Test-Path -LiteralPath $nodeHome) { throw 'Incomplete runtime folder exists. Rename .runtime and try again.' }
        Move-Item -LiteralPath $extracted -Destination $nodeHome
        Remove-Item -LiteralPath $zipPath
    }
    $env:PATH = $nodeHome + ';' + $env:PATH
    # Electron must run as a desktop application, even when launched from a Node-based editor.
    Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
    $lockPath = Join-Path $projectRoot 'package-lock.json'
    $marker = Join-Path $projectRoot 'node_modules/.glowdash-installed'
    $fingerprint = (Get-FileHash -Algorithm SHA256 -LiteralPath $lockPath).Hash
    $installedFingerprint = if (Test-Path -LiteralPath $marker) { (Get-Content -Raw -LiteralPath $marker).Trim() } else { '' }
    if ($installedFingerprint -ne $fingerprint -or !(Test-Path 'node_modules/electron/dist/electron.exe')) {
        Write-Host 'Installing Three.js, Electron, and game dependencies...' -ForegroundColor Green
        & $nodeExe $npmCli ci --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Check your internet connection and retry.' }
        Set-Content -LiteralPath $marker -Value $fingerprint
    }
    if ($Mode -eq 'Build') {
        Write-Host 'Building the standalone Windows executable...' -ForegroundColor Green
        & $nodeExe $npmCli run build:exe
        if ($LASTEXITCODE -ne 0) { throw 'Executable build failed.' }
        Write-Host ('Finished: ' + (Join-Path $projectRoot 'release')) -ForegroundColor Green
    } else {
        & $nodeExe $npmCli run build
        if ($LASTEXITCODE -ne 0) { throw 'Game compilation failed.' }
        & $nodeExe $npmCli start
        if ($LASTEXITCODE -ne 0) { throw 'The desktop game exited with an error.' }
    }
} catch {
    Write-Host ('ERROR: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
}


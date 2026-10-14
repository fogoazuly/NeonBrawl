$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) { $nodePath = $nodeCommand.Source }
else { $nodePath = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $nodePath)) { throw 'Instale o Node.js 22 ou superior e tente novamente.' }
if (-not (Test-Path -LiteralPath 'node_modules\peer') -or -not (Test-Path -LiteralPath 'node_modules\@supabase\supabase-js')) {
    $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($npmCommand) { & $npmCommand.Source ci --no-audit --no-fund }
    elseif (Test-Path -LiteralPath '.tools\package\bin\npm-cli.js') { & $nodePath .tools/package/bin/npm-cli.js ci --no-audit --no-fund }
    else { throw 'Instale o Node.js com npm e execute npm ci nesta pasta.' }
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar as dependencias.' }
}
Write-Host 'Abra http://127.0.0.1:3000 no navegador. Para encerrar, pressione Ctrl+C.'
& $nodePath server.mjs

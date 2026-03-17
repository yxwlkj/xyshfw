<#
  Local one-click startup for Campus Life Assistant (AI MVP integrated)
  - Installs dependencies, starts server, waits for readiness, optionally logs in as admin and saves token for quick testing
  - This is a local developer aid; for production, use proper CI/CD pipelines
#>
param(
  [switch]$AutoLogin
)

function Check-Command($cmd){
  $exists = Get-Command $cmd -ErrorAction SilentlyContinue
  if(-not $exists){ Write-Host "$cmd 未找到，请确保已安装并在 PATH 中"; exit 1 }
}

Write-Host "[Local Start] 校园生活助手 - AI MVP 本地启动"
Check-Command -cmd node
Check-Command -cmd npm

Write-Host "Installing dependencies..."
npm ci

Write-Host "Starting server..."
Start-Process -NoNewWindow -FilePath node -ArgumentList 'server.js' -WorkingDirectory (Get-Location).Path

function Wait-ForServer {
  param([string]$url, [int]$timeoutSec = 60)
  $start = Get-Date
  while(((Get-Date) - $start).TotalSeconds -lt $timeoutSec) {
    try {
      Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2 | Out-Null
      return $true
    } catch { Start-Sleep -Seconds 1 }
  }
  return $false
}

Write-Host "Waiting for server to be ready... (http://localhost:3000)"
if (-not (Wait-ForServer -url 'http://localhost:3000' -timeoutSec 60)) {
  Write-Host "Server did not become ready in time."; exit 1
}

if ($AutoLogin) {
  Write-Host "Attempting admin auto-login..."
  $body = '{"username":"admin","password":"admin123"}'
  try {
    $resp = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/admin/login' -ContentType 'application/json' -Body $body
    $token = $resp.data.token
    if ($token) {
      $tokenPath = (Join-Path -Path (Get-Location) -ChildPath 'login_token.txt')
      [System.IO.File]::WriteAllText($tokenPath, $token)
      Write-Host "Admin token saved to login_token.txt"
      Write-Host "Token: $token"
    }
  } catch {
    Write-Host "Admin login failed: $_"
  }
}

Write-Host "Local startup complete. Open http://localhost:3000 to verify."

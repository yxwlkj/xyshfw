param([switch]$AdminLogin)

Write-Host "Running local startup (one-click) ..." -ForegroundColor Green

if (Test-Path -Path "package.json") {
  if (Test-Path -Path "server.js") {
    if ($AdminLogin) {
      Write-Host "Admin auto-login enabled (mock)." -ForegroundColor Yellow
      # In a real setup, you would inject admin credentials here
    }
    node .\server.js
  } else {
    Write-Host "No server.js found. Trying npm start..." -ForegroundColor Yellow
    npm install --silent
    npm run start
  }
} else {
  Write-Host "No package.json found in current directory." -ForegroundColor Red
}

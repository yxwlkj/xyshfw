@echo off
echo Running local startup (one-click) ...
if exist package.json (
  if exist server.js (
    node server.js
  ) else (
    echo No server.js found. Attempting npm start...
    npm install --silent
    npm run start
  )
) else (
  echo No package.json found in current directory.
)

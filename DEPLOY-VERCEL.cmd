@echo off
setlocal
cd /d "%~dp0"
echo Ivan Kosovych - Vercel deployment
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install the LTS version, then run this file again.
  start "" "https://nodejs.org/en/download"
  pause
  exit /b 1
)
where npx >nul 2>nul
if errorlevel 1 (
  echo npm/npx is missing. Reinstall Node.js LTS with npm enabled.
  pause
  exit /b 1
)
echo Opening the official Vercel sign-in flow...
call npx --yes vercel@59.23.2 login
if errorlevel 1 goto failed
if not exist ".vercel\project.json" (
  echo Creating a new ik-transport project...
  call npx --yes vercel@59.23.2 project add ik-transport
  if errorlevel 1 goto failed
)
echo Connecting this folder to the ik-transport project...
call npx --yes vercel@59.23.2 link --yes --project ik-transport
if errorlevel 1 goto failed
echo Publishing the website to production...
call npx --yes vercel@59.23.2 deploy --prod --yes
if errorlevel 1 goto failed
echo.
echo Deployment completed. Copy the production URL shown above.
pause
exit /b 0
:failed
echo.
echo Deployment did not complete. Copy the error above and send it to ChatGPT.
pause
exit /b 1

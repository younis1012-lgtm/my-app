@echo off
echo Applying final build fix...
node scripts\final-build-fix.cjs
echo.
echo Installing dependencies from root...
npm install
echo.
echo Cleaning Next cache...
if exist .next rmdir /s /q .next
echo.
echo Running build...
npm run build
echo.
echo If build passed, run:
echo git add .
echo git commit -m "final build fix webpack and email routes"
echo git push

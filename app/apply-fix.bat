@echo off
echo Applying YK Quality build fix...
if not exist app\page.tsx (
  echo ERROR: app\page.tsx not found. Put this folder content in the project root.
  exit /b 1
)

node scripts\fix-page-preliminary-types.cjs

echo.
echo Done. Now run:
echo npm run build
echo git add .
echo git commit -m "fix preliminary typing and email routes"
echo git push

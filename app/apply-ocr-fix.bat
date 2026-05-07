@echo off
echo Fixing OCR route TypeScript issue...
node scripts\fix-ocr-route-type.cjs
echo.
echo Now run:
echo npm run build
echo git add .
echo git commit -m "fix ocr route type"
echo git push

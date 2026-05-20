# העלאה ל-Vercel אחרי תיקון דוחות פיקוח עליון

## קובץ שתוקן

הקובץ המלא המעודכן נמצא כאן:

```text
app/page.tsx
```

התיקון מטפל בשמירת דוחות פיקוח עליון בדפדפן:

- ממתין בפועל לסיום שמירה ב-IndexedDB או LocalStorage.
- מציג הודעת שגיאה אם הדפדפן חסם שמירה או אם נגמר מקום אחסון.
- שומר ומסנן את מזהה הפרויקט בצורה אחידה כדי שהדוח לא ייעלם מהרשימה.

## בדיקה מקומית

מתוך תיקיית הפרויקט:

```powershell
cd C:\Users\Update\my-app
npm.cmd run build
```

הבדיקה עברה בהצלחה בזמן הכנת התיקון.

## העלאה ל-Vercel דרך GitHub

1. פתח טרמינל בתיקיית הפרויקט:

```powershell
cd C:\Users\Update\my-app
```

2. בדוק אילו קבצים השתנו:

```powershell
git status
```

3. הוסף רק את הקובץ שתוקן ואת קובץ ההוראות, אם רוצים:

```powershell
git add app/page.tsx VERCEL_DEPLOY_FIX.md
```

4. צור commit:

```powershell
git commit -m "Fix supervision reports saving"
```

5. שלח ל-GitHub:

```powershell
git push
```

6. אם הפרויקט כבר מחובר ל-Vercel, ה-push יפעיל Deploy אוטומטי.

7. ב-Vercel:

- היכנס ל-Dashboard.
- פתח את הפרויקט.
- עבור ל-Deployments.
- ודא שה-deploy האחרון הסתיים ב-Ready.

## אם מעלים ישירות דרך Vercel CLI

אם מותקן Vercel CLI:

```powershell
cd C:\Users\Update\my-app
vercel
```

לפרסום production:

```powershell
vercel --prod
```

## משתני סביבה

ב-Vercel צריך לוודא שקיימים אותם משתני סביבה שיש בקובץ המקומי `.env.local`, בעיקר:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

מגדירים אותם ב:

```text
Vercel Dashboard > Project > Settings > Environment Variables
```

אחרי שינוי משתני סביבה צריך להריץ Redeploy.

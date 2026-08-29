חבילת החלפה: עץ פרויקט ישן -> ספריית תבניות / עץ פרויקט חדש

מה החבילה עושה:
1. יוצרת גיבוי ל-app/page.tsx.
2. מוסיפה מודול חדש:
   app/engineering-templates/page.tsx
   app/components/EngineeringTemplates/TemplateLibrary.tsx
   app/components/EngineeringTemplates/TemplateData.ts
3. מחליפה את כפתור "עץ פרויקט" הישן בכפתור:
   🏗️ ספריית תבניות / עץ פרויקט חדש
4. מחליפה את מסך עץ הפרויקט הישן בכרטיס שמפנה למודול החדש.
5. מסירה קבצי עזר/גיבוי ישנים שנכנסו בטעות לתיקיית app.

חשוב:
החבילה לא מוחקת טיפוסים ופונקציות פנימיים בשם projectStructure, כי חלקים אחרים במערכת משתמשים בהם לשיוך מיקום, בדיקות ו-Checklist. מחיקה מלאה שלהם עלולה לשבור את המערכת.
היא כן מסירה את המסך והכפתור הישנים מהמשתמש ומחליפה אותם בתבניות החדשות.

פקודת הרצה מתוך C:\Users\Update\my-app:
powershell -ExecutionPolicy Bypass -File project_tree_to_templates_final_package\apply_replace_project_tree_with_templates.ps1

אחר כך:
npm run build
git status
git add app
git commit -m "Replace project tree with engineering templates"
git push

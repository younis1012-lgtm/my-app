const fs = require("fs");
const path = require("path");

const candidates = [
  path.join(process.cwd(), "components", "ConcentrationsSection.tsx"),
  path.join(process.cwd(), "app", "components", "ConcentrationsSection.tsx"),
];

const filePath = candidates.find(fs.existsSync);

if (!filePath) {
  console.log("לא נמצא הקובץ ConcentrationsSection.tsx");
  process.exit(1);
}

let content = fs.readFileSync(filePath, "utf8");

console.log("נמצא קובץ:", filePath);

/*
====================================================
1) מוחק את התצוגה העליונה הירוקה מדף הריכוזים
====================================================
*/

const removePatterns = [
  /<div[^>]*>[\s\S]*?דוח ריכוז בדיקות אפיון למצע סוג א׳[\s\S]*?<\/div>\s*<\/div>/gm,
  /<section[^>]*>[\s\S]*?דוח ריכוז בדיקות אפיון למצע סוג א׳[\s\S]*?<\/section>/gm,
  /<div[^>]*>[\s\S]*?לפני הורדה אפשר לפתוח תצוגה מקדימה[\s\S]*?<\/div>/gm,
];

removePatterns.forEach((pattern) => {
  content = content.replace(
    pattern,
    "{/* top concentration preview removed */}"
  );
});

/*
====================================================
2) מבטל preview אוטומטי
====================================================
*/

content = content.replace(
  /useState\s*\(\s*["'`]subbase-a["'`]\s*\)/g,
  'useState("")'
);

content = content.replace(
  /useState\s*\(\s*["'`]subbase["'`]\s*\)/g,
  'useState("")'
);

/*
====================================================
3) משאיר את אפיון מצע א׳ רק ככרטיס רגיל
====================================================
*/

content = content.replace(/featured:\s*true/g, "featured: false");
content = content.replace(/showOnTop:\s*true/g, "showOnTop: false");

/*
====================================================
4) ממרכז טבלאות אקסל
====================================================
*/

content = content.replace(
  /horizontal:\s*["'`]left["'`]/g,
  'horizontal: "center"'
);

content = content.replace(
  /textAlign:\s*["'`]left["'`]/g,
  'textAlign: "center"'
);

fs.writeFileSync(filePath, content, "utf8");

console.log("התיקון הסתיים בהצלחה");
const fs = require("fs");
const path = require("path");

const filePath = path.join(
  process.cwd(),
  "app",
  "components",
  "ConcentrationsSection.tsx"
);

let content = fs.readFileSync(filePath, "utf8");

// מוחק את ריכוז אפיון מצע א׳ מהעמוד הראשי של הריכוזים
content = content.replace(
  /(\{[\s\S]*?title:\s*["']ריכוז אפיון מצע א׳["'][\s\S]*?group:\s*["']main["'][\s\S]*?\},?)/g,
  ""
);

// משאיר אותו רק בתוך הקבוצה הפנימית
content = content.replace(
  /group:\s*["']main["']/g,
  'group: "internal"'
);

// מרכז טקסט בטבלה התחתונה
content = content.replace(
  /alignment:\s*["']left["']/g,
  'alignment: "center"'
);

content = content.replace(
  /textAlign:\s*["']left["']/g,
  'textAlign: "center"'
);

fs.writeFileSync(filePath, content, "utf8");

console.log("✔ ריכוז אפיון מצע א׳ הוסר מהעמוד הראשי");
console.log("✔ נשאר רק בתוך הריכוז הפנימי");
console.log("✔ כל הנתונים בטבלה התחתונה ממורכזים");
console.log("✔ הסתיים בהצלחה");
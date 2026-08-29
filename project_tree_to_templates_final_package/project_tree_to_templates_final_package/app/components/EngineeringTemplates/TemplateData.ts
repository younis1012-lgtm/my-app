export type EngineeringTemplateNode = {
  name: string;
  children?: EngineeringTemplateNode[];
};

export type EngineeringTemplate = {
  id: string;
  icon: string;
  title: string;
  description: string;
  nodes: EngineeringTemplateNode[];
};

const layers = (label: string, count = 6): EngineeringTemplateNode => ({
  name: label,
  children: Array.from({ length: count }, (_, index) => ({ name: `שכבה ${index + 1}` })),
});

export const ENGINEERING_TEMPLATES: EngineeringTemplate[] = [
  {
    id: "road-structure",
    icon: "🚧",
    title: "מבנה כביש",
    description: "עבודות עפר, שכבות מבנה, אספלט וגמר.",
    nodes: [
      {
        name: "עבודות עפר",
        children: [
          { name: "חפירה" },
          { name: "קרקע יסוד" },
          { name: "הידוק קרקע יסוד" },
          layers("החלפת קרקע", 4),
          layers("מילוי מובא", 6),
        ],
      },
      {
        name: "שכבות מבנה",
        children: [
          { name: "מצע א׳" },
          { name: "מצע ב׳" },
          { name: "אגו״מ" },
          { name: "שכבה מקשרת" },
          { name: "שכבת שחיקה" },
        ],
      },
      { name: "עבודות גמר", children: [{ name: "סימון כבישים" }, { name: "תמרור ושילוט" }, { name: "מעקות" }] },
    ],
  },
  {
    id: "retaining-wall",
    icon: "🧱",
    title: "קיר תומך",
    description: "חפירה, בטון, איטום, נקזים ומילוי בגב קיר.",
    nodes: [
      { name: "עבודות עפר", children: [{ name: "חפירה" }, { name: "הכנת שתית" }] },
      { name: "עבודות בטון", children: [{ name: "בטון רזה" }, { name: "זיון יסוד" }, { name: "יציקת יסוד" }, { name: "זיון קיר" }, { name: "יציקת קיר" }] },
      { name: "איטום וניקוז", children: [{ name: "איטום גב קיר" }, { name: "נקזים" }, { name: "יריעת ניקוז" }] },
      layers("מילוי בגב קיר", 12),
      { name: "מבנה כביש מעל/בסמוך לקיר", children: [{ name: "מצע א׳" }, { name: "שכבה מקשרת" }, { name: "שכבת שחיקה" }] },
    ],
  },
  {
    id: "drainage-channel",
    icon: "🌊",
    title: "תעלת ניקוז",
    description: "תעלה פתוחה/בטון כולל חפירה, בטון ומילוי חוזר.",
    nodes: [
      { name: "חפירה לתעלה" },
      { name: "הכנת תחתית" },
      { name: "בטון רזה" },
      { name: "זיון" },
      { name: "יציקת בטון" },
      layers("מילוי חוזר", 8),
      { name: "גמר וניקוי תעלה" },
    ],
  },
  {
    id: "drainage-pipe",
    icon: "🚰",
    title: "קו ניקוז",
    description: "צינורות ניקוז, עטיפה, בדיקות ומילוי חוזר.",
    nodes: [
      { name: "חפירת תעלה" },
      { name: "מצע לצינור" },
      { name: "הנחת צינור" },
      { name: "חיבורים ושוחות" },
      { name: "בדיקת קו" },
      { name: "עטיפה" },
      layers("מילוי חוזר", 6),
      { name: "שיקום פני שטח" },
    ],
  },
  {
    id: "manhole",
    icon: "🕳️",
    title: "שוחה",
    description: "חפירה, בסיס, חוליות/קירות, תקרה ומכסה.",
    nodes: [
      { name: "חפירה לשוחה" },
      { name: "בטון רזה" },
      { name: "בסיס שוחה" },
      { name: "קירות/חוליות" },
      { name: "תקרה" },
      { name: "מכסה ותושבת" },
      { name: "מילוי חוזר" },
    ],
  },
  {
    id: "culvert",
    icon: "🌉",
    title: "מעביר מים",
    description: "חפירה, מצעים, בטון, כנפיים ומילוי.",
    nodes: [
      { name: "חפירה" },
      { name: "בטון רזה" },
      { name: "יסוד" },
      { name: "קירות/מסגרת" },
      { name: "כנפיים" },
      { name: "איטום" },
      layers("מילוי חוזר", 10),
      { name: "הסדרת זרימה" },
    ],
  },
  {
    id: "rockfill",
    icon: "🪨",
    title: "מסלעה",
    description: "חפירה, הכנת תשתית, סידור אבן וניקוז.",
    nodes: [
      { name: "חפירה והכנת מדרון" },
      { name: "מצע/תשתית" },
      { name: "סידור אבן" },
      { name: "ניקוז מאחורי מסלעה" },
      { name: "גמר וניקוי" },
    ],
  },
  {
    id: "sidewalk",
    icon: "🚶",
    title: "מדרכה",
    description: "מצעים, אבני שפה, ריצוף וגמר.",
    nodes: [
      { name: "חפירה/יישור" },
      { name: "מצע" },
      { name: "אבני שפה" },
      { name: "ריצוף/בטון מדרכה" },
      { name: "השלמות וגמר" },
    ],
  },
  {
    id: "safety",
    icon: "🚦",
    title: "עבודות בטיחות",
    description: "תמרור, שילוט, מעקות וסימון.",
    nodes: [
      { name: "תמרור ושילוט" },
      { name: "מעקות בטיחות" },
      { name: "סימון כבישים" },
      { name: "התקני בטיחות זמניים" },
    ],
  },
  {
    id: "lighting",
    icon: "💡",
    title: "תאורה",
    description: "תעלות, שרוולים, יסודות, עמודים ובדיקות.",
    nodes: [
      { name: "חפירת תעלות" },
      { name: "הנחת שרוולים" },
      { name: "יסודות לעמודים" },
      { name: "הצבת עמודים" },
      { name: "כבלים ולוחות" },
      { name: "בדיקות חשמל" },
    ],
  },
  {
    id: "landscaping",
    icon: "🌿",
    title: "גינון ופיתוח נופי",
    description: "אדמה גננית, שתילה, השקיה וגמר.",
    nodes: [
      { name: "הכנת שטח" },
      { name: "אדמה גננית" },
      { name: "מערכת השקיה" },
      { name: "שתילה" },
      { name: "הידרוזריעה" },
      { name: "תחזוקה ראשונית" },
    ],
  },
];

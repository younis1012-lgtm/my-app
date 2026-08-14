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
          {
            name: "החלפת קרקע",
            children: [
              { name: "שכבה 1" },
              { name: "שכבה 2" },
              { name: "שכבה 3" },
            ],
          },
          { name: "מילוי מובא" },
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
      {
        name: "עבודות גמר",
        children: [{ name: "סימון כבישים" }, { name: "מעקות" }, { name: "שילוט ותמרור" }],
      },
    ],
  },
  {
    id: "retaining-wall",
    icon: "🧱",
    title: "קיר תומך",
    description: "חפירה, בטונים, איטום, ניקוז ומילוי בגב קיר.",
    nodes: [
      { name: "עבודות עפר", children: [{ name: "חפירה" }] },
      { name: "בטון", children: [{ name: "בטון רזה" }, { name: "יסוד" }, { name: "קיר" }] },
      { name: "איטום" },
      { name: "ניקוז", children: [{ name: "נקזים" }] },
      {
        name: "מילוי בגב קיר",
        children: [{ name: "שכבה 1" }, { name: "שכבה 2" }, { name: "שכבה 3" }, { name: "שכבה 4" }],
      },
      { name: "מבנה כביש מעל/בסמוך לקיר" },
    ],
  },
  {
    id: "stone-facing-gravity-wall",
    icon: "🧱",
    title: "קיר כובד – חזית אבן לקט",
    description: "תבנית ייעודית לתוכנית קיר כובד בחזית אבן לקט, כולל בטון, ניקוז, אבן ומילוי גב הקיר.",
    nodes: [
      { name: "הכנת תשתית וחפירה" },
      { name: "יסוד הקיר" },
      { name: "מעטפת אבן לקט" },
      { name: "תבניות בגב הקיר" },
      { name: "יציקת גוף הקיר", children: [{ name: "נטילת דגימות בטון" }, { name: "אשפרת בטון" }] },
      { name: "מערכת ניקוז", children: [{ name: "נקזים 4 אינץ׳" }, { name: "מסננת חצץ ובד גיאוטכני" }] },
      { name: "מילוי בגב הקיר" },
      { name: "מדידת עדות (As Made)" },
      { name: "בדיקה ואישור סופי" },
    ],
  },
  {
    id: "drainage-channel",
    icon: "🌊",
    title: "תעלת ניקוז",
    description: "חפירה, בטון, עטיפה ומילוי חוזר.",
    nodes: [
      { name: "חפירה" },
      { name: "בטון רזה" },
      { name: "זיון" },
      { name: "בטון" },
      { name: "עטיפה" },
      { name: "מילוי חוזר", children: [{ name: "שכבה 1" }, { name: "שכבה 2" }, { name: "שכבה 3" }] },
      { name: "עבודות גמר" },
    ],
  },
  {
    id: "drainage-pipe",
    icon: "🚰",
    title: "קו ניקוז",
    description: "חפירה, מצע לצינור, הנחה, עטיפה ומילוי חוזר.",
    nodes: [
      { name: "חפירה" },
      { name: "מצע לצינור" },
      { name: "הנחת צינור" },
      { name: "בדיקות" },
      { name: "עטיפה" },
      { name: "מילוי חוזר", children: [{ name: "שכבה 1" }, { name: "שכבה 2" }, { name: "שכבה 3" }] },
      { name: "שיקום פני השטח" },
    ],
  },
  {
    id: "manhole",
    icon: "🕳️",
    title: "שוחה",
    description: "חפירה, תחתית, קירות, תקרה, מכסה ומילוי חוזר.",
    nodes: [
      { name: "חפירה" },
      { name: "בטון רזה" },
      { name: "תחתית" },
      { name: "קירות" },
      { name: "תקרה" },
      { name: "שלבים" },
      { name: "מכסה" },
      { name: "מילוי חוזר" },
    ],
  },
  {
    id: "culvert",
    icon: "🌉",
    title: "מעביר מים",
    description: "מבנה ניקוז מבטון כולל עבודות עפר, בטונים ומילוי.",
    nodes: [
      { name: "חפירה" },
      { name: "בטון רזה" },
      { name: "רצפה" },
      { name: "קירות" },
      { name: "תקרה" },
      { name: "איטום" },
      { name: "מילוי חוזר", children: [{ name: "שכבה 1" }, { name: "שכבה 2" }, { name: "שכבה 3" }] },
    ],
  },
  {
    id: "riprap",
    icon: "🪨",
    title: "מסלעה",
    description: "חפירה, הכנת תשתית, הנחת אבנים וגמר.",
    nodes: [
      { name: "חפירה" },
      { name: "הכנת תשתית" },
      { name: "בדיקת אבנים" },
      { name: "הנחת אבנים" },
      { name: "מילוי מאחורי מסלעה" },
      { name: "גמר" },
    ],
  },
  {
    id: "sidewalk",
    icon: "🚶",
    title: "מדרכה",
    description: "מצעים, אבני שפה, ריצוף וגמר.",
    nodes: [
      { name: "חפירה / יישור" },
      { name: "מצע" },
      { name: "אבני שפה" },
      { name: "ריצוף" },
      { name: "מילוי מישקים" },
      { name: "גמר וניקיון" },
    ],
  },
  {
    id: "safety",
    icon: "🚦",
    title: "עבודות בטיחות",
    description: "מעקות, שילוט, תמרור וסימון.",
    nodes: [
      { name: "מעקות בטיחות" },
      { name: "עמודי תמרור" },
      { name: "שילוט" },
      { name: "סימון כבישים" },
      { name: "בדיקת קבלה" },
    ],
  },
  {
    id: "lighting",
    icon: "💡",
    title: "תאורה",
    description: "שרוולים, יסודות, עמודים, כבלים ובדיקות חשמל.",
    nodes: [
      { name: "חפירת תעלות" },
      { name: "הנחת שרוולים" },
      { name: "יסודות לעמודי תאורה" },
      { name: "הצבת עמודים" },
      { name: "השחלת כבלים" },
      { name: "בדיקות חשמל" },
    ],
  },
  {
    id: "landscaping",
    icon: "🌿",
    title: "גינון",
    description: "אדמת גן, השקיה, שתילה ותחזוקה ראשונית.",
    nodes: [
      { name: "הכנת קרקע" },
      { name: "אדמת גן" },
      { name: "מערכת השקיה" },
      { name: "שתילה" },
      { name: "תחזוקה ראשונית" },
    ],
  },
];

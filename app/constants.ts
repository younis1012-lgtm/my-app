import type {
  ControlProcessStatus,
  ProjectAccess,
  ProjectProfile,
  Project,
  RequiredDocumentType,
} from "./types";

// ===== STORAGE KEYS =====
export const STORAGE_KEY = "yk-quality-stage4-multifile";
export const CURRENT_PROJECT_STORAGE_KEY = `${STORAGE_KEY}-current-project-id`;
export const AUTH_STORAGE_KEY = `${STORAGE_KEY}-system-user`;
export const AUTH_SESSION_TIMEOUT_MS = 10 * 60 * 1000;
export const ACCESS_USERS_STORAGE_KEY = `${STORAGE_KEY}-access-users`;
export const ACCESS_USERS_TABLE = "project_access_users";
export const PROJECT_LEGEND_STORAGE_KEY = `${STORAGE_KEY}-project-legend`;
export const PROJECT_LEGEND_TABLE = "project_legends";
export const RFI_STORAGE_KEY = `${STORAGE_KEY}-rfi-records`;
export const CONTROL_PROCESS_STORAGE_KEY = `${STORAGE_KEY}-control-processes`;
export const CONTROL_PROCESS_TABLE = "control_processes";
export const PROJECT_EMAIL_USERS_STORAGE_KEY = `${STORAGE_KEY}-project-email-users`;
export const PROJECT_EMAIL_USERS_TABLE = "project_email_users";
export const APP_VERSION_STORAGE_KEY = `${STORAGE_KEY}-app-version`;

// ===== APP CONFIG =====
export const SUPABASE_HEADER_ERROR_FRAGMENT = "String contains non ISO-8859-1 code point";
export const CONTROL_QUALITY_COMPANY_NAME = 'קונטרולינג פריים בע"מ';
export const FIXED_EMAIL_RECIPIENT = "q.controling@gmail.com";
export const APP_VERSION = "2026-05-04-checklist-top-editable-cache-refresh-v2";
export const ROAD_806_SURVEYOR_NAME = "באסל שקארה";

// ===== SIGNATURE DATA =====
// Base64-encoded signature moved to a dedicated constant.
// In the future this should be stored as a file in /public or in the database.
export { ROAD_806_SURVEYOR_SIGNATURE_DATA_URL } from "./signatureData";

// ===== PROJECT PROFILES =====
export const PROJECT_PROFILES: ProjectProfile[] = [
  {
    projectName: "כביש 806 צלמון שלב א׳",
    contractor: 'מפלסי הגליל סלילה עפר ופיתוח בע"מ',
    projectManager: 'א.ש. רונן הנדסה אזרחית בע"מ',
    qaCompany: 'תיקו הנדסה בע"מ',
    qualityControl: "יונס אברהים",
    workManager: "חוסיין מריסאת",
    surveyor: "באסל שקארה",
  },
];

// ===== PROJECT ID ALIASES =====
export const PROJECT_ID_ALIASES: Record<string, string> = {
  "project-806": "80600000-0000-0000-0000-000000000000",
  "project-909": "90900000-0000-0000-0000-000000000000",
};

// ===== FALLBACK PROJECTS =====
export const FALLBACK_PROJECTS: Project[] = [
  {
    id: "80600000-0000-0000-0000-000000000000",
    name: "כביש 806 צלמון שלב א׳",
    description: "פרויקט ברירת מחדל לפי הרשאת משתמש 806",
    manager: 'א.ש. רונן הנדסה אזרחית בע"מ',
    isActive: true,
    createdAt: "ברירת מחדל",
  },
  {
    id: "90900000-0000-0000-0000-000000000000",
    name: "פרויקט 909",
    description: "פרויקט ברירת מחדל לפי הרשאת משתמש 909",
    manager: "",
    isActive: false,
    createdAt: "ברירת מחדל",
  },
];

// ===== DEFAULT ACCESS USERS =====
export const DEFAULT_PROJECT_ACCESS_LIST: ProjectAccess[] = [
  {
    username: "admin",
    password: "admin123",
    displayName: "מנהל מערכת",
    role: "admin",
    code: "admin",
    projectName: null,
  },
  {
    username: "user806",
    password: "806",
    displayName: "משתמש פרויקט 806",
    role: "user",
    code: "806",
    projectName: "כביש 806 צלמון שלב א׳",
  },
  {
    username: "user909",
    password: "909",
    displayName: "משתמש פרויקט 909",
    role: "user",
    code: "909",
    projectName: "שם הפרויקט כפי שמופיע במערכת",
  },
];

// ===== STATUS OPTIONS =====
export const CONTROL_PROCESS_STATUS_OPTIONS: ControlProcessStatus[] = [
  "טיוטה",
  "בביצוע",
  "ממתין לאישור",
  "מאושר",
  "נדחה",
  "נעול",
];

export const REQUIRED_DOCUMENT_TYPES: RequiredDocumentType[] = [
  "תעודת מעבדה",
  "רשימת מדידה",
  "צילום",
  "אישור ספק",
  "תוכנית",
  "RFI",
  "אחר",
];

export const REFERENCE_MATERIAL_OPTIONS = [
  "אישור חומר חצץ",
  "סוללות מילוי מיובא",
  "סוללות מילוי חומר מקומי",
  "שכבות אגו״ם לקביעת קו דירוג",
  "בטון יצוק באתר - כללי דריכה",
  "חול מיוצב צמנט",
  "עבודות אספלט באתר - קביעת מערכת מרשל",
  "הידוק קרקע יסוד",
  "בטון יצוק באתר - בדיקת ברזל",
  "מצע א׳ - דירוג ושווה ערך חול",
  "שכבות מצע ב׳",
  "אבקת בנטונייט",
  "חומר דיוס",
  "פלדה",
  "אבן לחיפוי",
  "חול לצינור / אבן שברי אבן",
  "ריצוף באבן טבעית",
  "סוללות עפר - מילוי מובקר מחומר אינרטי",
  "בטון יצוק באתר",
  "בטון מותז",
  "ייצור אלמנטים טרומיים לחומה",
  "בדיקה ובקרה פנימית של התכנון",
  "אגרגטים ת״י 3",
  "מצע ג׳",
  "מילוי נברר",
  "מילוי אינרטי",
  "שתית / קרקע יסוד",
  "אספלט - שכבה נושאת",
  "אספלט - שכבה מקשרת",
  "אספלט - שכבה עליונה",
  "בטון ב-30",
  "בטון ב-40",
  "בטון ב-50",
  "בטון ב-60",
  "אחר",
];

export const RESPONSIBLE_ROLE_OPTIONS = [
  "",
  "בקרת איכות",
  "מנהל עבודה",
  "מודד",
  "הבטחת איכות",
  "ניהול פרויקט",
];

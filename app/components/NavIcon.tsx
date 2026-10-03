import type { ReactNode } from "react";

// Line icons for the main navigation (one consistent set instead of mixed emoji/glyphs).
const paths: Record<string, ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />,
  myTasks: (
    <>
      <path d="M9 11l3 3 8-8" />
      <path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" />
    </>
  ),
  managementDashboard: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 3 3 5-6" />
    </>
  ),
  account: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  projectStructure: (
    <>
      <rect x="9" y="3" width="6" height="5" rx="1" />
      <rect x="3" y="16" width="6" height="5" rx="1" />
      <rect x="15" y="16" width="6" height="5" rx="1" />
      <path d="M12 8v4M6 16v-4h12v4" />
    </>
  ),
  projectDetails: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  projectUsers: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" />
    </>
  ),
  projects: <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  checklists: (
    <>
      <path d="M10 6h10M10 12h10M10 18h10" />
      <path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17" />
    </>
  ),
  checklistTracking: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 4v16" />
    </>
  ),
  labOrders: (
    <>
      <path d="M9 3h6M10 3v5l-4.5 8.5A2 2 0 0 0 7.3 19.5h9.4a2 2 0 0 0 1.8-3L14 8V3" />
      <path d="M8 14h8" />
    </>
  ),
  holdPoints: <path d="M5 21V4h11l-2 4 2 4H5" />,
  nonconformances: (
    <>
      <path d="M12 3 2 20h20z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  trialSections: <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" />,
  preliminary: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  plans: (
    <>
      <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z" />
      <path d="M9 3v15M15 6v15" />
    </>
  ),
  qualityDocuments: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M9 15l2 2 4-4" />
    </>
  ),
  controlProcesses: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M8 13h8M8 17h5" />
    </>
  ),
  rfi: (
    <>
      <path d="M4 4h16v12H8l-4 4z" />
      <path d="M10 9a2 2 0 1 1 3 1.7c-.6.4-1 .8-1 1.3M12 14h.01" />
    </>
  ),
  supervisionReports: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  concentrations: <path d="M4 20h16M7 16V9M12 16V5M17 16v-4" />,
  templates: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M17.5 14v7M14 17.5h7" />
    </>
  ),
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
};

export function NavIcon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? <circle cx="12" cy="12" r="2" />}
    </svg>
  );
}

export const NCR_RESPONSIBLE_OPTIONS = ['', 'תכנון', 'ביצוע', 'ספק'];
export const NCR_HANDLER_OPTIONS = ['', 'תכנון', 'ביצוע', 'ספק', 'מנהל פרויקט'];

type AccessIdentity = {
  username?: string;
  displayName?: string;
  email?: string;
  code?: string;
  aliases?: string[];
  role?: string;
};

type ProjectPerson = { name?: string; role?: string; email?: string; active?: boolean };

const normalize = (value: unknown) => String(value ?? '')
  .replace(/[\u05f3\u05f4`\u2019'\"]/g, '')
  .replace(/[\s./_-]+/g, '')
  .trim()
  .toLowerCase();

export const isQualityAssuranceIdentity = (access?: AccessIdentity | null) => {
  if (!access) return false;
  const labels = [access.username, access.displayName, access.code, ...(access.aliases ?? [])].map(normalize);
  return labels.some((label) => label === 'הא' || label === 'qa' || label.includes('הבטחתאיכות'));
};

export const canManageNonconformances = (access?: AccessIdentity | null) =>
  Boolean(access && (access.role === 'admin' || access.role === 'readwrite' || isQualityAssuranceIdentity(access)));

export function nonconformanceActor(access?: AccessIdentity | null, people: ProjectPerson[] = []) {
  const qualityAssurance = isQualityAssuranceIdentity(access);
  const identities = [access?.email, access?.username, ...(access?.aliases ?? [])].map(normalize).filter(Boolean);
  const activePeople = people.filter((person) => person.active !== false);
  const matchedByIdentity = activePeople.find((person) => [person.email,person.name].map(normalize).some((value)=>identities.includes(value)));
  const matchedByRole = activePeople.find((person) => {
    const role = normalize(person.role);
    return qualityAssurance ? role === 'הא' || role === 'qa' || role.includes('הבטחתאיכות') : role === 'qc' || role.includes('בקרתאיכות') || role.includes('בקר איכות');
  });
  const displayName = String(access?.displayName || '').trim();
  const genericDisplay = ['הא','qa','qc','הבטחתאיכות','בקרתאיכות'].includes(normalize(displayName));
  const personalName = (!genericDisplay && displayName) || String((matchedByIdentity || matchedByRole)?.name || '').trim() || displayName || String(access?.username || '').trim();
  return {
    openedBy: qualityAssurance ? 'QA' : 'QC',
    roleLabel: qualityAssurance ? 'הבטחת איכות' : 'בקרת איכות',
    personalName,
  };
}

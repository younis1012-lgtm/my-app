$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $scriptDir
if (!(Test-Path (Join-Path $root "app\page.tsx"))) {
  if (Test-Path (Join-Path $scriptDir "app\page.tsx")) {
    $root = $scriptDir
  } else {
    throw "Run this script from inside the extracted package under your project root: C:\Users\Update\my-app"
  }
}

Write-Host "Applying Engineering Templates / New Project Tree replacement..." -ForegroundColor Cyan

$pagePath = Join-Path $root "app\page.tsx"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $root "app\page.backup.before-engineering-templates-$timestamp.tsx"
Copy-Item $pagePath $backupPath -Force
Write-Host "Backup created: app\$(Split-Path -Leaf $backupPath)" -ForegroundColor Yellow

# Copy new module files.
New-Item -ItemType Directory -Force (Join-Path $root "app\components\EngineeringTemplates") | Out-Null
Copy-Item (Join-Path $scriptDir "app\components\EngineeringTemplates\*") (Join-Path $root "app\components\EngineeringTemplates\") -Force
New-Item -ItemType Directory -Force (Join-Path $root "app\engineering-templates") | Out-Null
Copy-Item (Join-Path $scriptDir "app\engineering-templates\page.tsx") (Join-Path $root "app\engineering-templates\page.tsx") -Force

# Remove accidental old helper/backup files that were previously committed under app/.
$oldFiles = @(
  "app\page_with_visible_template_button.tsx",
  "app\page.backup.tsx"
)
foreach ($rel in $oldFiles) {
  $path = Join-Path $root $rel
  if (Test-Path $path) {
    Remove-Item $path -Force
    Write-Host "Removed old helper file: $rel" -ForegroundColor Yellow
  }
}
Get-ChildItem (Join-Path $root "app") -Filter "page.backup.engineering-templates-*.tsx" -ErrorAction SilentlyContinue | ForEach-Object {
  Remove-Item $_.FullName -Force
  Write-Host "Removed old backup file from app/: $($_.Name)" -ForegroundColor Yellow
}

$page = Get-Content $pagePath -Raw -Encoding UTF8
$original = $page

# 1) Replace the old Project Tree navigation button with Engineering Templates.
$oldNavPattern = '(?s)\s*<button\s+type="button"\s+style=\{\{\s*\.\.\.styles\.navBtn,\s*background:\s*section\s*===\s*"projectStructure"\s*\?\s*"#0f172a"\s*:\s*"#fff",\s*color:\s*section\s*===\s*"projectStructure"\s*\?\s*"#fff"\s*:\s*"#0f172a",\s*\}\}\s*onClick=\{\(\)\s*=>\s*setSection\("projectStructure"\)\}\s*>\s*עץ פרויקט\s*</button>'
$newNav = @'
        <button
          type="button"
          style={{
            ...styles.navBtn,
            background: "#fff7ed",
            color: "#92400e",
            borderColor: "#f59e0b",
          }}
          onClick={() => {
            window.location.href = "/engineering-templates";
          }}
        >
          🏗️ ספריית תבניות / עץ פרויקט חדש
        </button>
'@
$page2 = [regex]::Replace($page, $oldNavPattern, $newNav, 1)
if ($page2 -eq $page) {
  Write-Host "Warning: exact old navigation button was not found. Trying label-only fallback..." -ForegroundColor Yellow
  $page2 = $page -replace 'עץ פרויקט', '🏗️ ספריית תבניות / עץ פרויקט חדש'
}
$page = $page2

# 2) Replace the old visible ProjectStructureSection screen with a lightweight redirect card.
$oldSectionPattern = '(?s)\{section\s*===\s*"projectStructure"\s*&&\s*\(\s*<ProjectStructureSection\s+nodes=\{currentProjectStructureNodes\}\s+plans=\{currentProjectPlans\}\s+form=\{projectStructureForm\}\s+editingId=\{editingProjectStructureNodeId\}\s+canWrite=\{canWriteAccess\(projectAccess\)\}\s+onChange=\{\(patch\)\s*=>\s*setProjectStructureForm\(\(prev\)\s*=>\s*\(\{\s*\.\.\.prev,\s*\.\.\.patch\s*\}\)\)\s*\}\s+onSave=\{saveProjectStructureNode\}\s+onEdit=\{editProjectStructureNode\}\s+onDelete=\{deleteProjectStructureNode\}\s+onReset=\{resetProjectStructureForm\}\s+onGenerateFromPlans=\{generateProjectStructureFromPlans\}\s*/>\s*\)\}'
$newSection = @'
{section === "projectStructure" && (
            <section dir="rtl" style={{ padding: 24, border: "1px solid #e2e8f0", borderRadius: 18, background: "#fff" }}>
              <h2 style={{ marginTop: 0, color: "#0f172a", fontWeight: 950 }}>ספריית תבניות / עץ פרויקט חדש</h2>
              <p style={{ color: "#475569", fontWeight: 750, lineHeight: 1.8 }}>
                עץ הפרויקט הישן הוחלף במודול ספריית תבניות הנדסיות. שם ניתן לבחור מבנה כביש, קיר תומך, תעלת ניקוז, קו ניקוז, שוחה, מעביר מים, מסלעה, תאורה וגינון.
              </p>
              <button
                type="button"
                style={{ ...styles.primaryBtn, marginTop: 10 }}
                onClick={() => {
                  window.location.href = "/engineering-templates";
                }}
              >
                פתח ספריית תבניות
              </button>
            </section>
          )}
'@
$page3 = [regex]::Replace($page, $oldSectionPattern, $newSection, 1)
if ($page3 -eq $page) {
  Write-Host "Warning: exact ProjectStructureSection block was not found. Existing internal code was left untouched." -ForegroundColor Yellow
}
$page = $page3

# 3) Update user-facing old text references in warnings only.
$page = $page.Replace('עדיין לא הוגדר עץ פרויקט. ניתן להוסיף אותו בלשונית “עץ פרויקט”.', 'עדיין לא הוגדר שיוך מיקום. ניתן לבנות עץ דרך ספריית התבניות החדשה.')
$page = $page.Replace('עדיין לא נשמר עץ פרויקט. יש ליצור ולשמור אותו בלשונית „עץ', 'עדיין לא נשמר שיוך מיקום. יש לבנות עץ דרך ספריית התבניות החדשה')
$page = $page.Replace('פרויקט”.', '')

if ($page -eq $original) {
  Write-Host "Warning: page.tsx was not changed. New route was created, but menu may still be old." -ForegroundColor Yellow
} else {
  Set-Content $pagePath $page -Encoding UTF8
  Write-Host "page.tsx patched successfully." -ForegroundColor Green
}

Write-Host "Done. Now run:" -ForegroundColor Green
Write-Host "npm run build" -ForegroundColor White
Write-Host "git status" -ForegroundColor White
Write-Host "git add app" -ForegroundColor White
Write-Host "git commit -m \"Replace project tree with engineering templates\"" -ForegroundColor White
Write-Host "git push" -ForegroundColor White

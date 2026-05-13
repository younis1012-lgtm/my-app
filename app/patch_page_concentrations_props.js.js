const fs = require("fs");
const path = require("path");

const pagePath = path.join(__dirname, "page.tsx");

let text = fs.readFileSync(pagePath, "utf8");

text = text.replace(
  /<ConcentrationsSection([^>]*)\/>/g,
  `<ConcentrationsSection
        projectData={projectData}
        suppliers={suppliers}
        nonConformances={nonConformances}
        asphaltTests={asphaltTests}
        densityTests={densityTests}
        trialSections={trialSections}
        materials={materials}
        supervisionReports={supervisionReports}
        concreteTests={concreteTests}
        upperInspectionReports={upperInspectionReports}
        laboratoryTests={laboratoryTests}
        calibrations={calibrations}
        employees={employees}
        workPlans={workPlans}
        />`
);

fs.writeFileSync(pagePath, text);

console.log("page.tsx updated successfully");
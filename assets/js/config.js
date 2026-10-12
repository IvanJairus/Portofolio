/*
   The identity this page uses. The only file that needs to be touched
   for personalization. No company internal data lives in this file.
*/

window.PROFILE = {
  name: "Ivan Jairus",
  monogram: "IJ",
  role: { en: "DevSecOps" },
  location: "Jakarta, Indonesia",
  email: "Filemonivanjairus@gmail.com",
  links: [
    { id: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/in/ivan-jairus/" },
    { id: "github", label: "GitHub", href: "https://github.com/IvanJairus" },
    { id: "pipeline", label: "Pipeline reference", href: "https://github.com/IvanJairus/Pipeline" },
    { id: "dashboard", label: "Release board reference", href: "https://github.com/IvanJairus/release-dashboard" }
  ],

  /* Work history. Add new objects when needed.
     company is written generically because this page is fully sanitized.
     Every text field is shaped { en: ... } because main.js reads through
     pick(), and this page is now fixed to one language.
     Example of an extra entry:
     {
       period: { en: "2020–2022" },
       title:  { en: "DevOps Engineer" },
       company:{ en: "Company name" },
       points: { en: ["One sentence of impact."] }
     }
  */
  experience: [
    {
      period: { en: "2024–present" },
      title: { en: "DevSecOps" },
      company: { en: "State-owned banking group, Indonesia" },
      points: {
        en: [
          "Own CI/CD for a wholesale banking platform: one pipeline standard shared by 53 services across two CI engines.",
          "Built the release control plane and the ChatOps orchestrator that drives branch, merge, deploy and scan workflows from issue boards.",
          "Codified the pipeline standard and the security gates (SAST, container scan, SBOM, quality gate) enforced on every merge.",
          "Set up and administer the internal artifact store every build must resolve through: Maven and npm, proxy, hosted and group repositories.",
          "Designed the platform architecture and delivery workflows end-to-end: gateway routing, stage contracts, environment promotion and the release ledger.",
          "Mentored and onboarded new engineers, and transferred ownership of the four projects I held, with architecture docs and runbooks, so the platform outlives any single owner.",
          "Built and maintained the delivery layer that came before GitLab-native automation: dozens of Jenkins shared-library steps wiring Jira webhooks to GitLab (branch, MR, approve, merge, deploy) across SIT, UAT and PROD, later consolidated into one GitLab board + GitLab CI standard."
        ]
      }
    },
    {
      /* Period before the current role. The three items below come from the
         owner's CV (Backend Developer, January 2022 to January 2024), only
         copied into the site language; company names stay sanitized like the roles above. */
      period: { en: "2022–2024" },
      title: { en: "Backend Developer" },
      company: { en: "State-owned banking group, Indonesia" },
      points: {
        en: [
          "Built backend services in Java Spring Boot and Python.",
          "Ran deployments on OpenShift and OpenFaaS with a continuous-deployment approach, cutting downtime and shortening the path from code to running service.",
          "Pushed code quality through testing and SonarQube on the merge path, leaving cleaner codebases and less technical debt behind."
        ]
      }
    }
  ]
};

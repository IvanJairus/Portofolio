/*
   Identitas yang dipakai halaman ini. Satu-satunya file yang perlu disentuh
   untuk personalisasi. Tidak ada data internal perusahaan di file ini.
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

  /* Riwayat kerja. Tambah objek baru bila perlu.
     company ditulis generik karena halaman ini disanitasi penuh.
     Setiap field teks berbentuk { en: ... } karena main.js membaca lewat
     pick(), dan halaman ini sudah tetap di satu bahasa.
     Contoh entri tambahan:
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
      /* Periode sebelum peran saat ini. Ketiga butir di bawah diambil dari
         CV pemiliknya (Backend Developer, Januari 2022 - Januari 2024), hanya
         disalin ke bahasa situs; nama perusahaan tetap disanitasi seperti peran di atas. */
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

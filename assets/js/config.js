/* ============================================================
   IDENTITY CONFIG — data pribadi Ivan Jairus
   ------------------------------------------------------------
   Satu-satunya file yang perlu disentuh untuk personalisasi.
   Tidak ada data internal perusahaan di file ini.
   ============================================================ */

window.PROFILE = {
  name: "Ivan Jairus",
  monogram: "IJ",
  role: {
    en: "Senior DevOps / DevSecOps Engineer",
    id: "Senior DevOps / DevSecOps Engineer"
  },
  location: "Jakarta, Indonesia",
  email: "Filemonivanjairus@gmail.com",
  links: [
    { id: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/in/ivan-jairus/" }
  ],

  /* Riwayat kerja — tambah objek baru bila perlu.
     company ditulis generik karena halaman ini disanitasi penuh.
     Contoh entri tambahan:
     {
       period: { en: "2022 — 2024", id: "2022 — 2024" },
       title:  { en: "DevOps Engineer", id: "DevOps Engineer" },
       company:{ en: "Company name", id: "Nama perusahaan" },
       points: { en: ["One sentence of impact."], id: ["Satu kalimat dampak."] }
     }
  */
  experience: [
    {
      period: { en: "2024 — Present", id: "2024 — Sekarang" },
      title: {
        en: "Senior DevOps / DevSecOps Engineer",
        id: "Senior DevOps / DevSecOps Engineer"
      },
      company: {
        en: "State-owned banking group, Indonesia",
        id: "Grup perbankan BUMN, Indonesia"
      },
      points: {
        en: [
          "Own CI/CD for a wholesale banking platform: one pipeline standard shared by 40+ repositories across two CI engines.",
          "Built the release control plane and the ChatOps orchestrator that drives branch, merge, deploy and scan workflows from issue boards.",
          "Codified a 52-rule pipeline standard and the security gates (SAST, container scan, SBOM, quality gate) enforced on every merge.",
          "Designed the platform architecture and delivery workflows end-to-end: gateway routing, stage contracts, environment promotion and the release ledger.",
          "Mentored and onboarded new engineers, and transferred ownership of the four projects I held — with architecture docs and runbooks — so the platform outlives any single owner.",
          "Built and maintained the delivery layer that came before GitLab-native automation: 46 Jenkins shared-library steps wiring Jira webhooks to GitLab (branch, MR, approve, merge, deploy) across SIT, UAT and PROD — later consolidated into one GitLab board + GitLab CI standard."
        ],
        id: [
          "Memegang CI/CD platform perbankan wholesale: satu standar pipeline dipakai 40+ repositori di dua CI engine.",
          "Membangun release control plane dan orchestrator ChatOps yang menjalankan alur branch, merge, deploy, dan scan dari issue board.",
          "Mengodifikasi standar pipeline 52 aturan beserta security gate (SAST, container scan, SBOM, quality gate) yang wajib lolos di setiap merge.",
          "Mendesain arsitektur platform dan workflow delivery end-to-end: routing gateway, kontrak stage, promosi environment, dan ledger rilis.",
          "Membimbing dan onboarding engineer baru, serta mentransfer kepemilikan empat project yang saya pegang — lengkap dengan dokumen arsitektur dan runbook — agar platform tidak bergantung pada satu orang.",
          "Membangun dan merawat lapisan delivery sebelum otomasi GitLab-native: 46 step Jenkins shared-library yang menyambungkan webhook Jira ke GitLab (branch, MR, approve, merge, deploy) di SIT, UAT, dan PROD — yang kemudian dilebur ke satu standar GitLab board + GitLab CI."
        ]
      }
    }
  ]
};

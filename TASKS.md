# FieldCheck — Task List

Last updated: 27 May 2026

---

## 🔴 Active / Next Up

- [ ] **localStorage save key fix** — key saves by Rentman prefix only, not unit ID. One-line change in `checklist.js`. Unit ID field may be empty when steps are first actioned, which breaks auto-save.
- [ ] **QA pass — all checklist pages** — test each live page on phone: steps, flag reasons, records, PDF generation, Rentman filename. BR600 in particular has structural changes (winter mode, spark arrestor removed).

---

## 🟡 In Progress / Parked

- [ ] **GitHub Pages caching issue** — completion header still showing on live site despite being removed from HTML. Likely a CDN cache delay. Check again before investigating further.

---

## 🟢 Fieldcheck — Upcoming Build

- [ ] **PWA manifest and service worker** — deferred until testing complete. Enables home screen install and offline use.
- [ ] **ADDING-CHECKLISTS.md** — document the process for adding a new checklist to the repo. Write once build is stable.
- [ ] **Petrol Pump checklist** — blocked until PetrolPump SOP is ratified in spreadsheet.
- [ ] **Remaining "coming soon" checklists** — SB200, SB200 Booster, SnowPro, Lance, De-Duster, Generator, Air Compressor, Bore Pump, MEGAVAC, Standard Tool Kit, Wax Rig, Wax Safety Kit. Each blocked until corresponding SOP is ratified.
- [ ] **Multi-unit session switcher** — deferred until localStorage is stable. Allows multiple in-progress checklists simultaneously.

---

## 🟢 Spreadsheet — Pending SOPs

- [ ] **Bore Pump** (Lowara 5SC) — not yet written
- [ ] **Boosters** — not yet written
- [ ] **SnowPro** — not yet written
- [ ] **Wax Rig** — not yet written
- [ ] **Petrol Pump** (Honda WB30XT) — not yet written
- [ ] **Dressing Hoses** — not yet written
- [ ] **MEGAVAC** — verify ratification status
- [ ] **SB200** — verify ratification status post v1.4
- [ ] **PAT-only template** — needed for: Wax Melt Pot, power cables/adaptors/extensions, electrical items in Standard Tool Set
- [ ] **Standard Tool Set detail sheet** — review required
- [ ] **O-ring replacement step** — future review pass, add to all relevant SOPs

---

## 🟢 Productisation / Consultancy

- [ ] **index.html template** — create a stripped `index-template.html` with placeholder text for use as the starting point for new client deployments
- [ ] **Client delivery checklist** — document the steps to spin up FieldCheck for a new client (copy folder, customise index.html, write checklist HTMLs from SOPs)
- [ ] **Formalise three-tier pricing model** — fixed build fee + light-touch advisory retainer
- [ ] **Consultancy website** — ongoing copy and content refinement at tomfisher-systems.github.io
- [ ] **Market outreach** — AV hire forums, PSA Group, Rentman user community, regional direct outreach

---

## ✅ Recently Completed

- [x] Spreadsheet changelog updated — v1.3 and v1.4 entries added retrospectively (v1.5 released 27 May 2026)
- [x] All five checklist HTML files rebuilt to spray head format (required fields, flag reasons, correct N/A attribution, SOP version in header)
- [x] BR600 corrected to spreadsheet v1 state — spark arrestor removed, winter mode added as BR04
- [x] branch-1 merged to main on GitHub
- [x] checklist.js and style.css confirmed free of FX Live-specific content — engine is generic/reusable

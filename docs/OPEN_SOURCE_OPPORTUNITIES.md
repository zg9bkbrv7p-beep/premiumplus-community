# Open-source construction and design software to evaluate

> Research shortlist, 2026-11-03. **This document is a review plan, not an authorization to copy code, alter the live Commercial application, or deploy.** Verify upstream licenses, copyright notices, version history, dependencies and asset rights before implementation.

## What PREMIUM+ already has

The public Community Edition currently includes an application for projects, proposal/PDF imports, photo workflows, decisions/changes, and basic 2D/3D design. It uses React, Three.js, pdf-lib, Express and a Node/TypeScript stack. The Commercial staging app is separate, not identified as an exact mirror of any private GitHub repository.

The desired architecture remains: **property/photo or blueprint → scope and quantities → priced proposal → homeowner approval → Live Project → updates/change orders**.

## Candidate comparison

| Candidate | Code | Verified upstream license | What to evaluate | Suitability |
| --- | --- | --- | --- | --- |
| **OpenTakeoff** | https://github.com/Kentucky-ai/opentakeoff | AGPL-3.0 (upstream README identifies AGPL-3.0-only; check extra notice/attribution terms) | PDF/image plan measurement; per-sheet scale; area/LF/quantity takeoff; reviewable geometry; marked-up PDF and CSV exports | **First investigation for Community Edition**; do **not** directly incorporate into private Commercial without assessing AGPL network-source obligations |
| **openPlan3D** | https://github.com/laanlabs/openPlan3D | MIT | Walls, doors/windows, dimensions, snapping, 2D-to-3D transitions, mobile interactions, undo/redo | **First investigation for VISION**; SvelteKit differs from our React stack, so isolate reusable algorithms and honor MIT notices rather than replacing our renderer |
| **OpenFieldPro** | https://github.com/niko4244/openfieldpro | AGPL-3.0-only in actual LICENSE | Crew dispatch, service history, calendars, work orders, job status and technician mobile tools | Strong workflow reference for Community Edition; do not transplant entire Fastify/Next/Expo stack |
| **Cornerstone** | https://github.com/steilerDev/cornerstone | AGPL-3.0 (current main LICENSE and README) | Construction diaries, jobsite photo markup, Gantt timelines, cost tracking, backups/restore | Useful project lifecycle reference; independent architecture and licensing review required |
| **Aedifex** | https://github.com/TangSY/aedifex | MIT | React/Three.js walls, architectural design interaction, editor affordances | Potential focused VISION ideas; don't enable paid AI, WebGPU-only features, or external photo transfer by default |
| **BuildSuite Core** | https://github.com/BuildSuite-io/buildsuite_core | MIT for core code; its required ERPNext/Frappe ecosystem has separate licensing | Bill of quantities, rate library, subcontractor measured billing and progress tracking | More relevant as a construction-data model reference than as a drop-in dependency |

## Recommended feature order

### 1 — Calibrated takeoff from uploaded plans (Community Edition)

- After a contractor imports a plan PDF, let them set/check the scale against a known dimension.
- Measure **linear feet** (fencing/baseboards), **square feet** (roofing/flooring/painting) and counts (posts/gates).
- Preserve quantities, sheet/page, units, calibration, waste allowance and human review status.
- Add the verified quantities to proposal line items **only when the contractor confirms**; never automatically overwrite an accepted proposal.
- Test incorrect scale, cropped sheets, mobile gesture handling, tiny openings, and multipage documents.

**Licensing gate:** Read OpenTakeoff's AGPL and NOTICE/section 7(b) obligations first. For private Commercial, either make an independently implemented feature based on permitted concepts or seek a separate upstream license; do not silently paste AGPL code.

### 2 — Better existing 2D/3D property editor

- Inspect openPlan3D and Aedifex for scale consistency, wall/opening parametrization, pointer/touch controls, selection/drag thresholds and import/export.
- Keep the existing Three.js renderer and forest-green/ivory design. This is not a ground-up replacement.
- Make numeric dimensions match displayed geometry and maintain reliable undo/redo/dirty-state guards.
- VISION is **contractor-only**; don't add a homeowner 3D account or dashboard.
- Do not send real property photos to third parties.

### 3 — Contractor operations and homeowner handoff

- Job calendar with crew assignments and milestones.
- Daily site log and annotated project photos.
- Clear approval/change-order timeline linked to the original proposal.
- Retain homeowner/private-role separation and test cross-company data isolation.

## Codex review task

> Read AGENTS.md, README.md and docs/OPEN_SOURCE_OPPORTUNITIES.md. Compare existing PREMIUM+ Community Edition implementation with OpenTakeoff, openPlan3D, OpenFieldPro, Cornerstone, and Aedifex. Do **not** copy external code yet. Identify the minimum safe improvement with a file-level plan, license/attribution assessment, data migration impact, security concerns, iPhone touch test plan, and regression tests. First report recommendations **read-only**. Do not deploy, enable paid APIs or change the private Commercial application. Await explicit approval for any implementation.

## Commercial versus Community license boundary

- **MIT** code can generally be incorporated with copyright/license notices preserved; verify all included fonts, models, images and dependencies independently.
- **AGPLv3** is suitable for the open-source Community Edition when its conditions are respected. Embedding AGPL code into a network-served **private Commercial** product can trigger obligations to offer corresponding source code to users; do not proceed without a specific licensing decision.
- Some projects provide public code with a *different* license in individual components; check the exact file/tree and dependency licenses rather than relying on GitHub's license badge.
- Look at code for comparison. Do not clone a competitor's visual identity or proprietary assets.

## Verification gates

1. Choose exactly one feature and open a feature branch.
2. Prove permission/license compatibility and preserve attribution.
3. Design for fictional test data and no paid API requirement.
4. Validate privacy and role boundaries.
5. Run `npm run verify:offline`, `npm run build`, `npm test`, `npm run test:e2e:webkit`, and `npm audit --omit=dev --audit-level=high`.
6. Review the pull request and verify iPhone Safari and backup/restore before real customer use.

All upstream links are references, **not dependencies installed in PREMIUM+**.

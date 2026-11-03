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

## Rendering engines worth auditing — 2026-11-03

**Two distinct needs:** VISION's accurate 3D model rendering is not the same thing as generating a proposed remodel from a single photograph. Neither should silently replace the current editing interface.

| Engine | Source | License (upstream GitHub) | Use in PREMIUM+ | Constraints |
| --- | --- | --- | --- | --- |
| **three-gpu-pathtracer** | https://github.com/gkjohnson/three-gpu-pathtracer | **MIT** | Upgrade realistic lighting, reflections, shadows, materials and **still export** from existing Three.js scenes | Uses WebGPU in current upstream version; high GPU cost, progressive convergence, material compatibility limits; preserve existing renderer as interactive fallback |
| **Khronos glTF Sample Viewer** | https://github.com/KhronosGroup/glTF-Sample-Viewer | **Apache-2.0** | Reference for accurate physically-based glTF material handling and exposure controls | More a rendering reference than a finished remodeling editor |
| **InvokeAI** | https://github.com/invoke-ai/InvokeAI | **Apache-2.0** for application; check each model's license | Separate optional **photo-to-remodel** inpainting/image-to-image service with brush-selected areas, preservation masks, and before/after review | Requires model weights + GPU compute; not a free rendering API, not automatically reliable for exact structural changes |
| **ComfyUI** | https://github.com/Comfy-Org/ComfyUI | **GPL-3.0** for application; model and node rights vary | Alternative separate self-hosted photo rendering and automation workflow | Higher integration/operations complexity; GPL review and third-party node/model licenses; optional paid nodes must remain disabled |
| **Blender / Cycles** | https://www.blender.org/ and https://www.cycles-renderer.org/ | Blender **GPL**; Cycles standalone **Apache-2.0** per Cycles project | Future batch-quality 3D export/snapshots after calibrated scene geometry is validated | CPU/GPU render host needed; browser does not magically run Blender's full workflow |

### Preferred experiment: no surprise charges, no renderer replacement

1. **VISION 3D:** test `three-gpu-pathtracer` on a **separate copy of one fictional 3D scene**. Keep interactive Three.js editor untouched. Add an optional **Render still** control only after WebGPU feature detection, clean fallbacks, performance tests, memory caps and mobile iPhone Safari verification. Safari 26+ supports WebGPU, but performance and supported materials still need testing.
2. **Photo Preview:** research InvokeAI as an **optional, separately hosted image-render worker**, with explicit permission before uploading an image, before/after preservation, selective masks, and local/manual color preview as no-GPU fallback. Never advertise photo edits as structural measurements or permit-grade plans.
3. **Hardware and licensing gates:** application code licenses are not equivalent to generation-model weight licenses. Verify code copyright, assets, model weights, privacy, GPU capacity, costs, and service isolation before installing or shipping.
4. **Scope:** no paid AI, remote inference, cloud deployment, or new homeowner VISION dashboard without explicit user approval. VISION remains contractor-only; main Live Project keeps homeowner decisions.

### Codex's first rendering task (read-only)

> Read AGENTS.md and docs/OPEN_SOURCE_OPPORTUNITIES.md. Inspect the current VISION Three.js renderer and Photo Preview. Compare the real source architecture with three-gpu-pathtracer and InvokeAI. Recommend the smallest **optional**, reversible rendering upgrade, giving specific files, a license audit, WebGPU/iPhone fallback strategy, quality examples, privacy/data-flow risks, GPU hosting costs, automated tests and a proof-of-concept plan using only fictional scenes. **Do not install dependencies, copy code, commit, deploy, or connect paid AI.** Do not assume this public Community Edition is the live Commercial app.

## New FLUX 3 Image Klein comparison — November 3, 2026

**Newer model identified from BFL's official website:** [FLUX 3 Image Klein](https://bfl.ai/models/flux-3-image-klein), released October 15, 2026.

- [Official model weights](https://huggingface.co/black-forest-labs/flux-3-image-klein), [reference inference code](https://github.com/black-forest-labs/flux-3-image-klein), and [release information](https://bfl.ai/blog/flux-3-image-klein).
- 5.6B image transformer, multi-reference editing with up to 10 photos, and bounding-box layout instructions for where to add or edit features. **Bounding boxes are not a hard pixel-preservation mask**; quality and geometry preservation must be tested with fictional contractor photos.
- **Licenses are different:** the inference *code* is Apache-2.0, while the model *weights* use the FLUX Kommunity License. BFL says qualifying individual/business users under **US $5M gross annualized revenue** may use the weights commercially under specific conditions. Do not describe this model as unrestricted Apache/open-source, or bundle its weights before reviewing full license terms.
- BFL's API offers advanced preservation features and 1K image pricing around **US $0.009/image** (as advertised November 3, 2026); paid API, third-party photo processing, and new costs require explicit approval. Self-hosting still needs GPU and secure processing.
- Earlier recommendation [FLUX.2 klein 4B](https://huggingface.co/black-forest-labs/FLUX.2-klein-4B) is **Apache-2.0-licensed weights**, appropriate for a more permissive, reproducible Community Edition prototype.
- **Revised recommendation:** evaluate FLUX 3 Image Klein (latest image-editing feature candidate) alongside FLUX.2 klein 4B (simpler license). Do a read-only comparison and fictional-photo benchmark before choosing an integration. Keep existing Photo Preview and Three.js editor; no models/paid services are installed.

### New Codex review question

> Compare FLUX 3 Image Klein against FLUX.2 klein 4B for the existing PREMIUM+ Photo Preview, specifically preservation of roofline, doors, windows, and background; region selection/bounding boxes; iPhone upload/output UX; model license restrictions; private-photo consent; and GPU or API cost. Use documented public references and fictitious test plans only. Return a file-level integration design without modifying the app, deploying, or downloading model weights.

## Recommended first photo-rendering proof of concept — November 3, 2026

**Decision for evaluation, not installation: FLUX.2 [klein] 4B (distilled 4-step) + a separately hosted ComfyUI workflow.**

This is a practical first test for a contractor taking an iPhone photo and visualizing an updated room, wall, fence, or exterior. The image editing model is not the 3D path tracer. Start with the smallest reversible prototype in the **public Community Edition only**, using fictional photographs.

### Sources reviewed

- Model weights and terms: https://huggingface.co/black-forest-labs/FLUX.2-klein-4B — **Apache-2.0**, image-to-image and multireference editing, official inference guidance ~13 GB VRAM (configuration dependent).
- Official reference implementation: https://github.com/black-forest-labs/flux2 — 4B Apache-2.0, 9B / dev editions use different, noncommercial licenses. Do **not** swap editions casually.
- ComfyUI ready-to-run image editing workflows: https://blog.comfy.org/p/flux2-klein-4b-fast-local-image-editing — distilled 4B supports short, iterative edits; example performance from a high-end RTX 5090 is **not** representative of a phone or low-cost VPS.
- ComfyUI engine: https://github.com/Comfy-Org/ComfyUI — **GPL-3.0** software, not Apache-2.0. Review compatibility and obligations if distributing or combining code. Prefer a private, separately hosted inference service rather than embedding upstream ComfyUI source into the current Commercial app.
- Quality fallback for later review: https://huggingface.co/Qwen/Qwen-Image-Edit-2511 — Apache-2.0 but a much larger 20B editing model (model repo roughly 57.7 GB); evaluate only if FLUX.2 4B fails quality/geometry tests.

### Proposed contractor UX

1. Contractor opens an existing project -> Photo Preview -> **Render Concept (optional)**.
2. Capture or upload an original photo; save immutable original in a private per-company project record.
3. Optionally brush a mask for a wall, fence, floor, roof, or cabinet; preserve the rest as much as possible.
4. Pick a project-specific prompt and optional material/reference photo.
5. Explicitly consent to processing and show a projected GPU-job cost (if any) before execution.
6. Authenticated PREMIUM+ server submits a job to a separate GPU worker and returns a job ID. Do not expose ComfyUI's ports/API to the public.
7. View output as **AI design concept** with before/after slider; allow reject, re-render, or save to project documents. It does not change estimate, contract, or approval automatically.
8. Fall back to existing manual color/finish study when no renderer, GPU, network, or budget is available.

### Must prove before implementing

- Mask locality: does the generated image unexpectedly change doors, windows, walls, perspective, people, or structures? Label design concepts as visual only, not structural truth.
- iPhone: capture, orientation, HEIC conversion, previews, upload progress, retry/cancel, and low-bandwidth experience. iPhone does *not* run the model; it is the front end.
- Server: auth, per-company access isolation, upload limits, content scanning as appropriate, timeouts/queue/cancellation, private image storage and retention/deletion controls, consent to any remote provider.
- Budget: benchmark actual GPU time and storage before committing to a hosting price. "Free weights" do not mean "free rendering compute".
- Licensing: Apache-2.0 model, GPL-3.0 ComfyUI engine, any node/LoRA/upscaler/model dependencies; preserve notices and distinguish networked service versus copied derivative.
- No paid account, inference, hosting, auto-deployment or production integration is authorized by this research.

### Copy/paste first Codex task

> READ-ONLY: Audit current public PREMIUM+ Community Edition Photo Preview and existing server architecture against a hypothetical optional FLUX.2 [klein] 4B image editing worker in ComfyUI. Keep existing UI/Three.js and all Commercial services unchanged. Report precise file touchpoints, how masks/reference photos should flow, secure image job API boundary, a standalone mock response, isolated licensing obligations (Apache-2.0 and ComfyUI GPL-3.0), iPhone Safari tests, GPU cost assumptions, and sample prompts for fictional interiors/exteriors. Do not install dependencies, send photos, create cloud resources, modify code, or deploy. Wait for explicit feature implementation approval.

## Verification gates

1. Choose exactly one feature and open a feature branch.
2. Prove permission/license compatibility and preserve attribution.
3. Design for fictional test data and no paid API requirement.
4. Validate privacy and role boundaries.
5. Run `npm run verify:offline`, `npm run build`, `npm test`, `npm run test:e2e:webkit`, and `npm audit --omit=dev --audit-level=high`.
6. Review the pull request and verify iPhone Safari and backup/restore before real customer use.

All upstream links are references, **not dependencies installed in PREMIUM+**.

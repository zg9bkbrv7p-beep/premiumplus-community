# Black Forest Labs (bfl.ai) — vendor audit for PREMIUM+ Photo Preview
_Date reviewed: 2026-11-03. Public documentation review only. No API key, GPU service, model downloads, paid credits, code changes or customer photographs were used._

## Decision

**Suitable for a fictional-photo proof of concept, but not authorized yet for real customer-photo processing or production deployment.**

The feature required is **photo-to-remodel concept**, not a Three.js scene renderer: take a project photo on iPhone, edit a contractor-selected area (e.g., fence, wall, cabinets, flooring), show before/after, and optionally attach an explicitly labeled AI concept to a project.

### Verified offerings

| Product | BFL hosted price, at approximate 1K output | Capabilities | License/integration |
|---|---:|---|---|
| FLUX 3 Image Klein | **$0.009 per generated image** | Fast 5.6B text/image editing, 10 references, prompt-enhanced bounding-box edit instructions; GPU self-hosting possible | BFL API terms when hosted; **FLUX Kommunity License v1.0** when downloading weights; not unrestricted open-source weights |
| FLUX 3 Image | **$0.048 per generated image** | More advanced image editing, layout/bounding boxes, multi-reference and up-to-4K output | API; production license required for commercial self-hosted model weights |
| FLUX.2 Klein 4B | **from $0.014 per generated image** | Faster prior-generation image editing and generation; local self-host possible | 4B model weights **Apache-2.0** (verify exact component licenses and bundled dependencies) |

**Current direct BFL price page:** https://bfl.ai/pricing?category=flux+3+image . Prices may change, and the 768p/1K/1.5K/2K/4K tiers have different per-image costs. FLUX 3 Image Klein published tiers: $0.008 / $0.009 / $0.011 / $0.014 / $0.036 per image respectively. FLUX 3 Image published tiers: $0.041 / $0.048 / $0.07 / $0.10 / $0.607 respectively. Credits are paid, not free; self-hosting still incurs GPU/storage/electricity/hosting cost.

## Major findings and release gates

### R1 — Privacy / API content reuse — HIGH priority
BFL's **FLUX API Service Terms** section 2(b) grants BFL broad, perpetual rights to input and output to operate and improve services, including model training. This is materially different from promising that private homeowners' images remain confidential.

- Read: https://bfl.ai/legal/flux-api-service-terms
- Also review: https://bfl.ai/legal/developer-terms-of-service and https://bfl.ai/legal/privacy-policy
- **Do not submit real customer/property photographs by API until** the account's governing contract/opt-out or enterprise/DPA options, retention, customer permissions, rights, and internal privacy notice are expressly reviewed. A general website opt-out statement is not a substitute for resolving developer API terms in writing.
- Self-hosting a weight model on private infrastructure could avoid submitting photos to BFL's *hosted generation API*, but has its own hosting/security/license requirements.

### R2 — Model weights licensing — HIGH priority
The downloadable FLUX 3 Image Klein weights are **FLUX Kommunity License v1.0**, **not Apache-2.0**. The model license permits qualifying users under US$5M annualized gross revenue (including affiliates) to generate and use commercial outputs under restrictions; it does **not automatically authorize distributing, reselling or embedding weights inside any SaaS or customer download**.

- License text: https://huggingface.co/black-forest-labs/flux-3-image-klein/blob/main/LICENSE.md
- BFL commercial product page: https://bfl.ai/models/flux-3-image-klein
- BFL open-weights licensing: https://bfl.ai/open-weights
- The published **Builder** self-host license is for internal operations/marketing, **not client/downstream apps**. BFL lists **Platform** for SaaS products with end users and **Professional** for agencies serving named clients. Confirm intended use and precise terms with BFL before deploying to many contractors.
- FLUX.2 Klein **4B** weights are separately Apache-2.0: https://huggingface.co/black-forest-labs/FLUX.2-klein-4B . Do not confuse them with the 9B or FLUX 3 weights.

### R3 — Quality and physical accuracy — HIGH priority
BFL claims precise edits, but the demo is not independent proof that property geometry stays unchanged. **AI-generated architectural imagery is a visual design concept**, not measured construction drawings, permit-grade documentation or evidence that a proposed material will look exactly like the finished product.

Prototype acceptance tests:
- Photograph of a *fictional* fence: change vertical boards to horizontal cedar; preserve gate width/location, driveway, posts outside selected area, house backdrop, camera perspective.
- Photograph of a *fictional* kitchen: change cabinet fronts; preserve doors/windows/counter dimensions, lighting, appliance positions and room geometry.
- Compare BFL prompt-only edit, bounding-box edit, and a true mask/inpainting workflow if more precise preservation is needed.
- Review each output visually at full resolution and check for phantom doors, windows, altered dimensions and inconsistent shadows. Don't automatically alter scopes, proposals, legal warranties or project approvals from an AI image.

### R4 — Technical integration — MEDIUM priority
Official BFL API: https://docs.bfl.ai/flux_3/flux3_image_klein and https://docs.bfl.ai/api_integration/integration_guidelines

- For BFL-hosted Klein: authenticated **server-side** `POST https://api.bfl.ai/v1/flux-3-image-klein` with input reference(s) and prompt; **never expose API keys in browser/React code**.
- API responds asynchronously; use its returned `polling_url` until ready, obtain image promptly and store privately (the image-editing docs specify a one-hour output download window for FLUX 3 Image).
- Secure per-company/project access, content limits, queue retries, cancellation, cost quotas, and secret management. Use only private source-image storage and short-lived retrieval links.
- Preserve the original photo and a before/after slider; generated version clearly labeled as **AI-generated design concept**.
- Model may use an automatic **prompt upsampler** when called via BFL API. Local Klein requires its own prompt upsampler.
- iPhone is only the photo-capture/review client; GPU inference runs separately.

### R5 — Costs, access and product boundary — MEDIUM priority
- Model source access may be free or conditionally licensed; **API generation is paid per successful image**. No paid model/API/deployment should be connected without owner approval.
- Existing PREMIUM+ Commercial app and Railway storage must remain unchanged. Codex should audit Community Edition in its public repo only unless given an explicitly verified private Commercial source tree.
- Even open weights need compatible GPU, disk/VRAM, privacy controls and dependable hosting. A basic web app container isn't automatically a suitable image-GPU host.

### R6 — Marketing claims and limits — LOW priority
- BFL publishes security assurance claims (SOC 2 / ISO 27001) on its site; this audit did not independently inspect the certification reports, contractual scope or incident response.
- This audit used public BFL documentation and public model/legal terms. It is **not** a source-code security review, live API penetration test, actual output-quality benchmark, pricing guarantee or legal opinion.

## Decision for next Codex task — READ ONLY

> Read AGENTS.md and docs/BFL_VENDOR_AUDIT_2026-11-03.md. Inspect our actual PREMIUM+ Community Edition Photo Preview files and back end. Propose a minimal reversible **photo-to-remodel provider interface**, with a no-cost mock provider first. Compare paid BFL FLUX 3 Image Klein API versus Apache-licensed FLUX.2 Klein 4B self-hosting; distinguish FLUX 3 Kommunity weights restrictions and production SaaS terms. Identify a per-company private upload/consent pipeline, server-side API key boundary, polling and private result storage, cost quotas, iPhone Safari before/after controls, quality fixture tests and safety checks. **Do not** install models, make paid API calls, change code, publish customer photos, deploy, or modify the private Railway Commercial app. Return a file-level plan and risks for approval.

## Primary official references
- https://bfl.ai/
- https://bfl.ai/models/flux-3-image-klein
- https://bfl.ai/models/flux-3-image
- https://bfl.ai/pricing?category=flux+3+image
- https://bfl.ai/open-weights
- https://bfl.ai/legal/flux-api-service-terms
- https://bfl.ai/legal/developer-terms-of-service
- https://bfl.ai/legal/privacy-policy
- https://huggingface.co/black-forest-labs/flux-3-image-klein/blob/main/LICENSE.md
- https://docs.bfl.ai/flux_3/flux3_image_klein
- https://docs.bfl.ai/flux_3/flux3_image_bounding_boxes
- https://docs.bfl.ai/api_integration/integration_guidelines

_No integration or deployment has been performed in connection with this audit._

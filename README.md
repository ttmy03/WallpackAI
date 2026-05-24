# AI Wall Art Generator for Etsy Sellers

Last updated: 2026-05-24

This repository is a Codex-ready build specification for a SaaS app that helps Etsy sellers create print-ready digital wall-art packs.

## Core product promise

> Create Etsy-ready printable wall art packs in minutes: one artwork concept, multiple print ratios, high-resolution files, mockups, listing copy, tags, and a buyer instruction PDF.

## Why this is not a generic AI image generator

The app does not compete on "make any image". It competes on a complete seller workflow:

1. Guided wall-art prompt builder.
2. Safe commercial-style presets.
3. Print-size calculator.
4. Ratio conversion for common Etsy frame sizes.
5. Upscale/export pipeline to exact pixel dimensions.
6. Etsy-compatible file splitting.
7. Mockup and listing asset generation.
8. Quality checks before download.
9. AI-use disclosure helper.
10. Credits/subscriptions to control generation costs.

## Recommended MVP stack

- Frontend: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui.
- Auth/DB/Storage: Firebase Auth, Postgres, Firebase Storage.
- ORM: Prisma.
- Payments: Stripe Checkout + Stripe Billing Portal.
- AI image provider: Runware image inference behind a provider abstraction.
- Background jobs: Trigger.dev, Inngest, or a custom worker queue. Do not run image generation/export synchronously inside request/response routes.
- Image processing: Sharp for resize/crop/metadata, archiver for ZIP, pdf-lib or PDFKit for PDFs.

## Product names to consider

- WallPack AI
- EtsyPrint Studio
- PrintPack AI
- FrameReady AI
- WallArt Batch

Working name in all docs: `WallPack AI`.

## File map

| File | Purpose |
|---|---|
| `AGENTS.md` | Codex repository instructions. Put this at repo root. |
| `00_PRODUCT_BRIEF.md` | Product thesis, target users, positioning, MVP promise. |
| `01_MVP_SCOPE.md` | What to build first, what not to build yet. |
| `02_USER_FLOWS.md` | End-to-end flows from signup to Etsy download pack. |
| `03_TECH_STACK_AND_ARCHITECTURE.md` | Architecture, services, workers, storage, queues. |
| `04_DATA_MODEL.md` | Prisma/Postgres schema design. |
| `05_API_SPEC.md` | REST endpoints and payload contracts. |
| `06_IMAGE_GENERATION_PIPELINE.md` | Prompt-to-artwork generation pipeline. |
| `07_PRINT_EXPORT_SPEC.md` | DPI, sizes, ratio packs, ZIP strategy, Etsy limits. |
| `08_ETSY_LISTING_PACK_SPEC.md` | Mockups, listing title, description, tags, buyer instructions. |
| `09_PROMPT_SYSTEM_AND_PRESETS.md` | Prompt templates, style presets, IP guardrails. |
| `10_UI_UX_SPEC.md` | Routes, pages, components, states, empty/error states. |
| `11_PAYMENTS_CREDITS.md` | Pricing, credits, Stripe, cost controls. |
| `12_SECURITY_PRIVACY_COMPLIANCE.md` | Auth, storage, abuse prevention, AI/Etsy disclosure. |
| `13_QUALITY_ASSURANCE.md` | Tests, acceptance checks, image QA. |
| `14_ANALYTICS_AND_OBSERVABILITY.md` | Events, metrics, logs, job monitoring. |
| `15_IMPLEMENTATION_PLAN.md` | Step-by-step build order. |
| `16_CODEX_TASKS.md` | Copyable implementation tickets for Codex. |
| `17_ENVIRONMENT.md` | Env vars and local setup. |
| `18_SOURCE_RESEARCH.md` | Source-backed constraints used in the specs. |
| `19_POST_MVP_ROADMAP.md` | Features after MVP. |
| `PASTE_THIS_INTO_CODEX.md` | First prompt to give Codex in a fresh repo. |

## MVP definition

The MVP is successful when a user can:

1. Sign up.
2. Generate an artwork preview from guided inputs.
3. Select a preview.
4. Adjust focal point/crop for the main Etsy ratios.
5. Export an Etsy digital wall-art pack.
6. Download a ZIP containing:
   - high-resolution JPG print files,
   - a PDF buyer guide,
   - mockup/listing images,
   - listing copy and tags in text/CSV format.
7. Stay within credit limits and billing rules.

## Non-negotiable constraints

- Never promise sales, search rank, copyright ownership, or guaranteed Etsy approval.
- Do not support trademarked characters, celebrity likeness prompts, brand logos, living-artist style mimicry, or copyrighted franchise terms as presets.
- Always include an AI disclosure helper in generated Etsy description text.
- Do not export fake print-ready files that only have changed DPI metadata. Pixel dimensions must match the selected print size.
- Default to sRGB JPG for printable digital art. PNG is optional and should be used only when file size is acceptable.
- Respect Etsy digital file constraints: design for five digital download files, each under 20 MB.

## First Codex action

Open `PASTE_THIS_INTO_CODEX.md`, paste it into Codex, and ask it to create the initial Next.js project plus data model and core utilities.

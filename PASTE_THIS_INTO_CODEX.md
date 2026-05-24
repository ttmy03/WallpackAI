# Paste this into Codex

You are building `WallPack AI`, a SaaS app for Etsy sellers to create print-ready digital wall-art packs.

Read these files first:

1. `AGENTS.md`
2. `README.md`
3. `01_MVP_SCOPE.md`
4. `03_TECH_STACK_AND_ARCHITECTURE.md`
5. `04_DATA_MODEL.md`
6. `07_PRINT_EXPORT_SPEC.md`
7. `16_CODEX_TASKS.md`

Start with Task 1 from `16_CODEX_TASKS.md`.

Important product constraints:

- This is not a generic AI image generator.
- The core output is an Etsy-ready wall-art digital download pack.
- Etsy default export must fit up to 5 files, each under 20 MB.
- Exported print files need real pixel dimensions for final print size, not just 300 DPI metadata.
- Default ratios: 2:3, 3:4, 4:5, 5:7, 11:14. Optional ISO A-series later.
- Include AI disclosure helper in listing descriptions by default.
- Block protected brands, characters, logos, celebrities, and living-artist style mimicry.
- Use a provider abstraction for AI image generation.
- Use a credit ledger for cost control.
- Use async jobs for image generation and export.

Build order:

1. App skeleton.
2. Prisma schema and auth user sync.
3. Print math utilities and tests.
4. Prompt presets and guardrails.
5. Project wizard UI.
6. Mock image provider and generation job flow.
7. Runware image provider adapter.
8. Credit ledger.
9. Editor and ratio crop previews.
10. Export pack service.
11. Listing copy generator.
12. Stripe billing.
13. Observability and QA polish.

Do not implement direct Etsy publishing in MVP unless all manual export features are complete.

When you finish each step, run:

```bash
npm run lint
npm run typecheck
npm run test
```

If you need to make an assumption, choose the simplest production-safe approach and document it in code comments or a `docs/DECISIONS.md` entry.

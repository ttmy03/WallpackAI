# 22 Support Playbook

## Issue: Buyer says print is blurry

Ask:

1. Which file did they print?
2. What physical size did they print?
3. Which print service/printer did they use?
4. Did they upload the original JPG or a screenshot/preview?

Explain:

- The correct ratio file must match the frame size.
- Screenshots/previews are not print files.
- Very large prints may look softer up close.
- Printer settings and paper matter.

Support action:

- Verify exported dimensions in manifest.
- If dimensions are wrong, regenerate/refund credits.
- If dimensions are correct, provide buyer instruction clarification.

## Issue: Etsy upload says file too large

Check:

- ZIP file size.
- Individual file size.
- Number of digital files.

Action:

- Re-export with `Optimize for Etsy`.
- Lower JPG quality within allowed threshold.
- Remove mockups from buyer ZIP.
- Split across up to 5 ZIP files.
- Reduce max print size only if necessary.

## Issue: Generated image has text/logo/watermark

Action:

- Mark generation as quality failure if severe.
- Offer regeneration with stronger exclusions.
- Consider credit refund if prompt followed rules and output is unusable.

Engineering follow-up:

- Add artifact to QA examples.
- Strengthen prompt or post-generation classifier.

## Issue: User asks for Disney/Pokémon/celebrity/brand style

Response principle:

- Do not help create protected IP outputs.
- Offer generic alternatives.

Example:

```txt
I can't help generate artwork based on protected characters or brands. You can create an original fairytale-inspired or cute monster-inspired print instead.
```

## Issue: User asks whether they own copyright

Response principle:

- Do not give legal certainty.
- Encourage reviewing provider terms and local law.

Suggested app copy:

```txt
We can help create and prepare files, but we can't guarantee copyright ownership or marketplace approval. Please review the terms of the AI provider and Etsy, and consult a qualified professional for legal questions.
```

## Issue: Stripe payment succeeded but credits missing

Action:

1. Search Stripe customer by email.
2. Check webhook event delivery.
3. Check `CreditLedgerEntry` for invoice idempotency key.
4. Run manual sync if implemented.
5. Add admin credit adjustment if payment is verified.

## Issue: Export job stuck

Action:

1. Check job status and `updatedAt`.
2. Check worker logs.
3. If timeout exceeded, mark failed.
4. Refund reserved credits if no successful artifact.
5. Let user retry.

## Issue: User wants direct Etsy publishing

Response:

- Manual Etsy pack export is current flow.
- Direct draft publishing is planned after core export quality is stable.

## Issue: User wants quote art

Response:

- MVP is optimized for visual wall art without generated text.
- Quote art requires deterministic text rendering and licensed fonts.
- Add feature request tag.

## Refund/credit goodwill guidelines

Automatically refund credits when:

- provider failed,
- export failed,
- file dimensions wrong due to system bug,
- download artifact missing.

Consider goodwill credit when:

- severe artifact not detected by QA,
- repeated provider issues,
- beta feedback is useful.

Do not automatically refund when:

- user dislikes a technically valid image,
- user entered a vague prompt,
- user printed wrong ratio/size despite correct files.

## Internal debugging checklist

For any ticket collect:

- user email,
- project id,
- generation job id,
- export job id,
- artifact id,
- manifest JSON,
- provider request id,
- credit ledger entries,
- browser and OS if UI issue.

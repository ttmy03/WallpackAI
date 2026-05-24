# 18 Source Research

Last checked: 2026-05-24

These are the source-backed constraints used in the specs. Re-check before launch because platform policies and API capabilities can change.

## Etsy digital files

Source: Etsy Help, "How to Manage Your Digital Listings"

Key constraints:

- Digital items can be instant downloads or made-to-order downloads.
- Digital items listed in a store must be made and/or designed by the seller.
- Instant digital listing files: up to 5 digital files.
- Maximum size: 20 MB per file.
- Supported file types include JPG/JPEG, PNG, PDF, ZIP, TXT and others.
- File names are visible to buyers and have naming limits.
- Variations are not available for digital items.

URL:
https://help.etsy.com/hc/en-us/articles/115015628347-How-to-Manage-Your-Digital-Listings

## Etsy listing creation

Source: Etsy Help, "How to Create a Listing"

Key constraints:

- Listing photos/video are uploaded during listing creation.
- Listings can have up to 20 photos and 1 video.
- Listing title can be up to 140 characters.
- Digital files are added when listing type is digital.
- Variations are unavailable for digital listings.
- Tags: up to 13.

URL:
https://help.etsy.com/hc/en-us/articles/115015628707-How-to-Create-a-Listing

## Etsy tags

Source: Etsy Help, "How to Use Tags to Get Found in Search"

Key constraints:

- Up to 13 tags per listing.
- Each tag can contain up to 20 characters.
- Tags may include spaces, letters, numbers, and limited special characters.

URL:
https://help.etsy.com/hc/en-us/articles/360000336307-How-to-Use-Tags-to-Get-Found-in-Search

## Etsy listing images

Source: Etsy Help, "Requirements and Best Practices for Images in Your Etsy Shop"

Key constraints:

- Listing image file types include JPG, GIF, PNG, SVG, HEIC.
- Animated GIFs and transparent PNGs are not supported as expected; transparency can appear black.
- Listing photos should be at least 2000 px width and height when possible.

URL:
https://help.etsy.com/hc/en-us/articles/115015663347-Requirements-and-Best-Practices-for-Images-in-Your-Etsy-Shop

## Etsy fees

Source: Etsy Legal, "Fees & Payments Policy"

Key constraints:

- Listing fee: $0.20 USD per listing.
- Transaction fee: 6.5% of displayed listing price plus shipping/gift wrapping where applicable.
- Offsite ads fees may apply depending seller sales threshold and opt-out status.

URL:
https://www.etsy.com/legal/fees/

## Etsy creativity and AI

Sources:

- Etsy Legal, "Etsy's Creativity Standards"
- Etsy Seller Handbook, "What's Etsy's Stance on AI Creations?"

Key constraints:

- Etsy allows seller-prompted AI creations as "Designed by a seller" when based on the seller's original prompts.
- Sellers must disclose in listing description if an item is created with the use of AI.
- AI prompt bundles are prohibited.
- Etsy requires a human touch and reserves right to remove non-compliant listings.

URLs:
https://www.etsy.com/legal/creativity/
https://www.etsy.com/seller-handbook/article/1275449912004

## Etsy Open API v3 digital listing flow

Source: Etsy Open API v3 Listings Tutorial

Key future-integration notes:

- Creating a listing uses `createDraftListing`.
- Published listings require at least one listing image.
- Digital listing should set `type` to `download`.
- Digital product file upload is handled with `uploadListingFile` and cannot be assigned directly in `createDraftListing`.
- Uploading listing images is handled by `uploadListingImage`.
- API calls require OAuth token with appropriate scope and `x-api-key`.

URL:
https://developer.etsy.com/documentation/tutorials/listings/

## Print file recommendations

Sources:

- Printful wall art print file guide.
- Gelato poster optimization guide.
- Printify print file requirements and quality guide.

Key constraints:

- Printful recommends PNG/JPEG, sRGB, and 300 DPI for wall art print files.
- Gelato recommends at least 150 DPI at final print size, with 300 DPI ideal for sharp output.
- Printify recommends 300 DPI for JPEG/PNG, but notes DPI alone does not guarantee quality because resolution can be artificially increased.

URLs:
https://www.printful.com/create-digital-print-file
https://support.gelato.com/en/articles/9587689-optimizing-print-results-for-posters
https://help.printify.com/hc/en-us/articles/4483617936657-What-type-of-print-files-does-Printify-require
https://help.printify.com/hc/en-us/articles/4483601444113-How-do-I-get-a-high-quality-design-file

## Runware Image Inference and Seedream 4.5

Source: Runware API docs, image inference guide, connection/authentication guide, and Seedream 4.5 model reference.

Key implementation notes:

- Runware REST requests use `POST https://api.runware.ai/v1` with JSON task arrays.
- Authentication can use `Authorization: Bearer <API_KEY>`.
- Seedream 4.5 AIR ID is `bytedance:seedream@4.5`.
- Seedream 4.5 text-to-image requests should specify explicit `width` and `height`.
- Store Runware `taskUUID` and `imageUUID` for support.

URLs:
https://runware.ai/docs/getting-started/how-to-connect
https://runware.ai/docs/en/image-inference/introduction
https://runware.ai/docs/models/bytedance-seedream-4-5

## OpenAI Codex AGENTS.md

Source: OpenAI Codex docs, "Custom instructions with AGENTS.md"

Key notes:

- Codex reads `AGENTS.md` files before doing work.
- Repository-level `AGENTS.md` can provide project-specific rules.
- Files closer to current working directory override broader guidance.
- Default combined project doc size limit may require splitting large instructions.

URL:
https://developers.openai.com/codex/guides/agents-md

## Stripe Billing

Sources: Stripe docs

Key implementation notes:

- Checkout Sessions support one-time purchases or subscriptions.
- Stripe recommends creating a new Checkout Session for each payment attempt.
- Customer Portal lets customers manage subscriptions and billing details through a Stripe-hosted UI.

URLs:
https://docs.stripe.com/api/checkout/sessions
https://docs.stripe.com/customer-management
https://docs.stripe.com/api/customer_portal/sessions

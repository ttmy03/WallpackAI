# 04 Data Model

## Data model goals

- Track users, projects, generation jobs, artwork, exports, artifacts, credits, and subscriptions.
- Support retries and idempotency.
- Keep enough metadata for support/debugging.
- Avoid storing provider secrets or raw payment details.

## Entity overview

```txt
User
  has many Project
  has many CreditLedgerEntry
  has one Subscription

Project
  has many Artwork
  has many GenerationJob
  has many ExportJob

Artwork
  belongs to Project
  has many RatioCropSetting
  has many QualityReport

ExportJob
  belongs to Project
  has many ExportArtifact
  has one ListingCopy
```

## Suggested Prisma schema

```prisma
model User {
  id                 String              @id @default(cuid())
  firebaseUid        String              @unique
  email              String              @unique
  name               String?
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt
  onboardingComplete Boolean             @default(false)
  defaultAiDisclosure Boolean            @default(true)
  projects           Project[]
  creditLedger       CreditLedgerEntry[]
  subscription       Subscription?
}

model Subscription {
  id                   String   @id @default(cuid())
  userId               String   @unique
  stripeCustomerId      String?  @unique
  stripeSubscriptionId  String?  @unique
  planKey              String   @default("free")
  status               String   @default("inactive")
  currentPeriodStart   DateTime?
  currentPeriodEnd     DateTime?
  cancelAtPeriodEnd    Boolean  @default(false)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  user                 User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model CreditLedgerEntry {
  id              String   @id @default(cuid())
  userId          String
  amount          Int
  balanceAfter    Int
  type            String   // grant, reserve, commit, refund, admin_adjustment
  reason          String
  idempotencyKey  String   @unique
  relatedJobId    String?
  metadata        Json?
  createdAt       DateTime @default(now())
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
}

model Project {
  id              String          @id @default(cuid())
  userId          String
  name            String
  status          String          @default("draft")
  niche           String?
  theme           String?
  stylePresetKey  String?
  paletteKey      String?
  customPalette   Json?
  promptInputs    Json
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  user            User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  artworks        Artwork[]
  generationJobs  GenerationJob[]
  exportJobs      ExportJob[]

  @@index([userId, createdAt])
}

model GenerationJob {
  id                String   @id @default(cuid())
  userId            String
  projectId         String
  status            String   @default("queued")
  stage             String?
  provider          String
  model             String
  requestedCount    Int      @default(2)
  creditCost        Int      @default(0)
  creditReserved    Boolean  @default(false)
  creditCommitted   Boolean  @default(false)
  prompt            String
  negativePrompt    String?
  providerRequestId String?
  providerUsage     Json?
  errorCode         String?
  errorMessage      String?
  retryable         Boolean  @default(false)
  createdAt         DateTime @default(now())
  startedAt         DateTime?
  completedAt       DateTime?
  project           Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@index([projectId])
}

model Artwork {
  id                String             @id @default(cuid())
  userId            String
  projectId         String
  generationJobId   String?
  sourceStoragePath String
  previewStoragePath String?
  width             Int
  height            Int
  aspectRatio       Float
  provider          String?
  model             String?
  prompt            String?
  selected          Boolean            @default(false)
  qualityStatus     String             @default("unchecked")
  createdAt         DateTime           @default(now())
  project           Project            @relation(fields: [projectId], references: [id], onDelete: Cascade)
  ratioCrops        RatioCropSetting[]
  qualityReports    QualityReport[]

  @@index([userId, createdAt])
  @@index([projectId])
}

model RatioCropSetting {
  id          String   @id @default(cuid())
  artworkId   String
  ratioKey    String   // 2x3, 3x4, 4x5, 5x7, 11x14, iso-a
  focalX      Float    @default(0.5)
  focalY      Float    @default(0.5)
  cropX       Int?
  cropY       Int?
  cropWidth   Int?
  cropHeight  Int?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  artwork     Artwork  @relation(fields: [artworkId], references: [id], onDelete: Cascade)

  @@unique([artworkId, ratioKey])
}

model ExportJob {
  id              String           @id @default(cuid())
  userId          String
  projectId       String
  artworkId       String
  status          String           @default("queued")
  stage           String?
  exportType      String           @default("etsy_wall_art_pack")
  selectedRatios  Json
  maxDpi          Int              @default(300)
  creditCost      Int              @default(0)
  creditReserved  Boolean          @default(false)
  creditCommitted Boolean          @default(false)
  settings        Json
  qualitySummary  Json?
  errorCode       String?
  errorMessage    String?
  retryable       Boolean          @default(false)
  createdAt       DateTime         @default(now())
  startedAt       DateTime?
  completedAt     DateTime?
  project         Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  artifacts       ExportArtifact[]
  listingCopy     ListingCopy?

  @@index([userId, createdAt])
  @@index([projectId])
}

model ExportArtifact {
  id             String   @id @default(cuid())
  exportJobId    String
  kind           String   // etsy_zip, print_jpg, mockup_jpg, buyer_pdf, listing_txt, manifest_json
  fileName       String
  storagePath    String
  mimeType       String
  bytes          Int
  width          Int?
  height         Int?
  dpi            Int?
  ratioKey       String?
  sha256         String?
  createdAt      DateTime @default(now())
  exportJob      ExportJob @relation(fields: [exportJobId], references: [id], onDelete: Cascade)

  @@index([exportJobId])
}

model ListingCopy {
  id          String   @id @default(cuid())
  exportJobId String   @unique
  title       String
  description String
  tags        Json
  aiDisclosureIncluded Boolean @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  exportJob   ExportJob @relation(fields: [exportJobId], references: [id], onDelete: Cascade)
}

model QualityReport {
  id          String   @id @default(cuid())
  artworkId   String?
  exportJobId String?
  scope       String   // source, ratio_export, mockup
  status      String   // pass, warning, fail
  checks      Json
  createdAt   DateTime @default(now())
  artwork     Artwork? @relation(fields: [artworkId], references: [id], onDelete: SetNull)

  @@index([artworkId])
  @@index([exportJobId])
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String?
  action    String
  entity    String?
  entityId  String?
  metadata  Json?
  createdAt DateTime @default(now())

  @@index([userId, createdAt])
}
```

## Credit balance strategy

Do not store only a mutable `credits` number without a ledger. Use ledger entries and update balance transactionally.

Implementation pattern:

1. Read user's latest balance with row lock or a transaction-safe aggregate strategy.
2. Insert ledger entry with unique idempotency key.
3. Store `balanceAfter`.
4. Reject if resulting balance would be negative.

Idempotency keys:

```txt
generation:reserve:{generationJobId}
generation:commit:{generationJobId}
generation:refund:{generationJobId}
export:reserve:{exportJobId}
export:commit:{exportJobId}
export:refund:{exportJobId}
subscription:grant:{stripeInvoiceId}
```

## JSON field examples

### `Project.promptInputs`

```json
{
  "subject": "minimalist mountain landscape",
  "room": "living room",
  "stylePresetKey": "japandi_minimal",
  "paletteKey": "warm_neutral_sage",
  "mood": "calm",
  "composition": "centered with negative space",
  "avoid": ["text", "logos", "watermarks", "people"]
}
```

### `ExportJob.settings`

```json
{
  "targetDpi": 300,
  "jpegQualityStart": 92,
  "jpegQualityMinimum": 82,
  "etsyZipTargetBytes": 18874368,
  "includeBuyerPdf": true,
  "includeMockups": true,
  "includeListingCopy": true,
  "ratios": ["2x3", "3x4", "4x5", "5x7", "11x14"]
}
```

### `QualityReport.checks`

```json
{
  "sourceResolution": { "status": "pass", "width": 2160, "height": 3240 },
  "upscaleFactor": { "status": "warning", "factor": 3.33 },
  "fileSize": { "status": "pass", "bytes": 14500322 },
  "aspectRatio": { "status": "pass", "ratio": "2:3" },
  "textArtifacts": { "status": "pass" }
}
```

## Future Etsy integration models

Add only after MVP:

```prisma
model EtsyConnection {
  id              String   @id @default(cuid())
  userId          String   @unique
  shopId          String
  accessTokenEnc  String
  refreshTokenEnc String
  scope           String
  expiresAt       DateTime
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model EtsyListingDraft {
  id            String   @id @default(cuid())
  userId        String
  exportJobId   String
  etsyListingId String?
  status        String   @default("local_draft")
  payload       Json
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

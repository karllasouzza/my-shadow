# Data Model: Private Shadow Reflection Journal

## Entity: ReflectionEntry

- Purpose: Stores the user's daily reflection text and metadata.
- Fields:
  - id: string (UUID)
  - entryDate: string (ISO date, yyyy-mm-dd)
  - content: string (1..5000 chars)
  - moodTags: string[] (optional, max 8)
  - triggerTags: string[] (optional, max 12)
  - sourceLocale: string (must be pt-BR)
  - createdAt: string (ISO timestamp)
  - updatedAt: string (ISO timestamp)
- Validation rules:
  - content must be non-empty after trim
  - entryDate cannot be in invalid format
  - sourceLocale fixed to pt-BR in v1
- State transitions:
  - draft -> saved
  - saved -> updated
  - saved/updated -> deleted (hard-delete cascade)

## Entity: GuidedQuestionSet

- Purpose: Holds generated reflective questions for one reflection context.
- Fields:
  - id: string (UUID)
  - reflectionId: string (FK to ReflectionEntry.id)
  - generationMode: enum(normal, fallback_template, retry_result)
  - questions: string[] (min 1, max 8)
  - retrievalContextReflectionIds: string[]
  - modelId: string
  - modelVersion: string
  - generatedAt: string (ISO timestamp)
- Validation rules:
  - all questions must be Brazilian Portuguese
  - generationMode must be one of allowed enum values
  - reflectionId must exist at generation time
- State transitions:
  - queued -> generated
  - generated -> superseded (optional when regenerated)
  - generated/superseded -> deleted (cascade from ReflectionEntry)

## Entity: FinalReview

- Purpose: Period synthesis of recurring patterns and prompts.
- Fields:
  - id: string (UUID)
  - periodStart: string (ISO date)
  - periodEnd: string (ISO date)
  - reflectionIds: string[]
  - summary: string
  - recurringPatterns: string[]
  - emotionalTriggers: string[]
  - nextInquiryPrompts: string[]
  - generationMode: enum(normal, fallback_template, retry_result)
  - generatedAt: string (ISO timestamp)
- Validation rules:
  - periodStart <= periodEnd
  - summary and prompts must be Brazilian Portuguese
  - review must reference at least 1 reflection unless fallback limitation case
- State transitions:
  - requested -> generated
  - generated -> superseded (optional regenerate)
  - generated/superseded -> deleted (if all linked reflections deleted or user cleanup)

## Entity: GenerationJob

- Purpose: Tracks queued local retries when generation temporarily fails.
- Fields:
  - id: string (UUID)
  - targetType: enum(guided_questions, final_review)
  - targetRefId: string
  - status: enum(queued, running, succeeded, failed, cancelled)
  - attempts: number
  - maxAttempts: number
  - createdAt: string (ISO timestamp)
  - updatedAt: string (ISO timestamp)
  - lastError: string (optional)
- Validation rules:
  - attempts <= maxAttempts
  - queued jobs must include targetType and targetRefId
- State transitions:
  - queued -> running
  - running -> succeeded | failed | cancelled
  - failed -> queued (retry path)

## Entity: ExportBundle

- Purpose: Represents one markdown export request/result.
- Fields:
  - id: string (UUID)
  - periodStart: string (ISO date)
  - periodEnd: string (ISO date)
  - includedReflectionIds: string[]
  - includedQuestionSetIds: string[]
  - includedReviewIds: string[]
  - markdownContent: string
  - fileName: string
  - createdAt: string (ISO timestamp)
  - status: enum(requested, generating, ready, failed)
  - errorMessage: string (optional)
- Validation rules:
  - markdownContent must preserve chronological order sections
  - fileName must end with .md
- State transitions:
  - requested -> generating
  - generating -> ready | failed

## Relationships

- ReflectionEntry 1 -> N GuidedQuestionSet
- ReflectionEntry N <-> N FinalReview (via reflectionIds)
- GuidedQuestionSet and FinalReview may each have 0..N GenerationJob records over retry lifecycle
- ExportBundle references N ReflectionEntry, N GuidedQuestionSet, and 0..N FinalReview

## Deletion Rules

- Deleting ReflectionEntry triggers hard-delete cascade for linked GuidedQuestionSet records.
- FinalReview records that become invalid due to deleted reflections are also removed in cascade for v1.
- Related GenerationJob records linked to deleted artifacts are cancelled and hard-deleted.

# Contract: Reflection Service Boundary

## Scope

Defines internal service contracts between ViewModel layer and reflection/review domain services.

## Type Definitions

```ts
export type GenerationMode = "normal" | "fallback_template" | "retry_result";

export type AppErrorCode =
  | "NOT_READY"
  | "VALIDATION_ERROR"
  | "LOCAL_GENERATION_UNAVAILABLE"
  | "RETRY_QUEUE_ERROR"
  | "SECURITY_LOCK_REQUIRED"
  | "NOT_FOUND";
```

## Use Case: createReflection

### Request

```ts
{
  entryDate: string; // yyyy-mm-dd
  content: string;
  moodTags?: string[];
  triggerTags?: string[];
}
```

### Response

```ts
{
  reflectionId: string;
  createdAt: string;
}
```

### Errors

- VALIDATION_ERROR when content is empty/invalid.
- SECURITY_LOCK_REQUIRED when app is locked.

## Use Case: generateGuidedQuestions

### Request

```ts
{
  reflectionId: string;
  augmentedGeneration: boolean;
  contextWindowDays?: number; // default 30
}
```

### Response

```ts
{
  questionSetId: string;
  generationMode: GenerationMode;
  questions: string[];
  queuedRetryJobId?: string;
}
```

### Behavioral Rules

- Output language must be Brazilian Portuguese.
- If local generation is unavailable, response must still return fallback_template questions.
- When fallback_template is returned, queuedRetryJobId must be set.

### Errors

- NOT_READY when AI pipeline is not initialized and fallback cannot be produced.
- NOT_FOUND when reflectionId does not exist.
- RETRY_QUEUE_ERROR when fallback succeeds but queue scheduling fails.

## Use Case: generateFinalReview

### Request

```ts
{
  periodStart: string; // yyyy-mm-dd
  periodEnd: string;   // yyyy-mm-dd
  maxEntries?: number; // default 30
}
```

### Response

```ts
{
  reviewId: string;
  generationMode: GenerationMode;
  summary: string;
  recurringPatterns: string[];
  emotionalTriggers: string[];
  nextInquiryPrompts: string[];
  queuedRetryJobId?: string;
}
```

### Behavioral Rules

- Must return meaningful constrained output even for low-data periods.
- Must preserve supportive Jungian shadow-work tone.
- Must not use remote services in v1 core flow.

## Use Case: deleteReflectionCascade

### Request

```ts
{
  reflectionId: string;
  confirmationToken: string;
}
```

### Response

```ts
{
  deletedReflectionId: string;
  deletedQuestionSetCount: number;
  deletedReviewCount: number;
  deletedAt: string;
}
```

### Behavioral Rules

- Deletion must be hard-delete immediate.
- No recovery endpoint is available in v1.
- Linked generated artifacts must be deleted in cascade.

### Errors

- NOT_FOUND when reflection does not exist.
- SECURITY_LOCK_REQUIRED when app is locked.

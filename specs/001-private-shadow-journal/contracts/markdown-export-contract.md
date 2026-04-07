# Contract: Markdown Export Workflow

## Scope

Defines how export requests are validated, generated, and returned by the export domain service.

## Use Case: exportReflectionBundleToMarkdown

### Request

```ts
{
  periodStart: string; // yyyy-mm-dd
  periodEnd: string;   // yyyy-mm-dd
  includeQuestions: boolean; // default true
  includeFinalReview: boolean; // default true
  fileNamePrefix?: string;
}
```

### Response

```ts
{
  exportBundleId: string;
  fileName: string; // *.md
  markdownContent: string;
  reflectionCount: number;
  questionSetCount: number;
  reviewCount: number;
  generatedAt: string;
}
```

### Validation Rules

- periodStart and periodEnd must be valid ISO dates.
- periodStart must be <= periodEnd.
- fileName must be sanitized and end with .md.
- Export must require explicit user action and unlocked app state.

### Formatting Contract

Markdown output must include:

1. Header with period and generation timestamp.
2. Chronological reflection sections.
3. Guided questions section per reflection when includeQuestions is true.
4. Final review section when includeFinalReview is true and data exists.
5. Empty-period output must return explicit no-content message, not misleading blank content.

### Errors

- VALIDATION_ERROR: invalid period or malformed request.
- SECURITY_LOCK_REQUIRED: app lock not satisfied.
- NOT_FOUND: no records for selected period.
- EXPORT_GENERATION_FAILED: markdown build failure.

## Non-Functional Guarantees

- Export operation target: <= 10 seconds p95 for up to 365 entries.
- No remote transmission of reflection/export content in v1.

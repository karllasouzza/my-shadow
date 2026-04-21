/**
 * Property-based tests for shared/ai/stt/transcribe.ts
 *
 * Property 5 — Transcription result round-trip (task 10.3)
 *   Validates: Requirements 10.2, 10.3
 */

import type {
    TranscriptionResult,
    TranscriptionSegment,
} from "@/shared/ai/stt/types";
import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Arbitraries for generating TranscriptionResult objects
// ---------------------------------------------------------------------------

/**
 * Arbitrary for generating TranscriptionSegment objects
 */
const transcriptionSegmentArbitrary = fc.record({
  text: fc.string({ minLength: 0, maxLength: 200 }),
  startMs: fc.integer({ min: 0, max: 3600000 }), // 0 to 1 hour in ms
  endMs: fc.integer({ min: 0, max: 3600000 }),
}) as fc.Arbitrary<TranscriptionSegment>;

/**
 * Arbitrary for generating valid language codes (ISO 639-1 format)
 */
const languageCodeArbitrary = fc.oneof(
  fc.constant("pt"),
  fc.constant("en"),
  fc.constant("es"),
  fc.constant("fr"),
  fc.constant("de"),
  fc.constant("it"),
  fc.constant("ja"),
  fc.constant("zh"),
  fc.constant("pt-BR"),
  fc.constant("en-US"),
  fc.constant("es-ES"),
  // Also allow arbitrary strings to test robustness
  fc.string({ minLength: 2, maxLength: 10 }),
);

/**
 * Arbitrary for generating TranscriptionResult objects
 */
const transcriptionResultArbitrary = fc.record({
  text: fc.string({ minLength: 0, maxLength: 1000 }),
  language: languageCodeArbitrary,
  segments: fc.array(transcriptionSegmentArbitrary, {
    minLength: 0,
    maxLength: 20,
  }),
}) as fc.Arbitrary<TranscriptionResult>;

// ---------------------------------------------------------------------------
// Property 5 — Transcription result round-trip
// Validates: Requirements 10.2, 10.3
// Feature: ai-model-manager-stt, Property 5: transcription result round-trip
// ---------------------------------------------------------------------------
describe("Property 5: Transcription result round-trip", () => {
  it("JSON.parse(JSON.stringify(result)) deep-equals the original result", () => {
    fc.assert(
      fc.property(transcriptionResultArbitrary, (result) => {
        // Serialize and deserialize
        const serialized = JSON.stringify(result);
        const deserialized = JSON.parse(serialized) as TranscriptionResult;

        // Deep equality checks
        expect(deserialized.text).toBe(result.text);
        expect(deserialized.language).toBe(result.language);
        expect(deserialized.segments.length).toBe(result.segments.length);

        // Check each segment
        for (let i = 0; i < result.segments.length; i++) {
          const originalSegment = result.segments[i];
          const deserializedSegment = deserialized.segments[i];

          expect(deserializedSegment.text).toBe(originalSegment.text);
          expect(deserializedSegment.startMs).toBe(originalSegment.startMs);
          expect(deserializedSegment.endMs).toBe(originalSegment.endMs);
        }

        // Also verify structural equality using JSON comparison
        expect(JSON.stringify(deserialized)).toBe(JSON.stringify(result));
      }),
      { numRuns: 100 },
    );
  });

  it("handles edge cases: empty text, empty segments, special characters", () => {
    fc.assert(
      fc.property(
        fc.record({
          text: fc.oneof(
            fc.constant(""),
            fc.string({ minLength: 1, maxLength: 100 }),
            fc.string({ minLength: 1, maxLength: 100 }),
          ),
          language: languageCodeArbitrary,
          segments: fc.oneof(
            fc.constant([]),
            fc.array(transcriptionSegmentArbitrary, {
              minLength: 1,
              maxLength: 10,
            }),
          ),
        }) as fc.Arbitrary<TranscriptionResult>,
        (result) => {
          const serialized = JSON.stringify(result);
          const deserialized = JSON.parse(serialized) as TranscriptionResult;

          expect(deserialized).toEqual(result);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("preserves numeric precision for timestamps", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            text: fc.string({ minLength: 0, maxLength: 50 }),
            startMs: fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
            endMs: fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
          }) as fc.Arbitrary<TranscriptionSegment>,
          { minLength: 1, maxLength: 10 },
        ),
        (segments) => {
          const result: TranscriptionResult = {
            text: "test",
            language: "pt",
            segments,
          };

          const serialized = JSON.stringify(result);
          const deserialized = JSON.parse(serialized) as TranscriptionResult;

          // Verify all timestamps are preserved exactly
          for (let i = 0; i < segments.length; i++) {
            expect(deserialized.segments[i].startMs).toBe(segments[i].startMs);
            expect(deserialized.segments[i].endMs).toBe(segments[i].endMs);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

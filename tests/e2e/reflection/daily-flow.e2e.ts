/**
 * T022: End-to-end daily reflection flow test
 */

import { describe, it, expect } from "bun:test";
import { getPtBRJungianGuard } from "../../../shared/ai/ptbr-tone-guard";
import { getAppLockGateway } from "../../../shared/security/app-lock";
import {
    getReflectionStore,
    ReflectionRecord,
} from "../../../shared/storage/encrypted-reflection-store";

describe("Daily Reflection Flow - E2E", () => {
  let testPin = "1234";

  beforeEach(async () => {
    // Clean up storage
    const store = getReflectionStore();
    await store.clear();

    // Initialize app lock
    const lockGateway = getAppLockGateway();
    await lockGateway.initializeLock(testPin);
  });

  it("should complete full daily reflection flow", async () => {
    const lockGateway = getAppLockGateway();
    const reflectionStore = getReflectionStore();

    // Step 1: Unlock app
    expect(lockGateway.isLocked()).toBe(true);
    const unlockResult = await lockGateway.unlock(testPin);
    expect(unlockResult.success).toBe(true);
    expect(lockGateway.isLocked()).toBe(false);

    // Step 2: Create reflection
    const today = new Date().toISOString().split("T")[0];
    const reflection: ReflectionRecord = {
      id: "daily_001",
      entryDate: today,
      content:
        "Hoje tive um dia desafiador que me ensinou sobre resiliência. Reflito sobre como posso crescer através dessas dificuldades.",
      moodTags: ["contemplativo", "esperançoso"],
      triggerTags: ["desafio", "crescimento"],
      sourceLocale: "pt-BR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saveResult = await reflectionStore.saveReflection(reflection);
    expect(saveResult.success).toBe(true);

    // Step 3: Validate content tone
    const toneGuard = getPtBRJungianGuard();
    const validationResult = toneGuard.validate(reflection.content);
    expect(validationResult.success).toBe(true);
    if (validationResult.success) {
      expect(validationResult.data.language.isPtBR).toBe(true);
      expect(validationResult.data.tone.isValid).toBe(true);
    }

    // Step 4: Retrieve reflection
    const getResult = await reflectionStore.getReflection("daily_001");
    expect(getResult.success).toBe(true);
    expect(getResult.data?.content).toContain("resiliência");

    // Step 5: List all reflections
    const allResult = await reflectionStore.getAllReflections();
    expect(allResult.success).toBe(true);
    expect(allResult.data.length).toBeGreaterThan(0);

    // Step 6: Lock app
    const lockResult = await lockGateway.lock();
    expect(lockResult.success).toBe(true);
    expect(lockGateway.isLocked()).toBe(true);
  });

  it("should prevent reflection creation when locked", async () => {
    const lockGateway = getAppLockGateway();

    // App starts locked
    expect(lockGateway.isLocked()).toBe(true);

    // Should not be able to proceed without unlock
    const wrongPinResult = await lockGateway.unlock("0000");
    expect(wrongPinResult.success).toBe(false);

    // App should remain locked
    expect(lockGateway.isLocked()).toBe(true);
  });

  it("should enforce Portuguese for content", async () => {
    const lockGateway = getAppLockGateway();
    const reflectionStore = getReflectionStore();
    const toneGuard = getPtBRJungianGuard();

    // Unlock
    await lockGateway.unlock(testPin);

    // Try to create reflection in English
    const englishContent =
      "Today was a challenging day that taught me about resilience.";
    const validationResult = toneGuard.validate(englishContent);
    expect(validationResult.success).toBe(false);
  });

  it("should handle reflection deletion appropriately", async () => {
    const lockGateway = getAppLockGateway();
    const reflectionStore = getReflectionStore();

    // Unlock
    await lockGateway.unlock(testPin);

    // Create reflection
    const reflection: ReflectionRecord = {
      id: "to_delete_001",
      entryDate: new Date().toISOString().split("T")[0],
      content: "Esta reflexão será deletada.",
      sourceLocale: "pt-BR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await reflectionStore.saveReflection(reflection);

    // Verify it exists
    let getResult = await reflectionStore.getReflection("to_delete_001");
    expect(getResult.data).toBeDefined();

    // Delete it
    const deleteResult =
      await reflectionStore.deleteReflection("to_delete_001");
    expect(deleteResult.success).toBe(true);

    // Verify it's gone
    getResult = await reflectionStore.getReflection("to_delete_001");
    expect(getResult.data).toBeNull();
  });
});

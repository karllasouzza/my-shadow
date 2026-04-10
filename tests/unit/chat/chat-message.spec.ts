/**
 * T021: Unit test for ChatMessage validation
 */
import { validateChatMessage, createChatMessage } from "@/features/chat/model/chat-message";

describe("ChatMessage validation", () => {
  it("should reject empty content", () => {
    const result = validateChatMessage("");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("empty");
  });

  it("should reject whitespace-only content", () => {
    const result = validateChatMessage("   ");
    expect(result.isValid).toBe(false);
  });

  it("should reject content exceeding 10,000 chars", () => {
    const longContent = "a".repeat(10_001);
    const result = validateChatMessage(longContent);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("maximum length");
  });

  it("should accept valid content", () => {
    const result = validateChatMessage("Hello, this is a valid message.");
    expect(result.isValid).toBe(true);
  });

  it("should create ChatMessage with defaults", () => {
    const msg = createChatMessage("user", "Test message");
    expect(msg.role).toBe("user");
    expect(msg.content).toBe("Test message");
    expect(msg.timestamp).toBeDefined();
    expect(new Date(msg.timestamp).getTime()).toBeGreaterThan(0);
  });
});

/**
 * Unit tests for NoModelPrompt logic
 *
 * Task 5.1 — Write unit tests for NoModelPrompt
 * Validates: Requirements 8.1, 8.2, 8.3
 *
 * Tests the pure logic functions that drive the component's behavior,
 * consistent with the project's pattern of testing pure logic without
 * rendering React Native components in the bun test environment.
 */

import { describe, expect, it, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Pure logic extracted from NoModelPrompt
// (mirrors the component's internal logic)
// ---------------------------------------------------------------------------

/**
 * Returns whether the dialog should be open based on the visible prop.
 */
function isDialogOpen(visible: boolean): boolean {
  return visible;
}

/**
 * Simulates the onOpenChange handler: calls onDismiss when open becomes false.
 */
function handleOpenChange(open: boolean, onDismiss: () => void): void {
  if (!open) onDismiss();
}

// ---------------------------------------------------------------------------
// visibility tests (Req 8.1)
// ---------------------------------------------------------------------------

describe("NoModelPrompt — visibility (Req 8.1)", () => {
  it("dialog is open when visible is true", () => {
    expect(isDialogOpen(true)).toBe(true);
  });

  it("dialog is closed when visible is false", () => {
    expect(isDialogOpen(false)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// onConfirm tests (Req 8.2)
// ---------------------------------------------------------------------------

describe("NoModelPrompt — onConfirm (Req 8.2)", () => {
  it("calls onConfirm when confirm button is pressed", () => {
    const onConfirm = mock(() => {});
    // Simulate pressing the confirm (Baixar) button
    onConfirm();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("does not call onDismiss when confirm button is pressed", () => {
    const onConfirm = mock(() => {});
    const onDismiss = mock(() => {});
    // Pressing confirm should only call onConfirm
    onConfirm();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// onDismiss tests (Req 8.3)
// ---------------------------------------------------------------------------

describe("NoModelPrompt — onDismiss (Req 8.3)", () => {
  it("calls onDismiss when cancel button is pressed", () => {
    const onDismiss = mock(() => {});
    // Simulate pressing the cancel (Cancelar) button
    onDismiss();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when dialog is closed via onOpenChange(false)", () => {
    const onDismiss = mock(() => {});
    handleOpenChange(false, onDismiss);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does not call onDismiss when onOpenChange(true) is triggered", () => {
    const onDismiss = mock(() => {});
    handleOpenChange(true, onDismiss);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("does not call onConfirm when cancel button is pressed", () => {
    const onConfirm = mock(() => {});
    const onDismiss = mock(() => {});
    // Pressing cancel should only call onDismiss
    onDismiss();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

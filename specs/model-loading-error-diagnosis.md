# Model Loading Error Diagnosis & Fix Plan

**Branch**: `002` (bugfix branch)  
**Date**: 2026-04-09  
**Error Code**: `NOT_READY` with message "Failed to load model"  
**Context**: Debugging llama.rn model initialization failure during onboarding

## Problem Statement

When a user completes the onboarding flow (security → model selection → model loading), the model loading screen displays:

```json
{
  "error": {
    "cause": "Failed to load model",
    "code": "NOT_READY",
    "details": {},
    "message": "Failed to load model"
  },
  "success": false
}
```

The error occurs in `LocalAIRuntimeService.loadModel()` when calling `initLlama()` from the llama.rn library. The error is generic with no details about the root cause.

## Root Cause Analysis (Suspected)

### Call Chain

```
useModelLoadingVm (onboarding/view-model)
  → modelManager.loadModel(activeModel.id, filePath)
    → LocalAIRuntimeService.loadModel(modelId, modelPath)
      → initLlamaNative({ model: resolvedPath, ... })
        ❌ Throws error: "Failed to load model" (code: NOT_READY)
```

### Potential Root Causes

1. **Invalid or Inaccessible Model Path**
   - The `filePath` passed may be incorrect or unreachable
   - File permissions may prevent access
   - File may be on a restricted filesystem mount
   - **How to test**: Log the actual resolved path and verify file exists via FileSystem API

2. **Corrupted or Incomplete Model File**
   - Model download completed but file is truncated or corrupted
   - File format is not valid GGUF
   - **How to test**: Verify file size matches expected size, compute checksum

3. **Insufficient Memory or Resource Constraints**
   - Device doesn't have enough RAM despite 60% budget check
   - llama.rn requires additional overhead not captured by estimate
   - **How to test**: Check available memory at runtime using React Native APIs

4. **Missing or Incompatible llama.rn Setup**
   - llama.rn native module is not properly installed or linked
   - Android NDK/build configuration issue
   - **How to test**: Check module is available, test initialization without model loading

5. **Model Path Format Issue**
   - llama.rn expects specific path format (file://, absolute, etc.)
   - Current path resolution may produce invalid URIs for Android
   - **How to test**: Test with multiple path formats

6. **Threading/Timing Issue**
   - initLlama called before platform is fully ready
   - Race condition in context initialization
   - **How to test**: Add delays, ensure platform ready state

## Diagnosis Strategy

### Phase 1: Enhance Error Logging (Immediate)

Add detailed error capture to pinpoint root cause:

**Location**: `shared/ai/local-ai-runtime.ts` → `loadModel()` method

```typescript
// Before: Catches errors generically
catch (error) {
  return err(
    createError("NOT_READY", "Failed to load model", {}, error as Error),
  );
}

// After: Detailed diagnostics
catch (error) {
  const errorDetails = {
    modelId,
    resolvedPath,
    errorMessage: error instanceof Error ? error.message : "Unknown error",
    errorStack: error instanceof Error ? error.stack : "",
    platformOS: Platform.OS,
  };

  console.error("[LocalAIRuntime] Model loading failed:", errorDetails);

  return err(
    createError("NOT_READY", "Failed to load model", errorDetails, error as Error),
  );
}
```

**Location**: `features/onboarding/view-model/use-model-loading-vm.ts` → `loadModelInternal()`

```typescript
// After runtime.loadModel() call:
const runtimeResult = await runtime.loadModel(activeModel.id, filePath);

if (!runtimeResult.success) {
  console.error("[ModelLoadingVM] Runtime error details:", {
    error: runtimeResult.error,
    modelId: activeModel.id,
    filePath,
  });

  // ... existing error handling
}
```

### Phase 2: Add Pre-Load Diagnostics

Before calling `initLlama()`, validate:

1. File exists and is readable
2. File size matches expected size
3. File is valid GGUF (magic bytes check)
4. Available RAM meets runtime requirements
5. Path format is valid for platform

**Location**: `shared/ai/local-ai-runtime.ts` → `loadModel()` method (new)

```typescript
async loadModel(modelId: string, modelPath: string): Promise<Result<LlamaModel>> {
  try {
    // ... existing validation

    const resolvedPath = this.resolveModelPath(modelId, modelPath);

    // NEW: Pre-load diagnostics
    const diagnostics = await this.diagnoseModelFile(resolvedPath);
    if (!diagnostics.isValid) {
      console.error("[LocalAIRuntime] Model file diagnostics failed:", diagnostics);
      return err(
        createError("VALIDATION_ERROR", diagnostics.errorMessage, diagnostics),
      );
    }

    // Continue with initLlama...
  } catch (error) {
    // ... error handling
  }
}

private async diagnoseModelFile(filePath: string): Promise<{
  isValid: boolean;
  errorMessage: string;
  details: Record<string, any>;
}> {
  // Check 1: File exists
  const fileInfo = await FileSystem.getInfoAsync(filePath);
  if (!fileInfo.exists) {
    return {
      isValid: false,
      errorMessage: "Model file does not exist at specified path",
      details: { filePath, exists: false },
    };
  }

  // Check 2: File size
  if (!fileInfo.size || fileInfo.size < 1024 * 1024) { // < 1MB is suspicious
    return {
      isValid: false,
      errorMessage: "Model file size is invalid or too small",
      details: { filePath, size: fileInfo.size },
    };
  }

  // Check 3: GGUF magic bytes (first 4 bytes: "GGUF")
  // Note: This requires binary file read capability
  // Deferred if unsupported, but would help validate file format

  return {
    isValid: true,
    errorMessage: "",
    details: { filePath, size: fileInfo.size },
  };
}
```

### Phase 3: Test Path Resolution

Verify that `resolveModelPath()` produces correct platform-specific paths:

**Location**: `shared/ai/local-ai-runtime.ts` → `resolveModelPath()` method

```typescript
private resolveModelPath(modelId: string, modelPath: string): string {
  // Current implementation (assumed):
  // return modelPath;

  // Proposed: Add platform-specific URI handling
  if (Platform.OS === "android") {
    // Ensure absolute path, not relative or content:// URI
    if (!modelPath.startsWith("/")) {
      // If provided a relative path, this is an error
      console.warn("[LocalAIRuntime] Relative path provided for Android:", modelPath);
    }
    // llama.rn on Android expects absolute file paths or file:// URIs
    if (!modelPath.startsWith("file://")) {
      return `file://${modelPath}`;
    }
  }

  return modelPath;
}
```

### Phase 4: Add Memory Diagnostics

Capture available memory at load time:

**Location**: `shared/ai/local-ai-runtime.ts` → `loadModel()` method

```typescript
// NEW: Before initLlama, log available resources
const info = await getDeviceInfo(); // or use React Native API
console.log("[LocalAIRuntime] Memory state at load time:", {
  modelId,
  estimatedModelRam: this.getEstimatedRam(modelId),
  availableRam: info.freeRam,
  totalRam: info.totalRam,
  percentageAvailable: (info.freeRam / info.totalRam) * 100,
});
```

## Debugging Checklist

After implementing Phase 1-4, use this checklist to isolate the issue:

- [ ] **Check logs**: Does error output include specific details (file not found, size invalid, etc.)?
- [ ] **Verify file path**: Confirm model file exists at the expected location on device
- [ ] **Check file size**: Ensure downloaded file size matches expected (e.g., 350 MB for 0.5B)
- [ ] **Verify GGUF format**: If possible, extract first 4 bytes to confirm "GGUF" magic
- [ ] **Check memory**: Log available RAM vs. estimated LLM requirement at load time
- [ ] **Test path format**: Try both `/path/to/file.gguf` and `file:///path/to/file.gguf`
- [ ] **Isolate llama.rn**: Create minimal test that initializes llama.rn without app context
- [ ] **Check ProGuard**: Verify llama.rn ProGuard rules are applied (Android release builds)

## Success Criteria

1. **Error message is actionable**: User sees specific error (e.g., "File not found at /path", "Insufficient RAM")
2. **Model loads successfully**: After fix, user can load and use model for reflection
3. **No regressions**: Existing model download flow still works
4. **Performance**: Model loads within <30s on target devices

## Timeline

- **Phase 1 (Logging)**: 1-2 hours → Immediate deployment for diagnostics
- **Phase 2 (Pre-load checks)**: 2-3 hours → Prevents bad states early
- **Phase 3 (Path resolution)**: 1 hour → Fixes platform-specific issues
- **Phase 4 (Memory diagnostics)**: 1 hour → Helps identify resource issues
- **Phase 5 (Test & validate)**: 2-3 hours → Verify fix on target devices

**Total effort**: ~10 hours for full diagnosis + fix

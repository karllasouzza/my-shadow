# Public API Contract: Model Loading & Integrity Verification

**Module**: `shared/ai`  
**Primary Consumer**: `features/model-management`, `features/chat`  
**Status**: Specification

## Contract: IModelLoader

### Purpose

Load AI models with pre-flight memory checks, SHA256 integrity verification, and fallback support for degraded states.

### Public Methods

#### 1. `preflightCheck(modelPath: string, deviceInfo: DeviceInfo): Promise<PreflightCheckResult>`

Perform pre-flight memory and integrity check before attempting to load a model.

**Input**:

```typescript
modelPath: string; // Path to GGUF file
deviceInfo: DeviceInfo; // From DeviceDetector
```

**Output**:

```typescript
interface PreflightCheckResult {
  canLoad: boolean; // true if all checks pass
  requiredRAM: number; // GB
  availableRAM: number; // GB
  ramSufficient: boolean; // required <= available
  integrityOk: boolean; // SHA256 verified (if hash available)
  integrityStatus: "verified" | "unverified" | "failed";
  reasons: string[]; // If canLoad=false, explain why
}
```

**Checks Performed** (in order):

1. **File Exists**: Verify modelPath exists and is readable
2. **Memory Sufficient**: Compare calculated required RAM vs. available
3. **Integrity Verification** (if SHA256 available):
   - Calculate SHA256 hash of model file
   - Compare to expected hash (from metadata or manifest)
   - If mismatch, integrityStatus = "failed" and canLoad = false
4. **Platform Compatibility**: Verify model format matches platform

**Error Handling**:

- Never throws; returns canLoad=false with detailed reasons
- Log detailed diagnostics for troubleshooting

**Performance**:

- Target: < 1s (mostly I/O for file existence and metadata loading)
- SHA256 calculation done lazily (only if integrity check needed)

---

#### 2. `load(modelPath: string, runtimeConfig: RuntimeConfig, options?: LoadOptions): Promise<LoadResult>`

Attempt to load a model with the provided runtime configuration.

**Input**:

```typescript
modelPath: string;
runtimeConfig: RuntimeConfig;  // From RuntimeConfigGenerator
options?: {
  onProgress?: (percent: number) => void;  // Progress callback
  timeout?: number;                         // Load timeout in ms (default 30s)
  fallbackToCache?: boolean;                // Use cached model if load fails
}
```

**Output**:

```typescript
interface LoadResult {
  success: boolean;
  modelPath: string;
  loadTimeMs: number;
  memoryUsedMB: number;
  error?: string; // If success=false
  errorCode?: "MEMORY_EXCEEDED" | "FILE_NOT_FOUND" | "TIMEOUT" | "UNKNOWN";
}
```

**Steps**:

1. Validate preflightCheck passes
2. Emit onProgress(0)
3. Begin model load with timeout
4. Monitor memory during load (trigger fallback if critical)
5. Emit onProgress(100) on success
6. Return LoadResult with timing and memory usage

**Error Handling**:

- If load exceeds timeout: Return success=false with errorCode="TIMEOUT"
- If memory critical during load: Abort and return errorCode="MEMORY_EXCEEDED"
- If fallbackToCache=true and load fails: Return cached version if available
- Log detailed error with context (device info, config, timing)

**Performance**:

- Target: < 10s for typical 7B model on 4GB device

---

#### 3. `verifyIntegrity(modelPath: string, expectedHash?: string): Promise<IntegrityResult>`

Calculate and verify SHA256 hash of a model file.

**Input**:

```typescript
modelPath: string;
expectedHash?: string;  // SHA256 hex string; if omitted, calculate only
```

**Output**:

```typescript
interface IntegrityResult {
  filePath: string;
  calculatedHash: string; // SHA256 hex
  expectedHash?: string;
  matches: boolean; // true if calculated === expected
  fileSize: number; // bytes
  verifiedAt: number; // timestamp
}
```

**Behavior**:

- Calculate SHA256 of model file (streaming to avoid memory spike)
- If expectedHash provided, compare and return matches
- If no expectedHash, return calculated hash for reference

**Performance**:

- Target: < 5s for 7GB model file (streaming hash calculation)
- Can be run in background without blocking main thread

**Error Handling**:

- If file not found: Throw FileNotFoundError
- If hash calculation fails: Throw IntegrityError with partial result
- Never return unknown/undefined hash

---

#### 4. `getModelInfo(modelPath: string): Promise<ModelMetadata>`

Retrieve or calculate model metadata (size, quantization, context, etc.).

**Input**: `modelPath: string`

**Output**:

```typescript
interface ModelMetadata {
  fileSizeBytes: number;
  modelSizeBytes: number; // Estimated from weights
  quantizationType:
    | "f32"
    | "f16"
    | "q8_0"
    | "q4_0"
    | "iq3_xxs"
    | "iq3_s"
    | "iq2_k";
  contextWindow: number; // Suggested context (tokens)
  attentionHeads: number;
  headDimension: number;
  kvCacheElementSize: number; // 2 for f16, 1 for q8_0, etc.
  sha256Hash?: string; // If available from manifest
  requiredRAM: number; // Calculated budget (GB)
  loadedAt: number; // Timestamp
}
```

**Behavior**:

1. Try to load from model manifest or metadata file (.meta.json)
2. If not found, inspect GGUF header to extract parameters
3. Calculate required RAM using formula
4. Return complete ModelMetadata

**Performance**:

- Target: < 100ms (GGUF header inspection only)
- Caches result for subsequent calls

---

## Dependency Injection Interface

### IModelStorageProvider

```typescript
interface IModelStorageProvider {
  fileExists(path: string): Promise<boolean>;
  getFileSize(path: string): Promise<number>;
  calculateSHA256(path: string): Promise<string>;
  loadMetadataManifest(modelPath: string): Promise<ModelMetadata | null>;
}
```

**Implementation**: `shared/ai/model-loader.ts` (wraps file system APIs)  
**Testing**: Mock provider for unit tests

---

## Error Contract

### ModelLoaderError

```typescript
interface ModelLoaderError extends Error {
  code:
    | "FILE_NOT_FOUND"
    | "MEMORY_EXCEEDED"
    | "INTEGRITY_FAILED"
    | "LOAD_TIMEOUT"
    | "UNKNOWN";
  modelPath?: string;
  requiredRAM?: number;
  availableRAM?: number;
  hash?: { expected?: string; calculated?: string };
}
```

**Handling Policy**:

| Error Code       | Action                                              |
| ---------------- | --------------------------------------------------- |
| FILE_NOT_FOUND   | Return canLoad=false; user can check model download |
| MEMORY_EXCEEDED  | Suggest smaller model or close other apps           |
| INTEGRITY_FAILED | Suggest re-downloading model                        |
| LOAD_TIMEOUT     | Suggest device restart; log timeout duration        |
| UNKNOWN          | Log full context; return safe result                |

---

## Pre-Flight Check Workflow

```
User initiates model load
  │
  ├─> preflightCheck(modelPath, deviceInfo)
  │   ├─ File exists?
  │   ├─ Memory sufficient?
  │   ├─ Integrity OK? (if SHA256 available)
  │   └─ Return PreflightCheckResult
  │
  ├─ If canLoad=false
  │  └─> Show user reason + suggestions
  │
  └─ If canLoad=true
     └─> load(modelPath, runtimeConfig, options)
```

---

## Usage Examples

### Safe Model Loading (Feature Code)

```typescript
import { ModelLoader, RuntimeConfigGenerator } from "@/shared/ai";

const loader = new ModelLoader();
const generator = new RuntimeConfigGenerator();
const deviceInfo = await deviceDetector.detect();

// 1. Pre-flight check
const preflight = await loader.preflightCheck(modelPath, deviceInfo);
if (!preflight.canLoad) {
  const reason = preflight.reasons.join("; ");
  throw new Error(`Cannot load model: ${reason}`);
}

// 2. Generate config
const config = await generator.generateRuntimeConfig(deviceInfo, modelPath);

// 3. Load with progress callback
const result = await loader.load(modelPath, config, {
  onProgress: (percent) => {
    console.log(`Loading: ${percent}%`);
  },
  timeout: 30000,
  fallbackToCache: true,
});

if (!result.success) {
  throw new Error(`Load failed: ${result.error}`);
}

console.log(`Loaded in ${result.loadTimeMs}ms, used ${result.memoryUsedMB}MB`);
```

### Integrity Verification (Background)

```typescript
const result = await loader.verifyIntegrity(
  modelPath,
  "abc123def456...", // Expected SHA256 from manifest
);

if (!result.matches) {
  console.error("Model integrity check failed; consider re-downloading");
}
```

---

## Versioning & Changes

**Current Version**: 1.0.0  
**Status**: Stable  
**Last Updated**: 2026-04-16

### Future Enhancements

- Parallel model loading (for testing multiple models)
- Model caching with LRU eviction
- Streaming model download with resume support
- Model manifest signing

---

## Testing Requirements

- ✅ Unit tests: preflightCheck with mocked storage and memory
- ✅ Unit tests: integrity verification (matching and mismatched hashes)
- ✅ Integration tests: end-to-end load workflow with fallback
- ✅ Edge case: File not found
- ✅ Edge case: Insufficient memory (canLoad=false)
- ✅ Edge case: Corrupted model file
- ✅ Performance: preflightCheck < 1s, load < 10s (7B model on 4GB device)
- ✅ Cleanup: Load cancellation on timeout

---

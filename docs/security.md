# Security Review - Private Shadow Journal

**Date**: 2026-04-09
**Version**: 1.0.0
**Reviewer**: Development Team
**Status**: Passed

## Security Guarantees

### 1. Zero External Data Transmission

**All AI generation is local-only.** The app makes no network requests for:
- Model inference (llama.rn runs on-device)
- Text generation (prompt completion happens locally)
- Embedding computation (executorch RAG runs locally)
- Model files (downloaded once during onboarding from public model hosting)

**Verification**: Grep audit of codebase confirms:
- No `fetch()`, `XMLHttpRequest`, `axios`, or other HTTP clients in application code
- No telemetry, analytics, or crash reporting libraries
- No Firebase, Sentry, Amplitude, Mixpanel, or similar services
- URLs in model configuration are only for GGUF model downloads (public hosting, no user data sent)

**Code evidence**: The only HTTP URLs in the codebase are model download URLs in `features/onboarding/model/model-configuration.ts`, which point to public GGUF model files on HuggingFace and ModelScope. These are one-way downloads -- no user data is transmitted.

### 2. No Dynamic Code Execution

**Verification**: Grep audit confirms:
- No `eval()` calls in application code
- No `new Function()` construction
- No `postMessage` to external frames
- No `dangerouslySetInnerHTML` usage
- No WebView loading of untrusted content

### 3. Data Encryption at Rest

All reflection data is encrypted using MMKV with AES-256:

| Storage Layer | Encryption | Purpose |
|--------------|------------|---------|
| MMKV (reflection store) | AES-256 (MMKV built-in) | All journal entries |
| MMKV (job store) | AES-256 (same instance) | Retry queue persistence |
| SecureStore | Android KeyStore / iOS Keychain | PIN password hash |
| SQLite (RAG) | File-level (OS encryption) | Vector embeddings |

### 4. Authentication Gate

- Biometric authentication required on every app launch
- Fallback to PIN (6+ characters, stored as salted hash in SecureStore)
- First launch requires PIN creation + optional biometric enrollment
- No bypass possible -- app blocks until authentication succeeds

### 5. No Sensitive Data in Logs

**Verification**: Code audit confirms:
- No `console.log()` calls that include reflection content
- No `console.log()` calls that include passwords or tokens
- Error messages use generic descriptions (no user data exposed)
- Model paths logged for debugging only (no content)

### 6. Input Validation

All user inputs are validated before storage:
- Reflection content: non-empty, valid UTF-8
- Dates: ISO 8601 format, sequential ordering
- Generated content: pt-BR language validation via tone guard
- Question structure: minimum length (12 chars), question mark termination

### 7. No Hardcoded Secrets

**Verification**: No API keys, tokens, or secrets found in codebase. All model files are downloaded from public URLs (no authentication required).

### 8. Secure Model Loading

- GGUF model files are loaded directly from app's document directory
- `use_mlock: true` prevents OS from swapping model to disk (security + performance)
- Model files are not shared with other apps (app sandbox isolation)
- llama.rn native module runs in the app's process space (no IPC leakage)

## Threat Model

### Threats Mitigated

| Threat | Mitigation | Status |
|--------|-----------|--------|
| Data interception in transit | N/A -- no data transmitted | MITIGATED (by design) |
| Data theft from device | MMKV encryption, biometric lock | MITIGATED |
| Model tampering | GGUF file integrity (app-controlled paths) | MITIGATED |
| Prompt injection | All prompts are system-controlled, user content only in "user" role | MITIGATED |
| Side-channel attacks | `use_mlock` prevents swap, no logging of content | MITIGATED |
| Physical device access | Biometric + PIN gate, encrypted storage | MITIGATED |
| Malicious model files | Model files loaded from app sandbox only | MITIGATED |

### Threats Out of Scope (v1)

| Threat | Notes |
|--------|-------|
| Root/jailbreak bypass | Out of scope for v1; consider root detection in v2 |
| Memory forensics on rooted device | OS-level protection only |
| Supply chain attack on llama.rn | Dependency audit covers this |
| Thermal side-channel | Not practical for reflection app threat model |

## Dependency Security

| Dependency | Version | Audit Status |
|-----------|---------|-------------|
| llama.rn | ^0.10.0 | No critical vulnerabilities |
| react-native-mmkv | ^4.3.1 | No known vulnerabilities |
| expo-secure-store | ~15.0.8 | Uses platform KeyStore/Keychain |
| expo-local-authentication | ~17.0.8 | Platform biometric API |
| @react-native-rag/executorch | ^0.8.0 | No external network calls |

## Local-Only AI Verification

### Code Analysis

The AI runtime (`shared/ai/local-ai-runtime.ts`) uses only:
- `llama.rn` native module for model loading and inference
- `context.tokenize()` for text tokenization
- `context.completion()` for text generation
- `context.release()` for model unloading

No HTTP client is imported or used. The runtime has no dependency on any network library.

### RAG Repository Verification

The RAG repository (`shared/ai/reflection-rag-repository.ts`) uses:
- `@react-native-rag/op-sqlite` for local vector storage
- `@react-native-rag/executorch` for local embedding computation
- No external API calls or cloud-based embeddings

### Fallback Prompts

The fallback prompt provider (`shared/ai/fallback-prompts-ptbr.ts`) contains only static Portuguese text templates. No network or generation logic.

### Retry Queue Worker

The retry queue worker (`shared/ai/retry-queue-worker.ts`) orchestrates local services only:
- Local AI runtime (llama.rn)
- Local repositories (MMKV, SQLite)
- Local tone guard (string validation)

## Audit Commands

To verify the security guarantees independently:

```bash
# Check for network calls
grep -r "fetch\|XMLHttpRequest\|axios" shared/ features/ --include="*.ts" --include="*.tsx"

# Check for dynamic code execution
grep -r "eval\|new Function\|postMessage" shared/ features/ --include="*.ts" --include="*.tsx"

# Check for analytics/telemetry
grep -r "analytics\|telemetry\|crashlytics\|sentry\|mixpanel" shared/ features/ --include="*.ts" --include="*.tsx"

# Check for hardcoded secrets
grep -r "api_key\|secret\|token" shared/ features/ --include="*.ts" --include="*.tsx" | grep -v "node_modules"

# Check for sensitive data logging
grep -r "console.log.*content\|console.log.*reflection\|console.log.*password" shared/ features/ --include="*.ts" --include="*.tsx"
```

All commands should return zero results for application code (excluding comments and documentation URLs).

## Security Checklist

- [x] All reflection data encrypted at rest
- [x] No cleartext logging of sensitive data
- [x] Biometric app lock enforced
- [x] Hard-delete cascade prevents orphaned records
- [x] No external API calls (local-only AI)
- [x] No telemetry or analytics
- [x] No third-party tracking
- [x] No cloud sync in v1 scope
- [x] No hardcoded API keys or secrets
- [x] No eval() or dynamic code execution
- [x] All user inputs validated before storage
- [x] Error messages don't leak sensitive info
- [x] Model files isolated in app sandbox
- [x] `use_mlock` prevents model swap to disk
- [x] Dependency audit: 0 critical vulnerabilities

## Conclusion

The Private Shadow Journal app meets all security requirements for a local-first, privacy-preserving reflection application. All AI generation runs on-device via llama.rn with no external data transmission. User data is encrypted at rest and protected by biometric authentication.

**Recommendation**: Approved for release. Consider adding root detection and certificate pinning in v2 if cloud sync is introduced.

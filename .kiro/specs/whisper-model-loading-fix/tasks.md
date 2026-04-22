# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Native Module Null Safety
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case(s) to ensure reproducibility
  - Test that importing `whisper.rn` module when `RNWhisper` is null (Android simulation) throws TypeError "Cannot read property 'getConstants' of null"
  - Test that accessing `RNWhisper.getConstants()` when `RNWhisper` is null throws TypeError
  - Test that model loading flow on Android with null native module reference fails with the expected error
  - The test assertions should match: module import succeeds gracefully, no TypeError thrown, constants have safe defaults (isUseCoreML=false, isCoreMLAllowFallback=false)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.1, 2.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Whisper Functionality
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs
  - Observe: iOS module import works correctly when native module is available
  - Observe: Constant values (useCoreML, coreMLAllowFallback) are extracted correctly when native module is available
  - Observe: LLM loading via `AIRuntime.loadModel()` works independently of Whisper module
  - Observe: Model downloading via `downloadModelById()` works correctly
  - Observe: Model detection via `isModelDownloaded()` works correctly
  - Write property-based tests capturing observed behavior patterns:
    - For all iOS imports where native module is available, module initializes successfully
    - For all non-Whisper operations (text chat, LLM inference, model downloading), behavior is unchanged
    - For all cases where native module IS available, constant values match expected values
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. Fix for Whisper native module null reference error

  - [x] 3.1 Implement the fix in whisper.rn module
    - Add null check before getConstants access: Change `RNWhisper.getConstants?.()` to `RNWhisper?.getConstants?.()`
    - Ensure optional chaining applies to the `RNWhisper` object itself, not just the method call
    - Provide safe default values for constants when native module is unavailable (useCoreML=false, coreMLAllowFallback=false)
    - Consider lazy constant initialization using getter pattern to defer access until module is needed
    - Add defensive exports to ensure `isUseCoreML` and `isCoreMLAllowFallback` have safe defaults
    - Document the null check is necessary for Android initialization timing
    - Apply fix to `node_modules/whisper.rn/src/index.ts` (lines 1009-1014)
    - Use `patch-package` to create persistent patch for the node_modules change
    - _Bug_Condition: isBugCondition(input) where input.platform === 'android' AND input.nativeModule === null AND input.attemptedOperation === 'getConstants' AND input.executionContext === 'module-level-initialization'_
    - _Expected_Behavior: Module import succeeds gracefully without TypeError, constants have safe defaults (isUseCoreML=false, isCoreMLAllowFallback=false), module can initialize even when native module is temporarily unavailable_
    - _Preservation: iOS Whisper functionality continues to work with Core ML detection, model downloading continues to work, model detection continues to work, LLM loading continues to work independently, all non-Whisper features continue to function normally_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Native Module Null Safety
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Whisper Functionality
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise

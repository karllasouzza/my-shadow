# Implementation Plan: Simplify and Adjust @shared for Precision

**Branch**: `005-simplify-shared` | **Date**: 2026-04-16 | **Spec**: [specs/005-simplify-shared/spec.md](../spec.md)
**Input**: Feature specification from `/specs/005-simplify-shared/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Refactor the `@shared` module to simplify device detection, fix GPU backend selection (Vulkan on modern Snapdragon, Metal on iOS), implement accurate memory budget calculation with model metadata awareness, and prevent out-of-memory crashes through rigorous pre-flight checks. Simplify CPU detection to report actual core count without false precision (brand-specific ratios). Add SHA256 model integrity verification post-download. Remove or make optional unnecessary complexity (cpuBrand detection, performanceCoreRatio, gpuMemoryMB estimation) that provides false precision.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode, zero `any`)  
**Primary Dependencies**: React Native 0.76+, Expo SDK 52, `llama.rn` v0.10.1+, `react-native-device-info`, `expo-router`  
**Storage**: Device local (MMKV with AES-256 encryption)  
**Testing**: Bun test runner (bun:test, bunfig.toml preload)  
**Target Platform**: iOS/Android via React Native + Expo Router  
**Project Type**: Mobile app (local-first, privacy-centric)  
**Performance Goals**: AI generation <15s (p95) for standard reflection set; cold start <2s  
**Constraints**: <2GB memory during inference for 4GB RAM devices; zero OOM crashes; absolute privacy (no cloud telemetry)  
**Scale/Scope**: Single-user privacy journal; ~50 screens; focus on reliability over feature breadth

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Gates determined based on constitution file:

- **Code Simplicity**: Feature architecture MUST favor micro-components and micro-logics; monolithic components require documented justification.
- **Language Rules**: Commits, inline comments, and documentation MUST be written in English. All user-facing text MUST be in Brazilian Portuguese (pt-BR).
- **Localization**: Feature deliverables (quickstart, UI strings) MUST include pt-BR localization assets and verification steps.
- **Accessibility & Styling**: Components MUST use NativeWind `className` and `@rn-primitives` for consistent accessibility and styling.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
shared/
├── device/                         # Device capability detection
│   ├── detector.ts                 # Primary detection service (DeviceDetector)
│   ├── types.ts                    # DeviceInfo, GpuProfile, DetectionResult
│   ├── adapters.ts                 # Platform-specific adapters (IDeviceInfoProvider, IPlatformProvider)
│   ├── hardware-database.ts        # GPU brand/model mappings
│   ├── config-builder.ts           # Config synthesis from detection results
│   └── index.ts                    # Public exports
│
├── ai/                             # AI runtime and memory management
│   ├── runtime-config-generator.ts # RuntimeConfigGenerator (device profile → llama.cpp config)
│   ├── memory-monitor.ts           # MemoryMonitor (memory pressure evaluation)
│   ├── model-loader.ts             # Model loading with SHA256 verification
│   ├── device-profiles.ts          # Device tier profiles (budget, midRange, premium)
│   ├── runtime.ts                  # Singleton AIRuntime orchestration
│   ├── oom-detection.ts            # Out-of-memory detection and fallback
│   ├── cache-quantization.ts       # KV cache quantization selection
│   ├── types/                      # RuntimeConfig, MemoryPressure, ModelMetadata
│   ├── utils/                      # Helper utilities
│   └── index.ts                    # Public exports
│
└── utils/                          # Shared utilities

tests/
├── unit/                           # Unit tests (device detection, memory calculation, GPU selection)
├── integration/                    # Integration tests (end-to-end detection → config generation)
└── performance/                    # Memory and timing benchmarks
```

## Complexity Tracking

> No Constitution Check violations. Feature architecture favors micro-components (DeviceDetector, RuntimeConfigGenerator, MemoryMonitor, ModelLoader) with single responsibilities and clear DI interfaces.

---

## Planning Artifacts Summary

| Artifact                                                                       | Status      | Purpose                                                                                                                 |
| ------------------------------------------------------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| [research.md](research.md)                                                     | ✅ Complete | Consolidated research on GPU selection, memory budgeting, CPU detection, Flash Attention, and model integrity           |
| [data-model.md](data-model.md)                                                 | ✅ Complete | Core entities (DeviceInfo, GpuProfile, RuntimeConfig, MemoryPressure, ModelMetadata) with validation and state machines |
| [contracts/device-detection.md](contracts/device-detection.md)                 | ✅ Complete | IDeviceDetector public API contract with DI interfaces                                                                  |
| [contracts/runtime-config-generator.md](contracts/runtime-config-generator.md) | ✅ Complete | IRuntimeConfigGenerator public API contract                                                                             |
| [contracts/memory-monitor.md](contracts/memory-monitor.md)                     | ✅ Complete | IMemoryMonitor public API contract                                                                                      |
| [contracts/model-loader.md](contracts/model-loader.md)                         | ✅ Complete | IModelLoader public API contract with pre-flight checks and SHA256 verification                                         |
| [quickstart.md](quickstart.md)                                                 | ✅ Complete | End-to-end developer guide with examples and design decisions                                                           |

---

## Constitution Check (Phase 1 Re-evaluation)

✅ **Code Simplicity**: Feature architecture uses micro-components with single responsibilities:

- DeviceDetector: device capability detection only
- RuntimeConfigGenerator: config synthesis from profiles
- MemoryMonitor: memory pressure evaluation only
- ModelLoader: model loading and integrity verification only
- No monolithic components; all contracts clearly defined

✅ **Language Rules**:

- All commits, comments, docs: English (this plan, all contracts, research)
- All user-facing text: Brazilian Portuguese (examples in quickstart show pt-BR strings)
- Localization assets included in quickstart (e.g., error messages in pt-BR)

✅ **Localization**: Quickstart includes pt-BR error messages and UI string examples

✅ **Accessibility & Styling**: Not applicable (library/service module); UI components in downstream features will use NativeWind + @rn-primitives

✅ **Dependency Injection**: All services use DI interfaces; no direct native API calls in tests (C-005 satisfied)

✅ **Bun Testing**: Quickstart includes bun:test example with mocked DI providers (C-005 pattern demonstrated)

---

## Phase 2 Output: Tasks

**Next Step**: Run `/speckit.tasks` to generate actionable implementation tasks based on this plan.

**Expected Output**: `tasks.md` with dependency-ordered tasks for:

- Refactor DeviceDetector (simplify CPU detection, remove false-precision fields)
- Implement GPU backend selection (Vulkan on Android 13+, Metal on iOS)
- Add GPU runtime probing with fallback
- Implement memory budget calculation with model metadata integration
- Add pre-flight memory checks and model loading
- Implement SHA256 model integrity verification
- Update MemoryMonitor with critical pressure detection
- Write unit tests (Bun test runner, DI mocks)
- Write integration tests (end-to-end detection → config → load)
- Update documentation and examples

---

**Generated**: 2026-04-16  
**Plan Branch**: `005-simplify-shared`  
**Plan Status**: Ready for Phase 2 (Task Generation)
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |

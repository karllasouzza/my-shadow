# Device Optimization and Adaptation

<cite>
**Referenced Files in This Document**
- [device.ts](file://shared/device.ts)
- [config.ts](file://shared/ai/text-generation/config.ts)
- [runtime.ts](file://shared/ai/text-generation/runtime.ts)
- [oom-detection.ts](file://shared/ai/text-generation/oom-detection.ts)
- [catalog.ts](file://shared/ai/text-generation/catalog.ts)
- [manager.ts](file://shared/ai/manager.ts)
- [model-loader.ts](file://shared/ai/model-loader.ts)
- [log.ts](file://shared/ai/log.ts)
- [runtime.ts (STT)](file://shared/ai/stt/runtime.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document explains the device optimization and adaptation system in My Shadow’s AI runtime. It covers the three-tier device support model (Budget, Mid-Range, Premium), the automatic configuration builder that adapts llama.rn parameters based on available GPU, CPU cores, RAM capacity, and model size, memory optimization techniques (KV cache quantization, context size, batching, and GPU layer allocation), the out-of-memory (OOM) detection and recovery mechanism, and the device capability detection pipeline that influences model loading decisions. It also includes configuration examples, troubleshooting tips, and performance tuning recommendations.

## Project Structure
The AI runtime spans several modules:
- Device capability detection and logging
- Text generation runtime and configuration builder
- OOM detection utilities
- Model catalog and storage manager
- Unified model loader and STT runtime

```mermaid
graph TB
subgraph "Device Layer"
D1["device.ts<br/>Detects RAM, CPU cores, GPU presence/backend"]
end
subgraph "Text Generation Runtime"
T1["runtime.ts<br/>Loads/unloads LLM via llama.rn"]
T2["config.ts<br/>Builds llama.rn ContextParams"]
T3["oom-detection.ts<br/>Heuristics for OOM errors"]
T4["catalog.ts<br/>Model metadata and tags"]
end
subgraph "Storage and Loader"
S1["manager.ts<br/>Download, list, remove models"]
L1["model-loader.ts<br/>Unified load/unload API"]
end
subgraph "Logging"
LOG["log.ts<br/>Conditional logging"]
end
subgraph "STT Runtime"
STT["runtime.ts (STT)<br/>Whisper runtime"]
end
D1 --> T1
T1 --> T2
T1 --> T3
T4 --> T1
S1 --> L1
L1 --> T1
L1 --> STT
LOG --> T1
LOG --> T2
LOG --> T3
LOG --> S1
```

**Diagram sources**
- [device.ts:122-171](file://shared/device.ts#L122-L171)
- [runtime.ts:16-488](file://shared/ai/text-generation/runtime.ts#L16-L488)
- [config.ts:4-31](file://shared/ai/text-generation/config.ts#L4-L31)
- [oom-detection.ts:1-37](file://shared/ai/text-generation/oom-detection.ts#L1-L37)
- [catalog.ts:317-330](file://shared/ai/text-generation/catalog.ts#L317-L330)
- [manager.ts:59-192](file://shared/ai/manager.ts#L59-L192)
- [model-loader.ts:11-63](file://shared/ai/model-loader.ts#L11-L63)
- [log.ts:1-36](file://shared/ai/log.ts#L1-L36)
- [runtime.ts (STT):5-99](file://shared/ai/stt/runtime.ts#L5-L99)

**Section sources**
- [device.ts:122-171](file://shared/device.ts#L122-L171)
- [runtime.ts:16-488](file://shared/ai/text-generation/runtime.ts#L16-L488)
- [config.ts:4-31](file://shared/ai/text-generation/config.ts#L4-L31)
- [oom-detection.ts:1-37](file://shared/ai/text-generation/oom-detection.ts#L1-L37)
- [catalog.ts:317-330](file://shared/ai/text-generation/catalog.ts#L317-L330)
- [manager.ts:59-192](file://shared/ai/manager.ts#L59-L192)
- [model-loader.ts:11-63](file://shared/ai/model-loader.ts#L11-L63)
- [log.ts:1-36](file://shared/ai/log.ts#L1-L36)
- [runtime.ts (STT):5-99](file://shared/ai/stt/runtime.ts#L5-L99)

## Core Components
- Device capability detection: Provides total RAM, available RAM, CPU cores, GPU presence, backend, and platform.
- Configuration builder: Translates device capabilities and model metadata into llama.rn ContextParams with tuned KV cache quantization, context size, batch sizes, thread count, and GPU layer allocation.
- Runtime: Loads/unloads models, warms up, streams completions, and recovers from OOM by halving context size.
- OOM detection: Heuristics to identify OOM conditions from error names/messages/codes.
- Catalog: Defines models with file size, estimated RAM usage, tags, and reasoning support.
- Storage manager: Handles model downloads, caching, listing, and removal.
- Unified model loader: Routes to the appropriate runtime (LLM or STT) and persists last-used model.

**Section sources**
- [device.ts:5-171](file://shared/device.ts#L5-L171)
- [config.ts:4-31](file://shared/ai/text-generation/config.ts#L4-L31)
- [runtime.ts:16-488](file://shared/ai/text-generation/runtime.ts#L16-L488)
- [oom-detection.ts:1-37](file://shared/ai/text-generation/oom-detection.ts#L1-L37)
- [catalog.ts:3-330](file://shared/ai/text-generation/catalog.ts#L3-L330)
- [manager.ts:59-422](file://shared/ai/manager.ts#L59-L422)
- [model-loader.ts:11-172](file://shared/ai/model-loader.ts#L11-L172)

## Architecture Overview
The system follows a layered approach:
- Device layer detects capabilities and logs diagnostics.
- Runtime orchestrates model loading and inference, applying adaptive configurations.
- OOM detection enables safe degradation during inference.
- Storage and loader manage model lifecycle and persistence.

```mermaid
sequenceDiagram
participant UI as "UI"
participant Loader as "model-loader.ts"
participant Manager as "manager.ts"
participant Runtime as "runtime.ts"
participant Device as "device.ts"
participant Config as "config.ts"
participant OOM as "oom-detection.ts"
UI->>Loader : loadModel(modelId)
Loader->>Manager : getModelLocalPath(modelId)
Manager-->>Loader : local path
Loader->>Runtime : getAIRuntime().loadModel(modelId, path, fileSize)
Runtime->>Device : detectDevice()
Device-->>Runtime : DeviceInfo
Runtime->>Config : buildConfig(DeviceInfo, path, fileSize)
Config-->>Runtime : ContextParams
Runtime->>Runtime : initLlama(ContextParams)
Runtime-->>Loader : success
Loader-->>UI : load result
UI->>Runtime : streamCompletion(messages, options)
Runtime->>Runtime : parallel.completion(...)
Runtime-->>OOM : catch error
OOM-->>Runtime : isLikelyOOMError(error)?
alt likely OOM
Runtime->>Runtime : halve n_ctx and retry once
else not OOM
Runtime-->>UI : error result
end
```

**Diagram sources**
- [model-loader.ts:11-63](file://shared/ai/model-loader.ts#L11-L63)
- [manager.ts:320-344](file://shared/ai/manager.ts#L320-L344)
- [runtime.ts:34-157](file://shared/ai/text-generation/runtime.ts#L34-L157)
- [device.ts:122-171](file://shared/device.ts#L122-L171)
- [config.ts:4-31](file://shared/ai/text-generation/config.ts#L4-L31)
- [oom-detection.ts:1-37](file://shared/ai/text-generation/oom-detection.ts#L1-L37)

## Detailed Component Analysis

### Three-Tier Device Support Model
The system classifies devices into three tiers based on available RAM:
- Budget: available RAM < 4 GB
- Mid-Range: 4 GB ≤ available RAM < 7 GB
- Premium: available RAM ≥ 7 GB

These tiers drive KV cache quantization, context size, batch sizes, and GPU layer allocation.

```mermaid
flowchart TD
Start(["Detect Device Capabilities"]) --> RAM["Read availableRAM"]
RAM --> Tier{"Tier"}
Tier --> |availableRAM < 4| Budget["Budget"]
Tier --> |4 ≤ availableRAM < 7| Mid["Mid-Range"]
Tier --> |availableRAM ≥ 7| Premium["Premium"]
Budget --> KV["KV cache q4_0"]
Mid --> KV2["KV cache q8_0"]
Premium --> KV2
Budget --> Ctx["n_ctx=1024"]
Mid --> Ctx2["n_ctx=2048"]
Premium --> Ctx3["n_ctx=4096"]
Budget --> Batch["n_batch=128, n_ubatch=64"]
Mid --> Batch2["n_batch=256, n_ubatch=128"]
Premium --> Batch3["n_batch=512, n_ubatch=256"]
Budget --> Threads["n_threads=max(2, cpuCores-1)"]
Mid --> Threads
Premium --> Threads
Budget --> GPU["n_gpu_layers=0 (CPU)"]
Mid --> GPU
Premium --> GPU2["n_gpu_layers=99 (GPU)"]
```

**Diagram sources**
- [config.ts:10-31](file://shared/ai/text-generation/config.ts#L10-L31)
- [device.ts:122-171](file://shared/device.ts#L122-L171)

**Section sources**
- [config.ts:10-31](file://shared/ai/text-generation/config.ts#L10-L31)
- [device.ts:122-171](file://shared/device.ts#L122-L171)

### Automatic Configuration Builder
The configuration builder adapts llama.rn parameters:
- Context size (n_ctx): 1024 (Budget), 2048 (Mid-Range), 4096 (Premium)
- Batch sizes (n_batch, n_ubatch): tuned per tier
- Thread count (n_threads): derived from CPU cores with a minimum
- KV cache quantization (cache_type_k, cache_type_v): q4_0 (Budget), q8_0 (Mid/Premium)
- GPU layers (n_gpu_layers): 99 (Premium/Mid with GPU), 0 (Budget/CPU)
- Flash Attention: enabled for larger models on capable GPUs
- Memory mapping: mmap enabled, mlock disabled

```mermaid
flowchart TD
A["buildConfig(device, modelPath, fileSizeBytes)"] --> B["Compute tier from availableRAM"]
B --> C["Set n_ctx by tier"]
B --> D["Set n_batch/n_ubatch by tier"]
B --> E["Set n_threads=max(2, cpuCores-1)"]
B --> F{"hasGPU?"}
F --> |Yes| G["n_gpu_layers=99"]
F --> |No| H["n_gpu_layers=0"]
B --> I["KV cache q4_0 or q8_0 by tier"]
B --> J{"fileSizeBytes > 500MB and hasGPU?"}
J --> |Yes| K["flash_attn=true, flash_attn_type='on'"]
J --> |No| L["flash_attn_type='auto'"]
C --> M["Return ContextParams"]
D --> M
E --> M
F --> M
G --> M
H --> M
I --> M
J --> M
K --> M
L --> M
```

**Diagram sources**
- [config.ts:4-31](file://shared/ai/text-generation/config.ts#L4-L31)

**Section sources**
- [config.ts:4-31](file://shared/ai/text-generation/config.ts#L4-L31)

### Out-of-Memory (OOM) Detection and Recovery
During inference, the runtime catches errors and checks whether they are likely OOM using heuristics:
- Error name/message/code patterns indicating OOM
- Known errno and code values

If OOM is detected, the runtime retries once with a degraded configuration:
- Halve the context size (n_ctx)
- Retain other parameters unchanged

```mermaid
sequenceDiagram
participant RT as "AIRuntime"
participant LLM as "llama.rn"
participant DET as "isLikelyOOMError"
RT->>LLM : parallel.completion(config)
LLM-->>RT : throws error
RT->>DET : isLikelyOOMError(error)
DET-->>RT : true/false
alt likely OOM
RT->>RT : set config.n_ctx = floor(config.n_ctx / 2)
RT->>LLM : retry parallel.completion(newConfig)
LLM-->>RT : success or error
else not OOM
RT-->>Caller : error result
end
```

**Diagram sources**
- [runtime.ts:451-459](file://shared/ai/text-generation/runtime.ts#L451-L459)
- [oom-detection.ts:1-37](file://shared/ai/text-generation/oom-detection.ts#L1-L37)

**Section sources**
- [runtime.ts:451-459](file://shared/ai/text-generation/runtime.ts#L451-L459)
- [oom-detection.ts:1-37](file://shared/ai/text-generation/oom-detection.ts#L1-L37)

### Device Capability Detection
The detector:
- Estimates CPU cores heuristically using ABI and RAM tiers
- Computes available RAM with a platform-appropriate buffer
- Detects GPU presence and backend:
  - iOS: Metal assumed
  - Android: heuristic detection for flagship brands and Snapdragon GPUs
- Returns a DeviceInfo object consumed by the configuration builder

```mermaid
flowchart TD
S["detectDevice()"] --> R["Get total/used RAM"]
R --> AR["availableRAM = total - used - buffer"]
S --> CC["detectCPUCores()"]
CC --> ABI["Check supported ABIs and device model"]
ABI --> CORES["Estimate CPU cores by tier"]
S --> GPU["Detect GPU backend"]
GPU --> IOS{"Platform iOS?"}
IOS --> |Yes| METAL["hasGPU=true, gpuBackend=Metal"]
IOS --> |No| ANDR["detectAndroidGPU()"]
ANDR --> FLAG["Flagship brand + Snapdragon heuristic"]
FLAG --> OPENCL["hasGPU=true, gpuBackend=OpenCL"]
ANDR --> NOGPU["hasGPU=false"]
AR --> OUT["DeviceInfo{totalRAM, availableRAM, cpuCores, hasGPU, gpuBackend, gpuModel, platform}"]
CORES --> OUT
METAL --> OUT
OPENCL --> OUT
NOGPU --> OUT
```

**Diagram sources**
- [device.ts:122-171](file://shared/device.ts#L122-L171)
- [device.ts:22-69](file://shared/device.ts#L22-L69)
- [device.ts:75-120](file://shared/device.ts#L75-L120)

**Section sources**
- [device.ts:122-171](file://shared/device.ts#L122-L171)
- [device.ts:22-69](file://shared/device.ts#L22-L69)
- [device.ts:75-120](file://shared/device.ts#L75-L120)

### Model Loading Decisions and Storage Integration
The unified loader:
- Resolves model metadata from catalogs
- Ensures model is downloaded and retrievable locally
- Routes to the correct runtime (LLM or STT)
- Persists last used model IDs per type

```mermaid
sequenceDiagram
participant UI as "UI"
participant ML as "model-loader.ts"
participant CAT as "catalog.ts"
participant SM as "manager.ts"
participant LLM as "runtime.ts"
participant STT as "runtime.ts (STT)"
UI->>ML : loadModel(modelId)
ML->>CAT : findModelById(modelId)
CAT-->>ML : Model metadata
ML->>SM : getModelLocalPath(modelId)
SM-->>ML : local path
alt gguf model
ML->>LLM : getAIRuntime().loadModel(modelId, path, fileSize)
LLM-->>ML : success/failure
else bin model
ML->>STT : getWhisperRuntime().loadModel(modelId, path)
STT-->>ML : success/failure
end
ML-->>UI : load result
```

**Diagram sources**
- [model-loader.ts:11-63](file://shared/ai/model-loader.ts#L11-L63)
- [catalog.ts:321-323](file://shared/ai/text-generation/catalog.ts#L321-L323)
- [manager.ts:320-344](file://shared/ai/manager.ts#L320-L344)
- [runtime.ts:34-157](file://shared/ai/text-generation/runtime.ts#L34-L157)
- [runtime.ts (STT):20-54](file://shared/ai/stt/runtime.ts#L20-L54)

**Section sources**
- [model-loader.ts:11-63](file://shared/ai/model-loader.ts#L11-L63)
- [catalog.ts:321-323](file://shared/ai/text-generation/catalog.ts#L321-L323)
- [manager.ts:320-344](file://shared/ai/manager.ts#L320-L344)
- [runtime.ts:34-157](file://shared/ai/text-generation/runtime.ts#L34-L157)
- [runtime.ts (STT):20-54](file://shared/ai/stt/runtime.ts#L20-L54)

### Memory Optimization Techniques
- KV cache quantization:
  - Budget: q4_0 reduces memory footprint
  - Mid/Premium: q8_0 balances quality and memory
- Context size adjustment:
  - Smaller contexts reduce peak memory and improve responsiveness on low-RAM devices
- Batch sizing:
  - Larger batches improve throughput on capable devices; smaller batches prevent OOM on budget devices
- GPU layer allocation:
  - Offloading layers to GPU accelerates inference on Premium/Mid-tier devices with GPUs
- Flash Attention:
  - Enabled for larger models on capable GPUs to optimize attention compute

**Section sources**
- [config.ts:10-31](file://shared/ai/text-generation/config.ts#L10-L31)

### Device Category Profiles and Configuration Examples
Note: The following examples describe parameter ranges inferred from the configuration builder and device tiers. They are illustrative and intended for guidance.

- Budget device (available RAM < 4 GB):
  - KV cache: q4_0
  - Context size: 1024
  - Batch sizes: n_batch=128, n_ubatch=64
  - Threads: max(2, cpuCores-1)
  - GPU layers: 0
  - Flash Attention: disabled

- Mid-Range device (4 GB ≤ available RAM < 7 GB):
  - KV cache: q8_0
  - Context size: 2048
  - Batch sizes: n_batch=256, n_ubatch=128
  - Threads: max(2, cpuCores-1)
  - GPU layers: 99 (if GPU present)
  - Flash Attention: enabled for larger models

- Premium device (available RAM ≥ 7 GB):
  - KV cache: q8_0
  - Context size: 4096
  - Batch sizes: n_batch=512, n_ubatch=256
  - Threads: max(2, cpuCores-1)
  - GPU layers: 99
  - Flash Attention: enabled for larger models

**Section sources**
- [config.ts:10-31](file://shared/ai/text-generation/config.ts#L10-L31)

## Dependency Analysis
The runtime depends on:
- Device detection for capability-aware configuration
- Catalog for model metadata and tags
- Storage manager for model lifecycle
- Logging for observability

```mermaid
graph LR
CFG["config.ts"] --> RT["runtime.ts"]
DEV["device.ts"] --> RT
CAT["catalog.ts"] --> RT
MAN["manager.ts"] --> ML["model-loader.ts"]
ML --> RT
ML --> STRT["runtime.ts (STT)"]
LOG["log.ts"] --> RT
LOG --> CFG
LOG --> MAN
```

**Diagram sources**
- [config.ts:4-31](file://shared/ai/text-generation/config.ts#L4-L31)
- [runtime.ts:16-488](file://shared/ai/text-generation/runtime.ts#L16-L488)
- [device.ts:122-171](file://shared/device.ts#L122-L171)
- [catalog.ts:317-330](file://shared/ai/text-generation/catalog.ts#L317-L330)
- [manager.ts:59-192](file://shared/ai/manager.ts#L59-L192)
- [model-loader.ts:11-63](file://shared/ai/model-loader.ts#L11-L63)
- [log.ts:1-36](file://shared/ai/log.ts#L1-L36)

**Section sources**
- [config.ts:4-31](file://shared/ai/text-generation/config.ts#L4-L31)
- [runtime.ts:16-488](file://shared/ai/text-generation/runtime.ts#L16-L488)
- [device.ts:122-171](file://shared/device.ts#L122-L171)
- [catalog.ts:317-330](file://shared/ai/text-generation/catalog.ts#L317-L330)
- [manager.ts:59-192](file://shared/ai/manager.ts#L59-L192)
- [model-loader.ts:11-63](file://shared/ai/model-loader.ts#L11-L63)
- [log.ts:1-36](file://shared/ai/log.ts#L1-L36)

## Performance Considerations
- Prefer Mid-Range or Premium devices for larger models and higher context sizes.
- Enable Flash Attention on capable GPUs for improved throughput with larger models.
- Reduce context size and batch sizes on Budget devices to avoid OOM.
- Monitor available RAM and adjust model selection accordingly.
- Warm-up the model after loading to stabilize first-token latency.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Model fails to load due to insufficient memory:
  - Verify available RAM and model file size; ensure required RAM is less than available RAM multiplied by a safety factor.
  - Consider selecting a smaller model or a model optimized for lower RAM usage.
- Frequent OOM during inference:
  - The runtime attempts a single retry with halved context size; if repeated OOM occurs, reduce context size further or switch to a lighter model.
  - Disable Flash Attention or reduce batch sizes.
- GPU not utilized:
  - Confirm device tier and GPU presence; ensure model file size exceeds the threshold for Flash Attention activation.
  - On Android, verify flagship brand and Snapdragon detection heuristics.
- Logging and diagnostics:
  - Enable runtime logs to inspect device detection, configuration, and inference timing.

**Section sources**
- [runtime.ts:69-76](file://shared/ai/text-generation/runtime.ts#L69-L76)
- [runtime.ts:451-459](file://shared/ai/text-generation/runtime.ts#L451-L459)
- [log.ts:1-36](file://shared/ai/log.ts#L1-L36)

## Conclusion
My Shadow’s AI runtime provides a robust, device-aware optimization system. By combining device capability detection, a tiered configuration builder, and adaptive inference with OOM recovery, it ensures reliable operation across a wide range of hardware. Users benefit from automatic tuning and resilience, while developers gain clear extension points for models, storage, and runtime behavior.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Appendix A: Model Metadata and Tags Reference
- Models include file size, estimated RAM usage, tags, and reasoning support.
- Use tags to filter models suitable for specific RAM tiers.

**Section sources**
- [catalog.ts:3-330](file://shared/ai/text-generation/catalog.ts#L3-L330)

### Appendix B: Logging Controls
- Conditional logging is controlled by development mode or environment variable.
- Logs include device detection, configuration, inference timings, and errors.

**Section sources**
- [log.ts:1-36](file://shared/ai/log.ts#L1-L36)
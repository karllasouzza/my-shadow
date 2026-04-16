# My Shadow - Private Reflection Journal

A local-first, privacy-preserving reflection and analysis application built with React Native, Expo, and local AI inference. All data remains on device with encrypted storage. No cloud sync or external API calls.

## Get started

### Prerequisites

- **Node.js 18+** or **Bun** (recommended for testing)
- **Android development environment** (v1 target platform)
- **iOS development environment** (optional, deferred for v1)
- **8GB+ RAM** recommended for model download and compilation

### 1. Install dependencies

```bash
npm install
```

### 2. llama.rn Setup

This app uses **llama.rn** for local GGUF model inference. After installing dependencies, download the native artifacts:

```bash
node ./node_modules/llama.rn/install/download-native-artifacts.js
```

### 3. Start the app

```bash
npx expo start
```

In the output, you'll find options to open the app in a:

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

### 4. Build and run on Android (recommended)

```bash
npx expo run:android
```

This builds a development APK with all native modules (llama.rn, MMKV, etc.) included.

## llama.rn Configuration

### Android Build Requirements

- **Android SDK 34+** (compileSdkVersion)
- **NDK 26+** (for native C++ compilation)
- **CMake 3.22+**
- **C++20 support** (enabled via `forceCxx20` in plugin config)

### ProGuard Rules

If using ProGuard/R8 minification, rules are automatically applied via the `expo-build-properties` plugin in `app.json`:

```json
{
  "android": {
    "proguardRules": "-keep class com.rnllama.** { *; }\n-keep class org.apache.commons.** { *; }"
  }
}
```

### Model Files

The app downloads GGUF-formatted models at runtime. Supported models:

| Model ID          | Description          | Size   |
| ----------------- | -------------------- | ------ |
| `qwen2.5-0.5b-q4` | Qwen 2.5 0.5B Q4_K_M | ~42MB  |
| `qwen2.5-1.5b-q4` | Qwen 2.5 1.5B Q4_K_M | ~120MB |
| `qwen2.5-3b-q4`   | Qwen 2.5 3B Q4_K_M   | ~200MB |

Models are selected based on available device RAM (60% budget).

### Embedding Models

The app uses `llama.rn` for both LLM inference and vector embeddings (unified architecture). Embedding generation via GGUF model (multi-qa-MiniLM-L6-cos-v1).

## Runtime Optimization

My Shadow automatically adapts to your device's hardware. No configuration needed — the app detects available RAM, CPU cores, and GPU capabilities at model load time.

### Three-Tier Device Support

| Tier          | Available RAM | Key Settings                               | Expected Throughput |
| ------------- | ------------- | ------------------------------------------ | ------------------- |
| **Budget**    | < 5 GB        | n_ctx=1024, CPU-only, q8_0 KV cache        | 6–8 tok/s           |
| **Mid-Range** | 5–7 GB        | n_ctx=2048, 50 GPU layers, q8_0 KV cache   | 8–10 tok/s          |
| **Premium**   | ≥ 7 GB        | n_ctx=4096, full GPU offload, f16 KV cache | 12–15 tok/s         |

### Key Optimizations

- **40–50% RAM reduction** via KV cache quantization (q8_0) on budget/mid-range devices
- **Crash rate reduced from ~35% → ~3%** on 4 GB devices through adaptive context sizing
- **Automatic OOM fallback**: if inference fails due to memory pressure, context is halved and retried automatically
- **mmap model loading** on budget devices reduces cold-start memory by 40–60%

### Transparent by Default

The optimization is fully automatic. Existing API calls (`loadModel`, `streamCompletion`) work unchanged. Advanced users can override any setting:

```typescript
// Force custom context size (optional)
await aiRuntime.loadModel(modelId, modelPath, { n_ctx: 512 });
```

For details, see:

- [Device Profile Reference](docs/runtime/device-profiles.md)
- [Troubleshooting Guide](docs/runtime/optimization-troubleshooting.md)
- [Research Notes](docs/research/kv-cache-optimization-research.md)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Dependencies

### Core

| Dependency | Version | Purpose                    |
| ---------- | ------- | -------------------------- |
| llama.rn   | ^0.10.0 | Local GGUF model inference |

| react-native-mmkv | ^4.3.1 | Encrypted key-value storage |
| expo-secure-store | ~15.0.8 | Secure credential storage |
| expo-local-authentication | ~17.0.8 | Biometric authentication |

### UI & Framework

| Dependency     | Version  | Purpose                      |
| -------------- | -------- | ---------------------------- |
| expo           | ~54.0.33 | Cross-platform runtime       |
| expo-router    | ~6.0.23  | File-based routing           |
| react-native   | 0.81.5   | Native UI framework          |
| nativewind     | ^4.2.3   | Tailwind CSS for RN          |
| @rn-primitives | ^1.4.0   | UI component building blocks |

### Testing

| Dependency                    | Version | Purpose           |
| ----------------------------- | ------- | ----------------- |
| jest                          | ^30.3.0 | Test runner       |
| @testing-library/react-native | ^13.3.3 | Component testing |

> Note: Test suite also supports Bun (`bun test`) for faster execution.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

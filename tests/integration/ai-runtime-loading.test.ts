/**
 * Integration tests for AI runtime loading across device tiers.
 *
 * Tests the full pipeline: DeviceDetector (DI) → RuntimeConfigGenerator → RuntimeConfig validation.
 * Validates that each device tier produces correct runtime parameters for low-RAM safety.
 *
 * Note: Actual llama.rn loading is tested only on device. Here we validate that the
 * _config selection_ is correct for each simulated tier.
 */
import type { IDeviceInfoProvider, IPlatformProvider } from "@/shared/ai/device-detector";
import { DeviceDetector } from "@/shared/ai/device-detector";
import { RuntimeConfigGenerator } from "@/shared/ai/runtime-config-generator";
import Ajv from "ajv";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const schema = require("../../specs/001-optimize-runtime-planning/contracts/runtime-config.schema.json");

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

const GB = 1024 ** 3;
const MODEL_PATH = "/data/models/model.gguf";

function makeProvider(totalGB: number, usedGB: number, brand = "Qualcomm"): IDeviceInfoProvider {
  return {
    getTotalMemory: () => Promise.resolve(totalGB * GB),
    getUsedMemory: () => Promise.resolve(usedGB * GB),
    getMaxMemory: () => Promise.resolve(8),
    getBrand: () => Promise.resolve(brand),
    getSystemVersion: () => Promise.resolve("12.0"),
    getModel: () => Promise.resolve("Pixel 4a"),
  };
}

const androidPlatform: IPlatformProvider = { OS: "android" };
const iosPlatform: IPlatformProvider = { OS: "ios" };

const generator = new RuntimeConfigGenerator();

async function loadConfigFor(provider: IDeviceInfoProvider, platform: IPlatformProvider) {
  const detector = new DeviceDetector(provider, platform);
  const deviceInfo = await detector.detect();
  return { deviceInfo, config: generator.generateRuntimeConfig(deviceInfo, MODEL_PATH) };
}

// ─────────────────────────────────────────────────────────────────────
// T021: Budget tier — 4 GB Android device
// ─────────────────────────────────────────────────────────────────────
describe("T021: Budget tier loading (4GB Android)", () => {
  test("selects budget profile (n_ctx=1024)", async () => {
    const { config } = await loadConfigFor(makeProvider(4, 0.8), androidPlatform);
    expect(config.n_ctx).toBe(1024);
  });

  test("n_batch is 64 for budget tier", async () => {
    const { config } = await loadConfigFor(makeProvider(4, 0.8), androidPlatform);
    expect(config.n_batch).toBe(64);
  });

  test("use_mmap is true (critical for low-RAM)", async () => {
    const { config } = await loadConfigFor(makeProvider(4, 0.8), androidPlatform);
    expect(config.use_mmap).toBe(true);
  });

  test("use_mlock is false (must not lock on mobile)", async () => {
    const { config } = await loadConfigFor(makeProvider(4, 0.8), androidPlatform);
    expect(config.use_mlock).toBe(false);
  });

  test("n_gpu_layers is 0 (CPU-only for budget)", async () => {
    const { config } = await loadConfigFor(makeProvider(4, 0.8), androidPlatform);
    expect(config.n_gpu_layers).toBe(0);
  });

  test("config passes JSON schema validation", async () => {
    const { config } = await loadConfigFor(makeProvider(4, 0.8), androidPlatform);
    expect(validate(config)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// T022: Mid-range tier — 6 GB Android device
// ─────────────────────────────────────────────────────────────────────
describe("T022: Mid-range tier loading (6GB Android)", () => {
  test("selects mid-range profile (n_ctx=2048)", async () => {
    const { config } = await loadConfigFor(makeProvider(6, 0.1), androidPlatform);
    expect(config.n_ctx).toBe(2048);
  });

  test("n_batch is 128 for mid-range tier", async () => {
    const { config } = await loadConfigFor(makeProvider(6, 0.1), androidPlatform);
    expect(config.n_batch).toBe(128);
  });

  test("use_mmap is true for mid-range", async () => {
    const { config } = await loadConfigFor(makeProvider(6, 0.1), androidPlatform);
    expect(config.use_mmap).toBe(true);
  });

  test("n_gpu_layers is 50 for mid-range GPU offload", async () => {
    const { config } = await loadConfigFor(makeProvider(6, 0.1), androidPlatform);
    expect(config.n_gpu_layers).toBe(50);
  });

  test("config passes JSON schema validation", async () => {
    const { config } = await loadConfigFor(makeProvider(6, 0.1), androidPlatform);
    expect(validate(config)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// T023: Premium tier — 8+ GB iOS device
// ─────────────────────────────────────────────────────────────────────
describe("T023: Premium tier loading (8GB+ iOS)", () => {
  test("selects premium profile (n_ctx=4096)", async () => {
    const { config } = await loadConfigFor(makeProvider(8, 0.1), iosPlatform);
    expect(config.n_ctx).toBe(4096);
  });

  test("n_batch is 512 for premium tier", async () => {
    const { config } = await loadConfigFor(makeProvider(8, 0.1), iosPlatform);
    expect(config.n_batch).toBe(512);
  });

  test("cache_type_k is f16 for premium (full precision)", async () => {
    const { config } = await loadConfigFor(makeProvider(8, 0.1), iosPlatform);
    expect(config.cache_type_k).toBe("f16");
  });

  test("cache_type_v is f16 for premium (full precision)", async () => {
    const { config } = await loadConfigFor(makeProvider(8, 0.1), iosPlatform);
    expect(config.cache_type_v).toBe("f16");
  });

  test("n_gpu_layers is 99 for full GPU utilization on iOS", async () => {
    const { config } = await loadConfigFor(makeProvider(8, 0.1), iosPlatform);
    expect(config.n_gpu_layers).toBe(99);
  });

  test("config passes JSON schema validation", async () => {
    const { config } = await loadConfigFor(makeProvider(8, 0.1), iosPlatform);
    expect(validate(config)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// T024: OOM fallback behavior — config degradation logic
// ─────────────────────────────────────────────────────────────────────
describe("T024: OOM fallback — config degradation", () => {
  test("degraded config reduces n_ctx by 50%", async () => {
    const { config: original } = await loadConfigFor(makeProvider(4, 0.8), androidPlatform);
    const degradedNCtx = Math.floor(original.n_ctx / 2);
    const degradedConfig = generator.generateRuntimeConfig(
      await new DeviceDetector(makeProvider(4, 0.8), androidPlatform).detect(),
      MODEL_PATH,
      { n_ctx: degradedNCtx },
    );
    expect(degradedConfig.n_ctx).toBe(512); // 1024 / 2 = 512
  });

  test("degraded config remains above minimum n_ctx (128)", async () => {
    const { config: original } = await loadConfigFor(makeProvider(4, 0.8), androidPlatform);
    const degraded = Math.floor(original.n_ctx / 2);
    expect(degraded).toBeGreaterThanOrEqual(128);
  });

  test("degraded config passes schema validation", async () => {
    const devInfo = await new DeviceDetector(makeProvider(4, 0.8), androidPlatform).detect();
    const degradedConfig = generator.generateRuntimeConfig(devInfo, MODEL_PATH, {
      n_ctx: 512,
    });
    expect(validate(degradedConfig)).toBe(true);
  });

  test("degraded config preserves use_mmap=true for safety", async () => {
    const devInfo = await new DeviceDetector(makeProvider(4, 0.8), androidPlatform).detect();
    const degradedConfig = generator.generateRuntimeConfig(devInfo, MODEL_PATH, {
      n_ctx: 512,
    });
    expect(degradedConfig.use_mmap).toBe(true);
  });

  test("device classified as budget when 4GB total, 3.6GB used", async () => {
    const { config } = await loadConfigFor(makeProvider(4, 3.6), androidPlatform);
    // Even under high pressure, we still get budget config
    expect(config.n_ctx).toBe(1024);
    expect(config.n_gpu_layers).toBe(0);
  });
});

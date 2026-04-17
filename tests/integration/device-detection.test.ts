import { DeviceDetector } from "@/shared/device/detector";
import {
  IDeviceInfoProvider,
  IPlatformProvider,
} from "@/shared/device/types/adapters";
import { describe, expect, test } from "bun:test";

const GB = 1024 ** 3;

function makeProvider(
  totalMemory: number,
  usedMemory: number,
  brand = "Apple",
  model = "iPhone 15",
  osVersion = "17.0",
  cpuCores = 8,
): IDeviceInfoProvider {
  return {
    getTotalMemory: () => Promise.resolve(totalMemory),
    getUsedMemory: () => Promise.resolve(usedMemory),
    getBrand: () => Promise.resolve(brand),
    getModel: () => Promise.resolve(model),
    getSystemVersion: () => Promise.resolve(osVersion),
    getNumberOfCPUCores: () => Promise.resolve(cpuCores),
  };
}

function makePlatform(os: "ios" | "android"): IPlatformProvider {
  return { OS: os };
}

describe("Integração: detecção de dispositivo", () => {
  // T026: iOS com Metal GPU (8GB total, 2GB em uso → 8-1.5-2 = 4.5GB disponível)
  test("dispositivo iOS com Metal GPU tem 4.5 GB disponível", async () => {
    const detector = new DeviceDetector(
      makeProvider(8 * GB, 2 * GB, "Apple", "iPhone 15 Pro", "17.3.1"),
      makePlatform("ios"),
    );
    const info = await detector.detect();

    expect(info.totalRAM).toBeLessThanOrEqual(8);
    expect(info.totalRAM).toBeGreaterThanOrEqual(5);
    expect(info.availableRAM).toBeLessThanOrEqual(5);
    expect(info.availableRAM).toBeGreaterThanOrEqual(4.5);
    expect(info.hasGPU).toBe(true);
    expect(info.gpuBackend).toBe("Metal");
    expect(info.platform).toBe("iOS");
  });

  test("dispositivo Android moderno tem 5 GB disponível", async () => {
    const detector = new DeviceDetector(
      makeProvider(8 * GB, 1 * GB, "Google", "Pixel 8", "14.0"),
      makePlatform("android"),
    );
    const info = await detector.detect();

    expect(info.totalRAM).toBeGreaterThanOrEqual(5);
    expect(info.totalRAM).toBeGreaterThanOrEqual(8);
    expect(info.availableRAM).toBe(5);
    expect(info.platform).toBe("Android");
  });

  // T028: Android antigo com pouca RAM (4GB total, 2GB em uso → 4-2-2 = 0 → zerado)
  test("Android com pouca RAM tem availableRAM zerado e sem GPU", async () => {
    const detector = new DeviceDetector(
      makeProvider(4 * GB, 2 * GB, "Samsung", "Galaxy A12", "12.0"),
      makePlatform("android"),
    );
    const info = await detector.detect();

    // 4 - 2(overhead) - 2(used) = 0
    expect(info.availableRAM).toBe(0);
    expect(info.hasGPU).toBe(false);
    expect(info.gpuBackend).toBe("none");
  });

  test("detectedAt está dentro do intervalo de execução", async () => {
    const before = Date.now();
    const detector = new DeviceDetector(
      makeProvider(8 * GB, 2 * GB),
      makePlatform("ios"),
    );
    const info = await detector.detect();
    const after = Date.now();

    expect(info.detectedAt).toBeGreaterThanOrEqual(before);
    expect(info.detectedAt).toBeLessThanOrEqual(after);
  });

  test("cpuCores é repassado corretamente pelo provider", async () => {
    const detector = new DeviceDetector(
      makeProvider(8 * GB, 1 * GB, "Apple", "iPad Pro", "17.0", 12),
      makePlatform("ios"),
    );
    const info = await detector.detect();
    expect(info.cpuCores).toBe(12);
  });
});

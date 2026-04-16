import type {
    IDeviceInfoProvider,
    IPlatformProvider,
} from "@/shared/ai/device-detector";
import { DeviceDetector } from "@/shared/ai/device-detector";
import { describe, expect, test } from "bun:test";

const FOUR_GB = 4 * 1024 * 1024 * 1024;
const TWO_GB = 2 * 1024 * 1024 * 1024;
const EIGHT_GB = 8 * 1024 * 1024 * 1024;

function makeProvider(
  overrides?: Partial<IDeviceInfoProvider>,
): IDeviceInfoProvider {
  return {
    getTotalMemory: () => Promise.resolve(FOUR_GB),
    getUsedMemory: () => Promise.resolve(TWO_GB),
    getMaxMemory: () => Promise.resolve(8),
    getNumberOfCores: () => Promise.resolve(8),
    getBrand: () => Promise.resolve("Qualcomm"),
    getSystemVersion: () => Promise.resolve("12.0"),
    getModel: () => Promise.resolve("Pixel 4a"),
    ...overrides,
  };
}

const androidPlatform: IPlatformProvider = { OS: "android" };
const iosPlatform: IPlatformProvider = { OS: "ios" };

describe("DeviceDetector", () => {
  describe("detect()", () => {
    test("returns DeviceInfo with all required fields", async () => {
      const detector = new DeviceDetector(makeProvider(), androidPlatform);
      const info = await detector.detect();
      expect(info.totalRAM).toBeDefined();
      expect(info.availableRAM).toBeDefined();
      expect(info.cpuCores).toBeDefined();
      expect(info.platform).toBeDefined();
      expect(info.detectedAt).toBeDefined();
      expect(info.detectionMethod).toBeDefined();
    });

    test("totalRAM is converted from bytes to gigabytes", async () => {
      const detector = new DeviceDetector(
        makeProvider({ getTotalMemory: () => Promise.resolve(FOUR_GB) }),
        androidPlatform,
      );
      const info = await detector.detect();
      expect(info.totalRAM).toBe(4);
    });

    test("availableRAM subtracts used memory and OS overhead", async () => {
      const detector = new DeviceDetector(
        makeProvider({
          getTotalMemory: () => Promise.resolve(FOUR_GB),
          getUsedMemory: () => Promise.resolve(TWO_GB),
        }),
        androidPlatform,
      );
      const info = await detector.detect();
      expect(info.availableRAM).toBeGreaterThan(0);
      expect(info.availableRAM).toBeLessThan(4);
    });

    test("cpuCores is capped at 16", async () => {
      const detector = new DeviceDetector(
        makeProvider({ getNumberOfCores: () => Promise.resolve(32) }),
        androidPlatform,
      );
      const info = await detector.detect();
      expect(info.cpuCores).toBeLessThanOrEqual(16);
    });

    test("cpuCores defaults to 4 on error", async () => {
      const detector = new DeviceDetector(
        makeProvider({
          getNumberOfCores: () => Promise.reject(new Error("fail")),
        }),
        androidPlatform,
      );
      const info = await detector.detect();
      expect(info.cpuCores).toBe(4);
    });

    test("platform is android when provider says android", async () => {
      const detector = new DeviceDetector(makeProvider(), androidPlatform);
      const info = await detector.detect();
      expect(info.platform).toBe("android");
    });

    test("platform is ios when provider says ios", async () => {
      const detector = new DeviceDetector(
        makeProvider({ getTotalMemory: () => Promise.resolve(EIGHT_GB) }),
        iosPlatform,
      );
      const info = await detector.detect();
      expect(info.platform).toBe("ios");
    });

    test("on Android, GPU detection uses heuristic method", async () => {
      const detector = new DeviceDetector(makeProvider(), androidPlatform);
      const info = await detector.detect();
      expect(info.detectionMethod.gpu).toBe("heuristic");
    });

    test("on iOS, GPU detection uses metal and sets hasGPU=true", async () => {
      const detector = new DeviceDetector(
        makeProvider({ getTotalMemory: () => Promise.resolve(EIGHT_GB) }),
        iosPlatform,
      );
      const info = await detector.detect();
      expect(info.detectionMethod.gpu).toBe("metal");
      expect(info.hasGPU).toBe(true);
    });

    test("on iOS, cpuBrand is bionic", async () => {
      const detector = new DeviceDetector(
        makeProvider({ getTotalMemory: () => Promise.resolve(EIGHT_GB) }),
        iosPlatform,
      );
      const info = await detector.detect();
      expect(info.cpuBrand).toBe("bionic");
    });

    test("on Android with Qualcomm brand, cpuBrand is snapdragon", async () => {
      const detector = new DeviceDetector(
        makeProvider({
          getBrand: () => Promise.resolve("Qualcomm Snapdragon"),
        }),
        androidPlatform,
      );
      const info = await detector.detect();
      expect(info.cpuBrand).toBe("snapdragon");
    });

    test("detectedAt is a recent timestamp", async () => {
      const before = Date.now();
      const detector = new DeviceDetector(makeProvider(), androidPlatform);
      const info = await detector.detect();
      const after = Date.now();
      expect(info.detectedAt).toBeGreaterThanOrEqual(before);
      expect(info.detectedAt).toBeLessThanOrEqual(after);
    });

    test("detectionMethod.ram is react-native-device-info", async () => {
      const detector = new DeviceDetector(makeProvider(), androidPlatform);
      const info = await detector.detect();
      expect(info.detectionMethod.ram).toBe("react-native-device-info");
    });
  });
});

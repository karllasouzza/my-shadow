import { createRNAdapter } from "./adapters";
import { buildRuntimeConfig } from "./config-builder";
import { detectCapabilities, DeviceDetector } from "./detector";
import { DeviceInfo, RuntimeConfig } from "./types";

export { DeviceDetector };
export type {
  IDeviceInfoProvider,
  IPlatformProvider,
  IMemoryInfoProvider,
} from "./adapters";

export async function detectDevice(): Promise<DeviceInfo> {
  const adapter = createRNAdapter();
  return detectCapabilities(adapter);
}

export function configureModel(
  deviceInfo: DeviceInfo,
  modelPath: string,
  overrides?: Partial<RuntimeConfig>,
): RuntimeConfig {
  return buildRuntimeConfig(deviceInfo, modelPath, overrides);
}

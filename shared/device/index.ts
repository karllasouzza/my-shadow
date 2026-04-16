import { createRNAdapter } from "./adapters";
import { buildRuntimeConfig } from "./config-builder";
import { detectCapabilities } from "./detector";
import { DeviceInfo, RuntimeConfig } from "./types";

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

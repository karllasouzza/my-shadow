/**
 * Onboarding: Device detector service
 *
 * Detects device capabilities (RAM, storage, biometrics) and filters
 * compatible models based on available resources.
 */

import * as FileSystem from "expo-file-system/legacy";
import * as LocalAuthentication from "expo-local-authentication";
import DeviceInfo from "react-native-device-info";
import { AvailableModel } from "../model/model-configuration";

export interface DeviceInfoResult {
  totalRamBytes: number;
  availableStorageBytes: number;
  ramBudget60: number; // 60% of total RAM
  hasBiometricHardware: boolean;
  isBiometricEnrolled: boolean;
}

/**
 * Gather device capability information
 */
export async function getDeviceInfo(): Promise<DeviceInfoResult> {
  // Get total RAM in bytes (async in v15+)
  const totalRamBytes = await DeviceInfo.getTotalMemory();

  // Get available storage from FileSystem (returns number directly)
  const availableStorageBytes = await FileSystem.getFreeDiskStorageAsync();

  // RAM budget: 60% of total (leaves room for OS and other apps)
  const ramBudget60 = Math.floor(totalRamBytes * 0.6);

  // Check biometric capabilities
  const hardware = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();

  return {
    totalRamBytes,
    availableStorageBytes,
    ramBudget60,
    hasBiometricHardware: hardware,
    isBiometricEnrolled: enrolled,
  };
}

/**
 * Filter models that fit within the RAM budget and sort by compatibility
 * (smallest to largest, so the lightest compatible model comes first)
 */
export function filterCompatibleModels(
  models: AvailableModel[],
  ramBudget60: number,
): AvailableModel[] {
  return models
    .filter((model) => model.estimatedRamBytes <= ramBudget60)
    .sort((a, b) => a.estimatedRamBytes - b.estimatedRamBytes);
}

/**
 * Get the recommended model: the highest quality model within the RAM budget.
 * Returns null if no model fits.
 */
export function getRecommendedModel(
  models: AvailableModel[],
  ramBudget60: number,
): AvailableModel | null {
  const compatible = filterCompatibleModels(models, ramBudget60);
  if (compatible.length === 0) return null;

  // Return the largest (highest quality) compatible model
  return compatible[compatible.length - 1];
}

/**
 * Onboarding: Onboarding Guard Service
 *
 * Determines the initial route based on synchronous MMKV reads.
 * Checks CredentialRepository.isFirstLaunch() and ModelRepository.hasDownloadedModel().
 * Uses synchronous reads only -- no race conditions.
 *
 * Route decisions:
 * - 'security-gate': First launch OR no credential saved
 * - 'model-selection': Has credentials but no downloaded model
 * - 'model-loading': Has credentials and a downloaded model that needs loading
 * - 'main': Fully onboarded with loaded model
 */

import { getCredentialRepository } from '../repository/credential-repository';
import { getModelRepository } from '../repository/model-repository';

export type OnboardingRoute =
  | 'security-gate'
  | 'model-selection'
  | 'model-loading'
  | 'main';

/**
 * Determines the initial route for the app based on onboarding state.
 * Uses only synchronous MMKV reads to avoid race conditions.
 */
export function getInitialRoute(): OnboardingRoute {
  const credentialRepo = getCredentialRepository();
  const modelRepo = getModelRepository();

  // Check if this is the first launch (no credentials set up)
  const isFirstLaunch = credentialRepo.isFirstLaunch();
  if (isFirstLaunch) {
    return 'security-gate';
  }

  // Check if credentials exist
  const credential = credentialRepo.get();
  if (!credential) {
    return 'security-gate';
  }

  // Check if any model has been downloaded
  const downloadedModels = modelRepo.getDownloadedModelKeys();
  if (downloadedModels.length === 0) {
    return 'model-selection';
  }

  // Check if active model is loaded and ready
  const activeModel = modelRepo.getActiveModel();
  if (activeModel && activeModel.isLoaded && activeModel.lastUsedAt) {
    return 'main';
  }

  // Has downloaded model but not yet loaded
  return 'model-loading';
}

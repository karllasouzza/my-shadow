// Domain Models
export {
  validatePassword,
  generateSalt,
  hashPassword,
} from './model/user-credential';
export type { UserCredential } from './model/user-credential';

export { MODEL_CATALOG } from './model/model-configuration';
export type { ModelConfiguration, AvailableModel } from './model/model-configuration';

// Repository
export { getCredentialRepository } from './repository/credential-repository';
export { CredentialRepository } from './repository/credential-repository';

export { getModelRepository } from './repository/model-repository';
export { ModelRepository } from './repository/model-repository';

// Service
export { getDeviceInfo, filterCompatibleModels, getRecommendedModel } from './service/device-detector';
export type { DeviceInfoResult } from './service/device-detector';

// View Model
export { useSecurityGateVm } from './view-model/use-security-gate-vm';
export type {
  SecurityGateState,
  SecurityGateMode,
  UseSecurityGateVm,
} from './view-model/use-security-gate-vm';

// View
export { SecurityGateScreen } from './view/security-gate-screen';

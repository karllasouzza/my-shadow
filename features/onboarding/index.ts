// Domain Models
export {
    generateSalt,
    hashPassword,
    validatePassword
} from "./model/user-credential";
export type { UserCredential } from "./model/user-credential";

export { MODEL_CATALOG } from "./model/model-configuration";
export type {
    AvailableModel,
    ModelConfiguration
} from "./model/model-configuration";

// Repository
export {
    CredentialRepository,
    getCredentialRepository,
    initCredentialRepository
} from "./repository/credential-repository";

export {
    getModelRepository,
    ModelRepository
} from "./repository/model-repository";

// Service
export {
    filterCompatibleModels,
    getDeviceInfo,
    getRecommendedModel
} from "./service/device-detector";
export type { DeviceInfoResult } from "./service/device-detector";

export { getModelManager, ModelManager } from "./service/model-manager";

export { getInitialRoute } from "./service/onboarding-guard";
export type { OnboardingRoute } from "./service/onboarding-guard";

export { OnboardingRouter } from "./service/onboarding-router";
export type { OnboardingRouterProps } from "./service/onboarding-router";

export {
    initAIRuntimeWithCap,
    validateRamBudget
} from "./service/ram-cap-validator";

export { initAIRuntimeWithModelCap } from "./service/ram-cap-integration";

// View Model
export { useSecurityGateVm } from "./view-model/use-security-gate-vm";
export type {
    SecurityGateMode,
    SecurityGateState,
    UseSecurityGateVm
} from "./view-model/use-security-gate-vm";

export { useModelSelectionVm } from "./view-model/use-model-selection-vm";
export type {
    ModelItem,
    ModelSelectionState,
    UseModelSelectionVm
} from "./view-model/use-model-selection-vm";

export { useModelLoadingVm } from "./view-model/use-model-loading-vm";
export type {
    LoadStatus,
    ModelLoadingState,
    UseModelLoadingVm
} from "./view-model/use-model-loading-vm";

// View
export { ModelLoadingScreen } from "./view/model-loading-screen";
export { ModelSelectionScreen } from "./view/model-selection-screen";
export { SecurityGateScreen } from "./view/security-gate-screen";


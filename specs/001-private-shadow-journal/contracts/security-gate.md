# Contract: Security Gate Interface

## Purpose

Defines the contract between the Security Gate screen and the rest of the application. This is the first screen every user sees on app launch.

## Inputs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `isFirstLaunch` | `boolean` | Yes | Whether this is the user's first time opening the app |
| `hasBiometricHardware` | `boolean` | Yes | Whether device supports biometric authentication |
| `isBiometricEnrolled` | `boolean` | Yes | Whether user has enrolled biometrics on device |
| `onAuthenticateSuccess` | `() => void` | Yes | Callback called when auth succeeds |

## Outputs

| Field | Type | Description |
|-------|------|-------------|
| `authenticated` | `boolean` | Whether authentication succeeded |
| `biometricEnabled` | `boolean \| null` | User's choice to enable biometric (first launch only) |
| `passwordCreated` | `boolean` | Whether user created a password (first launch only) |

## States

| State | Loading | Empty | Success | Error |
|-------|---------|-------|---------|-------|
| First launch — password creation | N/A | N/A | Password created, proceed to biometric enrollment | Invalid password (too short, mismatch on confirm) |
| Returning — biometric unlock | Biometric prompt in progress | N/A | Authenticated, proceed to next screen | Auth failed, fall back to password entry |
| Returning — password unlock | N/A | N/A | Authenticated, proceed to next screen | Wrong password, show error message |

## Error Handling

| Error | User Message | Recovery |
|-------|-------------|----------|
| Password mismatch (confirm) | "As senhas não coincidem. Tente novamente." | User re-enters both fields |
| Password too short (< 6 chars) | "A senha deve ter pelo menos 6 caracteres." | User re-enters password |
| Biometric auth failed | "Autenticação biométrica falhou. Use sua senha." | Fall back to password input |
| Wrong password | "Senha incorreta. Tente novamente." | User re-enters password |
| Biometric hardware error | "Não foi possível usar a biometria. Use sua senha." | Fall back to password input |

## Navigation Contract

- **On success**: Navigate to Model Selection screen (if no model downloaded) OR Model Loading screen (if model exists)
- **On cancel**: No navigation — user remains on security gate (app cannot be bypassed)
- **On app kill + restart**: Return to security gate, preserve state via MMKV

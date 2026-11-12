/**
 * Face ID / Touch ID / passcode, loaded lazily so a build without the native module
 * (older test builds) keeps working: the lock option is then reported as unavailable.
 */
type LA = typeof import('expo-local-authentication');

let mod: LA | null | undefined;
function la(): LA | null {
  if (mod !== undefined) return mod;
  try {
    // Older builds don't ship the native side: check before importing the package.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireOptionalNativeModule } = require('expo-modules-core') as typeof import('expo-modules-core');
    if (!requireOptionalNativeModule('ExpoLocalAuthentication')) {
      mod = null;
      return mod;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('expo-local-authentication') as LA;
  } catch {
    mod = null;
  }
  return mod;
}

export interface LockSupport {
  available: boolean;
  /** "Face ID", "Touch ID" or "Passcode". */
  label: string;
}

export async function lockSupport(): Promise<LockSupport> {
  const m = la();
  if (!m) return { available: false, label: 'Face ID' };
  try {
    const level = await m.getEnrolledLevelAsync();
    if (level === m.SecurityLevel.NONE) return { available: false, label: 'Face ID' };
    const types = await m.supportedAuthenticationTypesAsync();
    const enrolledBio = await m.isEnrolledAsync();
    const label = !enrolledBio
      ? 'Passcode'
      : types.includes(m.AuthenticationType.FACIAL_RECOGNITION)
        ? 'Face ID'
        : types.includes(m.AuthenticationType.FINGERPRINT)
          ? 'Touch ID'
          : 'Passcode';
    return { available: true, label };
  } catch {
    return { available: false, label: 'Face ID' };
  }
}

/** true when the user unlocked (biometrics, or the device passcode as fallback). */
export async function authenticate(reason = 'Unlock Omega'): Promise<boolean> {
  const m = la();
  if (!m) return true;
  try {
    const r = await m.authenticateAsync({ promptMessage: reason, disableDeviceFallback: false, cancelLabel: 'Cancel' });
    return r.success;
  } catch {
    return false;
  }
}

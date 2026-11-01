import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';

/**
 * Test builds (channel "preview"): fetch the latest JS update on launch and whenever the app
 * comes back to the foreground, then reload so changes show up without reinstalling.
 * Production builds keep the default behaviour (downloaded in the background, applied next launch).
 */
export function useOtaUpdates() {
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled || Updates.channel !== 'preview') return;
    let busy = false;
    const check = async () => {
      if (busy) return;
      busy = true;
      try {
        const res = await Updates.checkForUpdateAsync();
        if (res.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch {
        // offline or no update server: keep running the current bundle
      } finally {
        busy = false;
      }
    };
    check();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => sub.remove();
  }, []);
}

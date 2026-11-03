import { Capacitor, registerPlugin } from '@capacitor/core';

// The native service, not a background JavaScript interval, owns notification actions.
// The wall-clock session is reconciled when the WebView becomes visible again.
export interface NativeFocusState {
  active: boolean;
  sessionKey: string;
  isPaused: boolean;
  isBreakActive: boolean;
  elapsedFocusSeconds: number;
  elapsedBreakSeconds: number;
  notificationPermissionGranted: boolean;
}

export interface NativeFocusSync {
  sessionKey: string;
  isPaused: boolean;
  isBreakActive: boolean;
  elapsedFocusSeconds: number;
  elapsedBreakSeconds: number;
}

interface NativeFocusPlugin {
  sync(options: NativeFocusSync): Promise<{ notificationPermissionGranted: boolean }>;
  getState(): Promise<NativeFocusState>;
  stop(): Promise<void>;
}

const plugin = registerPlugin<NativeFocusPlugin>('NativeFocus');

export const isNativeFocusAvailable =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export const nativeFocus = {
  sync: (state: NativeFocusSync) => plugin.sync(state),
  getState: () => plugin.getState(),
  stop: () => plugin.stop(),
};

import { Capacitor, registerPlugin } from '@capacitor/core';
import { isTwaFocusPage, twaFocus } from './twaFocusBridge';

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

const isCapacitorAndroid =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

// TWA runs under the PWA's HTTPS origin and is NOT a Capacitor WebView.
// The website only activates this bridge when launched as NevoFocus TWA.
export const isNativeFocusAvailable = isCapacitorAndroid || isTwaFocusPage;

export const nativeFocus = {
  sync: (state: NativeFocusSync) =>
    isTwaFocusPage ? twaFocus.sync(state) : plugin.sync(state),
  getState: () =>
    isTwaFocusPage ? twaFocus.getState() : plugin.getState(),
  stop: () =>
    isTwaFocusPage ? twaFocus.stop() : plugin.stop(),
};

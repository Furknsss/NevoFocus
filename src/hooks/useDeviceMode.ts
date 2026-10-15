import { useState, useEffect, useCallback } from 'react';

export type DeviceModePreference = 'auto' | 'mobile' | 'tablet' | 'desktop';
export type ActiveDeviceType = 'mobile' | 'tablet' | 'desktop';

const STORAGE_KEY = 'fokus_device_mode_pref';

/**
 * Robustly detects whether the current screen and device is mobile (phone), tablet, or desktop (PC).
 * Takes into account viewport width, touch capability, and user agent heuristics.
 */
export function detectScreenDevice(): ActiveDeviceType {
  if (typeof window === 'undefined') return 'desktop';
  
  const width = window.innerWidth;
  const ua = (navigator.userAgent || '').toLowerCase();
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  // 1. Explicit Tablet Heuristics (iPad, Android tablets, touch devices with tablet widths)
  const isTabletUA = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(ua);
  if (isTabletUA || (maxTouchPoints > 1 && width >= 640 && width <= 1180)) {
    return 'tablet';
  }

  // 2. Explicit Phone/Mobile Heuristics
  const isMobileUA = /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(ua);
  if (isMobileUA || width < 640) {
    return 'mobile';
  }

  // 3. Fallback based on viewport width
  if (width <= 1024) {
    return 'tablet';
  }

  return 'desktop';
}

export function useDeviceMode(initialPreference: DeviceModePreference = 'auto') {
  const [preference, setPreferenceState] = useState<DeviceModePreference>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as DeviceModePreference | null;
      if (stored && ['auto', 'mobile', 'tablet', 'desktop'].includes(stored)) {
        return stored;
      }
    } catch {
      // ignore
    }
    return initialPreference;
  });

  const [detectedDevice, setDetectedDevice] = useState<ActiveDeviceType>(detectScreenDevice);

  // Sync with initialPreference if it changes from profile state
  useEffect(() => {
    if (initialPreference && ['auto', 'mobile', 'tablet', 'desktop'].includes(initialPreference)) {
      setPreferenceState(initialPreference);
    }
  }, [initialPreference]);

  // Listen to window resize and orientation events to auto-adapt
  useEffect(() => {
    const handleResize = () => {
      setDetectedDevice(detectScreenDevice());
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const setDeviceMode = useCallback((newPref: DeviceModePreference) => {
    setPreferenceState(newPref);
    try {
      localStorage.setItem(STORAGE_KEY, newPref);
    } catch {
      // ignore
    }
  }, []);

  const activeDevice: ActiveDeviceType = preference === 'auto' ? detectedDevice : preference;

  // Sync data attribute and classes to document element and body for CSS targeting
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-device-mode', activeDevice);
      document.body.classList.remove('device-mobile', 'device-tablet', 'device-desktop');
      document.body.classList.add(`device-${activeDevice}`);
    }
  }, [activeDevice]);

  return {
    deviceMode: preference,
    detectedDevice,
    activeDevice,
    setDeviceMode,
    isMobile: activeDevice === 'mobile',
    isTablet: activeDevice === 'tablet',
    isDesktop: activeDevice === 'desktop',
  };
}

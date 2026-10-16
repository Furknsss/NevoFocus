import { useEffect, useRef, useState } from 'react';

/**
 * useScreenWakeLock
 * Keeps the screen awake and active on phones, tablets, and desktop browsers
 * during focus sessions so the display never goes to sleep or dims.
 */
export function useScreenWakeLock(enabled: boolean = true) {
  const [isActive, setIsActive] = useState<boolean>(false);
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled) {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
        setIsActive(false);
      }
      return;
    }

    let isSubscribed = true;

    const requestLock = async () => {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        try {
          const lock = await (navigator as any).wakeLock.request('screen');
          if (!isSubscribed) {
            lock.release().catch(() => {});
            return;
          }
          wakeLockRef.current = lock;
          setIsActive(true);

          lock.addEventListener('release', () => {
            if (isSubscribed) {
              setIsActive(false);
            }
          });
        } catch (err) {
          // Can occur if low battery or tab in background
          console.log('Wake Lock notice:', err);
          setIsActive(false);
        }
      }
    };

    requestLock();

    // Re-acquire lock when user toggles back to the browser tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled) {
        requestLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isSubscribed = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
        setIsActive(false);
      }
    };
  }, [enabled]);

  return { isWakeLockActive: isActive };
}

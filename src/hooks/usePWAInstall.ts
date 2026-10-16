import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);

  useEffect(() => {
    // Check if already running in standalone mode (installed)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setIsInstalled(true);
      setIsInstallable(false);
      return;
    }

    const handler = (e: Event) => {
      // Prevent automatic mini-infobar on mobile Chrome
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setIsInstallable(true);

      // Check if user has previously dismissed welcome banner in this session
      const dismissed = sessionStorage.getItem('fokus_pwa_banner_dismissed');
      if (!dismissed) {
        setShowWelcomeBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setShowWelcomeBanner(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const installApp = useCallback(async () => {
    if (!deferredPrompt) {
      // Fallback instructions for browsers without beforeinstallprompt (e.g. iOS Safari)
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        alert("Fokus'u iOS'te yüklemek için Safari paylaş butonuna (kare içinde yukarı ok) tıklayıp 'Ana Ekrana Ekle'yi seçin.");
      }
      return;
    }

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
      setIsInstallable(false);
      setShowWelcomeBanner(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const dismissBanner = useCallback(() => {
    setShowWelcomeBanner(false);
    sessionStorage.setItem('fokus_pwa_banner_dismissed', 'true');
  }, []);

  return {
    isInstallable,
    isInstalled,
    showWelcomeBanner,
    installApp,
    dismissBanner,
  };
}

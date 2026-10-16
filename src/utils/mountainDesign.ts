export interface MountainDesignConfig {
  style: 'snowy-alps' | 'misty-everest' | 'volcanic-basalt' | 'golden-hour';
  ridgeSharpness: number; // 1 to 5
  snowDensity: number; // 20 to 180
  fogIntensity: number; // 0.1 to 0.8
  trailGlowColor: string;
  cinematicAtmosphere: 'clear-zen' | 'dramatic-storm' | 'aurora-night';
}

export const DEFAULT_MOUNTAIN_DESIGN: MountainDesignConfig = {
  style: 'snowy-alps',
  ridgeSharpness: 3,
  snowDensity: 85,
  fogIntensity: 0.35,
  trailGlowColor: '#f97316',
  cinematicAtmosphere: 'clear-zen',
};

const STORAGE_KEY = 'fokus_mountain_design_v1';

export function getStoredMountainDesign(): MountainDesignConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MOUNTAIN_DESIGN;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_MOUNTAIN_DESIGN,
      ...parsed,
    };
  } catch {
    return DEFAULT_MOUNTAIN_DESIGN;
  }
}

export function saveStoredMountainDesign(design: MountainDesignConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(design));
    window.dispatchEvent(new CustomEvent('fokus_mountain_design_updated', { detail: design }));
  } catch (err) {
    console.error('Failed to save mountain design', err);
  }
}

export const MOUNTAIN_PRESETS = [
  {
    id: 'snowy-alps' as const,
    title: 'Karlı Alpler (Snowy Alps)',
    subtitle: 'Buzul şapkalar, serin rüzgar ve kristal kar yağışı',
    primaryColor: '#38bdf8',
    skyTop: '#090814',
    skyBottom: '#2b1428',
    mountainColor: '#241731',
    capColor: '#e2e8f0',
  },
  {
    id: 'misty-everest' as const,
    title: 'Mistik Sisli Everest',
    subtitle: 'Derin vadiler, yoğun sis bulutları ve efsanevi zirve',
    primaryColor: '#818cf8',
    skyTop: '#050713',
    skyBottom: '#181b36',
    mountainColor: '#171a2e',
    capColor: '#c7d2fe',
  },
  {
    id: 'volcanic-basalt' as const,
    title: 'Volkanik Bazalt & Obsidyen',
    subtitle: 'Koyu granit kayalıklar, kehribar parıltı ve lav vadisi',
    primaryColor: '#f97316',
    skyTop: '#100507',
    skyBottom: '#2f0f15',
    mountainColor: '#1f1013',
    capColor: '#fca5a5',
  },
  {
    id: 'golden-hour' as const,
    title: 'Altın Zirve & Günbatımı',
    subtitle: 'Alacakaranlık altın ışıkları, sıcak dağ sırtları ve huzur',
    primaryColor: '#f59e0b',
    skyTop: '#170b14',
    skyBottom: '#4a1e35',
    mountainColor: '#301524',
    capColor: '#fef08a',
  },
];

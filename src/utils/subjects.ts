import { StudyAreaType, SubjectItem } from '../types';

export type StudyTrack = 'Sayısal' | 'Eşit Ağırlık' | 'Sözel' | 'Dil' | 'KPSS' | 'Genel';

export interface AreaSubjectConfig {
  name: string;
  color: string;
  area: StudyAreaType;
  trackWhitelist: StudyTrack[]; // Which tracks are allowed to see this subject
}

/**
 * Universal Subject Master Catalog with explicit track whitelisting.
 * Geometries are completely separated as dedicated subjects!
 */
export const ALL_SUBJECTS: AreaSubjectConfig[] = [
  // --- TYT (Temel Yeterlilik) ---
  { name: 'TYT Matematik', color: '#10b981', area: 'tyt', trackWhitelist: ['Sayısal', 'Eşit Ağırlık', 'Sözel', 'Dil', 'Genel'] },
  { name: 'TYT Geometri', color: '#059669', area: 'tyt', trackWhitelist: ['Sayısal', 'Eşit Ağırlık', 'Sözel', 'Dil', 'Genel'] }, // Geometri ayrı!
  { name: 'TYT Türkçe', color: '#f59e0b', area: 'tyt', trackWhitelist: ['Sayısal', 'Eşit Ağırlık', 'Sözel', 'Dil', 'Genel'] },
  { name: 'TYT Sosyal', color: '#8b5cf6', area: 'tyt', trackWhitelist: ['Sayısal', 'Eşit Ağırlık', 'Sözel', 'Dil', 'Genel'] },
  { name: 'TYT Fen Bilimleri', color: '#06b6d4', area: 'tyt', trackWhitelist: ['Sayısal', 'Eşit Ağırlık', 'Sözel', 'Dil', 'Genel'] },
  { name: 'Paragraf', color: '#f59e0b', area: 'tyt', trackWhitelist: ['Sayısal', 'Eşit Ağırlık', 'Sözel', 'Dil', 'KPSS', 'Genel'] }, // Günlük Rutin
  { name: 'Problem', color: '#10b981', area: 'tyt', trackWhitelist: ['Sayısal', 'Eşit Ağırlık', 'Sözel', 'Dil', 'KPSS', 'Genel'] }, // Günlük Rutin
  { name: 'TYT Fizik', color: '#3b82f6', area: 'tyt', trackWhitelist: ['Sayısal', 'Eşit Ağırlık', 'Sözel', 'Dil', 'Genel'] },
  { name: 'TYT Kimya', color: '#ec4899', area: 'tyt', trackWhitelist: ['Sayısal', 'Eşit Ağırlık', 'Sözel', 'Dil', 'Genel'] },
  { name: 'TYT Biyoloji', color: '#84cc16', area: 'tyt', trackWhitelist: ['Sayısal', 'Eşit Ağırlık', 'Sözel', 'Dil', 'Genel'] },
  { name: 'TYT Tarih', color: '#8b5cf6', area: 'tyt', trackWhitelist: ['Sayısal', 'Eşit Ağırlık', 'Sözel', 'Dil', 'Genel'] },
  { name: 'TYT Coğrafya', color: '#06b6d4', area: 'tyt', trackWhitelist: ['Sayısal', 'Eşit Ağırlık', 'Sözel', 'Dil', 'Genel'] },
  { name: 'TYT Felsefe', color: '#a855f7', area: 'tyt', trackWhitelist: ['Sayısal', 'Eşit Ağırlık', 'Sözel', 'Dil', 'Genel'] },
  { name: 'TYT Din Kültürü', color: '#6366f1', area: 'tyt', trackWhitelist: ['Sayısal', 'Eşit Ağırlık', 'Sözel', 'Dil', 'Genel'] },

  // --- AYT (Alan Yeterlilik) ---
  { name: 'AYT Matematik', color: '#0d9488', area: 'ayt', trackWhitelist: ['Sayısal', 'Eşit Ağırlık', 'Genel'] },
  { name: 'AYT Geometri', color: '#14b8a6', area: 'ayt', trackWhitelist: ['Sayısal', 'Eşit Ağırlık', 'Genel'] }, // Geometri ayrı!
  { name: 'AYT Fen Bilimleri', color: '#0284c7', area: 'ayt', trackWhitelist: ['Sayısal', 'Eşit Ağırlık', 'Sözel', 'Genel'] },
  { name: 'Paragraf', color: '#f59e0b', area: 'ayt', trackWhitelist: ['Sayısal', 'Eşit Ağırlık', 'Sözel', 'Dil', 'KPSS', 'Genel'] },
  { name: 'Problem', color: '#10b981', area: 'ayt', trackWhitelist: ['Sayısal', 'Eşit Ağırlık', 'Sözel', 'Dil', 'KPSS', 'Genel'] },
  { name: 'AYT Fizik', color: '#2563eb', area: 'ayt', trackWhitelist: ['Sayısal', 'Genel'] },
  { name: 'AYT Kimya', color: '#db2777', area: 'ayt', trackWhitelist: ['Sayısal', 'Genel'] },
  { name: 'AYT Biyoloji', color: '#65a30d', area: 'ayt', trackWhitelist: ['Sayısal', 'Genel'] },

  // Eşit Ağırlık & Sözel subjects
  { name: 'AYT Edebiyat', color: '#e11d48', area: 'ayt', trackWhitelist: ['Eşit Ağırlık', 'Sözel', 'Genel'] },
  { name: 'AYT Tarih-1', color: '#7c3aed', area: 'ayt', trackWhitelist: ['Eşit Ağırlık', 'Sözel', 'Genel'] },
  { name: 'AYT Coğrafya-1', color: '#0891b2', area: 'ayt', trackWhitelist: ['Eşit Ağırlık', 'Sözel', 'Genel'] },
  { name: 'AYT Tarih-2', color: '#9333ea', area: 'ayt', trackWhitelist: ['Sözel', 'Genel'] },
  { name: 'AYT Coğrafya-2', color: '#0284c7', area: 'ayt', trackWhitelist: ['Sözel', 'Genel'] },
  { name: 'AYT Felsefe Grubu', color: '#a855f7', area: 'ayt', trackWhitelist: ['Sözel', 'Genel'] },
  { name: 'AYT Din Kültürü', color: '#6366f1', area: 'ayt', trackWhitelist: ['Sözel', 'Genel'] },

  // --- YDT (Yabancı Dil Testi) ---
  { name: 'YDT İngilizce Reading', color: '#6366f1', area: 'ydt', trackWhitelist: ['Dil', 'Genel'] },
  { name: 'YDT Kelime / Vocab', color: '#4f46e5', area: 'ydt', trackWhitelist: ['Dil', 'Genel'] },
  { name: 'YDT Grammar', color: '#818cf8', area: 'ydt', trackWhitelist: ['Dil', 'Genel'] },
  { name: 'YDT Çeviri / Skills', color: '#a855f7', area: 'ydt', trackWhitelist: ['Dil', 'Genel'] },
  { name: 'YDT Deneme', color: '#ec4899', area: 'ydt', trackWhitelist: ['Dil', 'Genel'] },

  // --- KPSS ---
  { name: 'KPSS Genel Yetenek (Türkçe-Mat)', color: '#10b981', area: 'kpss', trackWhitelist: ['KPSS'] },
  { name: 'KPSS Genel Kültür (Tarih-Coğrafya-Vatandaşlık)', color: '#8b5cf6', area: 'kpss', trackWhitelist: ['KPSS'] },
  { name: 'KPSS Eğitim Bilimleri', color: '#f59e0b', area: 'kpss', trackWhitelist: ['KPSS'] },
  { name: 'KPSS Alan Bilgisi / ÖABT', color: '#ec4899', area: 'kpss', trackWhitelist: ['KPSS'] },

  // --- Genel / Rutin / Kodlama ---
  { name: 'Paragraf', color: '#f59e0b', area: 'genel', trackWhitelist: ['Sayısal', 'Eşit Ağırlık', 'Sözel', 'Dil', 'KPSS', 'Genel'] },
  { name: 'Problem', color: '#10b981', area: 'genel', trackWhitelist: ['Sayısal', 'Eşit Ağırlık', 'Sözel', 'Dil', 'KPSS', 'Genel'] },
  { name: 'Problem Rutini', color: '#10b981', area: 'genel', trackWhitelist: ['Sayısal', 'Eşit Ağırlık', 'Sözel', 'Dil', 'KPSS', 'Genel'] },
  { name: 'Geometri Rutini', color: '#059669', area: 'genel', trackWhitelist: ['Sayısal', 'Eşit Ağırlık', 'Sözel', 'Dil', 'KPSS', 'Genel'] },
  { name: 'Paragraf Rutini', color: '#f59e0b', area: 'genel', trackWhitelist: ['Sayısal', 'Eşit Ağırlık', 'Sözel', 'Dil', 'KPSS', 'Genel'] },
  { name: 'Kodlama & Algoritma', color: '#f97316', area: 'genel', trackWhitelist: ['Genel'] },
  { name: 'Serbest Çalışma', color: '#64748b', area: 'genel', trackWhitelist: ['Genel'] },
];

/**
 * Robust study track normalizer to handle strings like 'YKS - Sayısal (MF)', 'Sayısal', etc.
 */
export function normalizeStudyTrack(rawTrack?: string): StudyTrack {
  if (!rawTrack) return 'Sayısal';
  const lower = rawTrack.toLowerCase();
  if (lower.includes('sayısal') || lower.includes('sayisal') || lower.includes('mf')) return 'Sayısal';
  if (lower.includes('eşit') || lower.includes('esit') || lower.includes('tm')) return 'Eşit Ağırlık';
  if (lower.includes('sözel') || lower.includes('sozel') || lower.includes('ts')) return 'Sözel';
  if (lower.includes('dil') || lower.includes('ydt') || lower.includes('ingilizce') || lower.includes('yabancı')) return 'Dil';
  if (lower.includes('kpss') || lower.includes('kamu')) return 'KPSS';
  if (lower.includes('genel') || lower.includes('proje') || lower.includes('kod')) return 'Genel';
  return 'Sayısal';
}

/**
 * Filter allowed areas according to the student's study track.
 * Sayısal students ONLY see TYT and AYT (no YDT, no KPSS).
 * Dil students ONLY see TYT and YDT (no AYT).
 */
export function getAllowedAreasForTrack(track?: string): { id: StudyAreaType; label: string }[] {
  const normalizedTrack = normalizeStudyTrack(track);

  switch (normalizedTrack) {
    case 'Sayısal':
      return [
        { id: 'tyt', label: 'TYT' },
        { id: 'ayt', label: 'AYT' },
      ];
    case 'Eşit Ağırlık':
      return [
        { id: 'tyt', label: 'TYT' },
        { id: 'ayt', label: 'AYT' },
      ];
    case 'Sözel':
      return [
        { id: 'tyt', label: 'TYT' },
        { id: 'ayt', label: 'AYT' },
      ];
    case 'Dil':
      return [
        { id: 'tyt', label: 'TYT' },
        { id: 'ydt', label: 'YDT' },
      ];
    case 'KPSS':
      return [
        { id: 'kpss', label: 'KPSS' },
      ];
    case 'Genel':
    default:
      return [
        { id: 'tyt', label: 'TYT' },
        { id: 'ayt', label: 'AYT' },
        { id: 'ydt', label: 'YDT' },
        { id: 'genel', label: 'Genel' },
      ];
  }
}

/**
 * Filter subjects strictly matching the user's track and selected area.
 */
export function getSubjectsForAreaAndTrack(
  area: StudyAreaType,
  track?: string
): { name: string; color: string }[] {
  const normalizedTrack = normalizeStudyTrack(track);

  const filtered = ALL_SUBJECTS.filter((sub) => {
    if (sub.area !== area) return false;
    return sub.trackWhitelist.includes(normalizedTrack);
  });

  return filtered.map((s) => ({ name: s.name, color: s.color }));
}

/**
 * Returns the default subjects list tailored for the user's specific track (for FocusSetup).
 * Guaranteed to NEVER return an empty array.
 */
export function getDefaultSubjectsForTrack(track?: string): SubjectItem[] {
  const normalizedTrack = normalizeStudyTrack(track);
  let filtered = ALL_SUBJECTS.filter((sub) => sub.trackWhitelist.includes(normalizedTrack));

  if (filtered.length === 0) {
    filtered = ALL_SUBJECTS.filter((sub) => sub.trackWhitelist.includes('Sayısal'));
  }

  return filtered.map((sub, idx) => ({
    id: `sub-${sub.area}-${idx}`,
    name: sub.name,
    color: sub.color,
  }));
}

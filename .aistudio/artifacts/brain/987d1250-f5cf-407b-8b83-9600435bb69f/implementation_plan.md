# Fokus PWA, Kalıcı Cihaz Hatırlama, Arayüz Sadeleştirme ve Sinematik Dağ Tasarım Stüdyosu Planı

Bu plan, kullanıcının belirttiği 4 temel başlığı kapsar:
1. **Chrome PWA (Uygulama Olarak Yükle) ve Kalıcı Cihaz Hatırlaması:** Masaüstü ve mobilde bağımsız uygulama (standalone) olarak yüklenebilme, başlıkta "Uygulamayı Yükle" butonu, karşılama bildirim çubuğu ve tarayıcı kapatılıp açıldığında oturumu sürekli açık tutan kalıcı cihaz saklama (`browserLocalPersistence`).
2. **Arayüz Temizliği (Yeşil Nokta ve Alt 'Bugün' Alanı):** Sağ üst köşedeki "Bugün" sayacının solunda yer alan yeşil nabız noktasının kaldırılması; ana sayfanın en altında yer alan "Bugün" istatistik şeridinin tamamen kaldırılması.
3. **Odak Modlarında Sade Kontrol Düzeni:** Odak seanslarındaki tematik/ekstra ("gölgenin altında" vb.) karmaşık metin ve butonların kaldırılması; kontrollerin yalnızca yan yana **[ Mola Ver ] [ Tamamla ] [ Vazgeç ]** butonlarından oluşacak şekilde sadeleştirilmesi.
4. **Sinematik Görsel & Dağ Tasarım Stüdyosu:** Sitenin sinematikliğinden ve animasyonlarından sorumlu, dağları (zirve keskinliği, karlı/alpin atmosfer, sis/bulut partikülleri, günbatımı ve günışığı tonları, tırmanış irtifa detayları) canlı önizlemeyle özelleştiren ve tırmanış moduna doğrudan yansıtan uygulama içi tasarım paneli.

---

## 1. Mimari ve Bileşen Yapısı

### A. PWA ve Oturum Kalıcılığı (`pwa-integration` standardı)
- **`public/manifest.webmanifest` & `public/manifest.json`:**
  - `name`: "FOKUS - Derin Odaklanma & Çalışma İstasyonu"
  - `short_name`: "Fokus" (≤ 12 karakter standardı)
  - `start_url`: "/"
  - `display`: "standalone"
  - `theme_color`: "#07090e"
  - `background_color`: "#07090e"
  - İkonlar: 192x192 ve 512x512 maskable/any PWA standart ikonları.
- **`public/sw.js` (Service Worker):**
  - Çevrimdışı önbellekleme ve hızlı başlatma desteği.
- **PWA Yükleme Kancası (`usePWAInstall` hook):**
  - `beforeinstallprompt` olayını yakalar.
  - Başlıkta (Header) "Uygulama Olarak Yükle" butonu sunar.
  - İlk girişte hafif, şık bir "Fokus'u bilgisayarına / telefonuna uygulama olarak yükle" bildirim çubuğu gösterir.
- **Kalıcı Cihaz Hatırlama (`firebase.ts` & `src/utils/storage.ts`):**
  - `browserLocalPersistence` ve yerel cihaz anahtarı ile kullanıcının hesabı tarayıcı kapansa bile cihazda hatırlanır.

### B. Header ve Ana Sayfa Sadeleştirmesi
- **`src/components/Header.tsx`:**
  - "Bugün:" sayacının solundaki `<span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />` kaldırılacak; yalnızca saat simgesi ve süre kalacak.
  - Başlık sağ üst eylemlerine PWA "Yükle" butonu entegre edilecek.
  - Özel Tasarım Stüdyosu butonu (palet/sinematik ikonu) eklenecek.
- **`src/components/ModeHubSelection.tsx`:**
  - En alttaki `Daily Progress Ribbon at bottom` ("Bugün: ... Seri: ... Hedef: ...") tamamen kaldırılacak; kartlar ve sayfa tertemiz kalacak.

### C. Odak Seansı Kontrolleri (`ActiveFocusSession.tsx`)
- Üst çubuktaki ve alt çubuktaki karmaşık tematik metinler ("Ağaç Gölgesinde Dinlen", "Transit Mola Ver", "Resife Sığın") ve ekstra hud açıklamaları kaldırılacak.
- Alt kontrol çubuğu kullanıcının net talebine göre düzenlenecek:
  - **[ Mola Ver ]** (Mola sırasında: **[ Devam Et ]**)
  - **[ Tamamla ]** (Görevi veya seansı bitirme)
  - **[ Vazgeç ]** (Seansı sonlandırma)

### D. Sinematik Dağ & Görsel Tasarım Stüdyosu (`src/components/MountainVisualStudioModal.tsx`)
- Kullanıcının doğrudan seçtiği **"Uygulama içi görsel ve sinematik dağ tasarım paneli"**:
  - **Dağ Zirvesi Stili:** Karlı Alpler (Snowy Alps), Mistik Sisli Everest (Misty Fog Summit), Volkanik Obsidyen (Volcanic Basalt), Altın Zirve Günbatımı (Golden Hour Peak).
  - **Hava & Atmosfer Yoğunluğu:** Sis miktarı, rüzgarlı kar partikülü hızı, gökyüzü sinematik tonu.
  - **Tırmanış İrtifa Efektleri:** Tırmanış rotası ışıltısı, dağcı kampı ışığı.
  - **Canlı Canvas Önizlemesi:** Kullanıcı panelde ayar değiştirdikçe dağın sinematik renderını anlık görür.
  - **Entegrasyon:** Seçilen ayarlar `ActiveClimbCanvas.tsx` tırmanış motoruna aktarılır; seanstaki dağ manzarası kullanıcının tasarladığı şekilde hayat bulur.

---

## 2. Değiştirilecek ve Oluşturulacak Dosyalar

1. **`public/manifest.webmanifest` & `public/manifest.json`:** PWA yapılandırması ve standart ikon referansları.
2. **`public/sw.js` & `index.html`:** Service worker kaydı ve PWA meta etiketleri (`theme-color`, `apple-mobile-web-app-capable`).
3. **`src/hooks/usePWAInstall.ts`:** PWA yükleme olayı (`beforeinstallprompt`) dinleyicisi ve yükleme tetikleyicisi.
4. **`src/components/Header.tsx`:** 
   - Yeşil noktanın kaldırılması.
   - PWA Yükle butonu.
   - Sinematik Tasarım Stüdyosu tetikleyici butonu.
5. **`src/components/ModeHubSelection.tsx`:** En alttaki "Bugün" şeridinin kaldırılması.
6. **`src/components/ActiveFocusSession.tsx`:** Yalnızca [Mola Ver] [Tamamla] [Vazgeç] kontrol dizilimi; tematik karmaşıklıkların temizlenmesi.
7. **`src/components/MountainVisualStudioModal.tsx` (Yeni):** Sinematik dağ ve görsel tasarım stüdyosu.
8. **`src/components/visuals/ActiveClimbCanvas.tsx`:** Tasarlanan dağ stili, kar partikülleri ve sinematik renk paletini destekleyecek şekilde güncellenmesi.
9. **`src/firebase.ts`:** `browserLocalPersistence` ve cihaz oturum güvencesi.

---

## 3. Doğrulama ve Test Adımları

1. **PWA Testi:**
   - Chrome'da adres çubuğunda "Uygulamayı Yükle" simgesinin çıkması ve başlıktaki butonla native yükleme iletişim kutusunun tetiklenmesi.
   - Çıkıp tekrar girildiğinde oturumun korunması.
2. **Arayüz Temizlik Testi:**
   - Sağ üstteki yeşil noktanın tamamen kaybolduğu, yalnızca sürenin kaldığı doğrulanır.
   - Ana sayfa en altındaki "Bugün" şeridinin kaldırıldığı doğrulanır.
3. **Odak Kontrol Testi:**
   - Odak seansı başlatılır; altta yalnızca [Mola Ver], [Tamamla], [Vazgeç] butonlarının çalıştığı, seans mola ve devam durumlarının kusursuz işlediği test edilir.
4. **Dağ Tasarım Stüdyosu Testi:**
   - Tasarım stüdyosu açılır; dağ stili veya kar/sis partikülü değiştirilip kaydedilir; tırmanış moduna girildiğinde dağın seçilen tasarıma göre sinematik olarak çizildiği teyit edilir.
5. **Derleme Doğrulaması:**
   - `compile_applet` ve `lint_applet` çalıştırılarak sıfır hata ile üretim kalitesinde tamamlanır.

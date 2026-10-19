# Fokus Kapsamlı Sistem Checkup & Spotify / Zamanlayıcı Onarım Planı

Bu plan; kullanıcının paylaştığı ekran görüntüsündeki Spotify Google Auth Bridge 403 hatasını çözmek, WebSocket hatalarını kökten bastırmak, mini odak hapının kullanıcı başlatmadan zamansız açılmasını önlemek ve odak ekranına canlı yerel saat göstergesini entegre etmek üzere hazırlanmıştır.

---

## 1. Tespit Edilen Sorunlar ve Çözüm Mimarisi

### A. Spotify Bağlantısındaki Google Auth Bridge 403 / 404 Hatası
- **Kök Neden**: AI Studio geliştirme konteyneri (`https://ais-dev-*.run.app`) bir iframe içerisinde çalışmaktadır. Harici bir popup penceresinde bu adrese doğrudan yönlendirme (`redirect_uri`) yapıldığında, Google Cloud Run proxy'si oturum çerezlerini göremediği için `google.com/applet-auth-bridge` üzerinden 403 Forbidden hatası vermektedir.
- **Çözüm**:
  1. **İkili Güvenli Bağlantı Akışı**:
     - Standart PKCE Popup akışında `redirect_uri` olarak hem `window.location.origin` hem de alternatif iframe-dostu köprü desteklenecek.
     - **Otomatik & Manuel Kod Girişi Yedeklemesi**: Eğer Google proxy popup'ı engellerse veya 403 verirse; kullanıcıya tek tıkla "Adres çubuğundaki linki veya code'u yapıştır" imkanı sunularak 2 saniyede token takası (`exchangeCodeForToken`) gerçekleştirilecek. Kullanıcı hiçbir zaman beyaz ekranda veya hata sayfasında takılı kalmayacak.
  2. **Yerel Saklama ve Oturum Doğrulaması**:
     - `code_verifier`, `code_challenge`, `client_id` ve `redirect_uri` hem `localStorage` hem `sessionStorage` içinde güvenle saklanacak; yetkilendirme bittiğinde anında temizlenip canlı dinleyiciye geçilecek.

### B. WebSocket Hatalarının Kökten Çözülmesi
- **Kök Neden**: AI Studio çalışma ortamında HMR (Hot Module Replacement) devre dışıdır. Tarayıcı veya Vite istemcisi arka planda WebSocket (`ws://...`) bağlantısı denediğinde ara sıra konsola veya ekrana bağlantı hatası fırlatmaktadır.
- **Çözüm**:
  - `src/main.tsx` ve `index.html` içerisine global `window.addEventListener('error')` ve `unhandledrejection` filtreleri eklenecek.
  - WebSocket veya `@vite/client` kaynaklı bağlantı kopma olayları yakalanıp kullanıcıya hiçbir hata mesajı yansıtılmadan sessizce yönetilecek.

### C. Küçük Ekran Çalışma Widget'ının (Mini Focus Pill) Zamansız Başlaması
- **Kök Neden**: `App.tsx` içerisinde Firestore `users/{uid}/active_focus/current` dinleyicisi bulunmaktadır. Kullanıcı daha önce bir oturumu yarıda bıraktığında veya eski bir oturum Firestore'da kaldığında, sayfa açılır açılmaz bu bayat oturum `cloudActiveSession` olarak yüklenmekte ve kullanıcı henüz başlatmadığı halde mini sayaç dönmeye başlamaktadır.
- **Çözüm**:
  1. Bayat oturum kontrolü: Oturum başlangıç zamanı (`startedAt`) 2 saatten eskiyse veya kullanıcı tarafından aktif başlatılmamışsa otomatik temizlenecek (`safeSetDoc` ile Firestore'dan silinecek).
  2. `FloatingMiniFocusPill` bileşenine bir kapatma (`X`) butonu eklenecek; kullanıcı istemediği oturumu tek tıkla sonlandırabilecek.
  3. Yalnızca kullanıcı açıkça bir odak modu başlattığında sayaç tetiklenecek.

### D. Focus Ekranında Sol Üste Gerçek Saat Göstergesi
- **İstek**: Sol üstteki tarihin altına aynı boy ve stilde `Saat: SS:DD` (Örn: `Saat: 10:24`) eklenmesi.
- **Çözüm**:
  - `ActiveFocusSession.tsx` bileşenine saniyelik yerel saat state'i (`wallClockTime`) eklenecek.
  - Tarih alanının hemen altına aynı tipografi ve renkte (`text-xs sm:text-sm font-medium text-neutral-400 select-none tracking-wide`) `Saat: {wallClockTime}` olarak yerleştirilecek.

---

## 2. Değişiklik Yapılacak Dosyalar

1. **`src/services/spotifyService.ts`**:
   - OAuth PKCE parametrelerinin ve URL'lerinin pekiştirilmesi.
   - Kod / URL yapıştırarak anında token takası yapabilen `exchangeCodeOrUrl` metodunun eklenmesi.
   - Hata durumunda net durum bildirimi.

2. **`src/components/visuals/SpotifyFocusWidget.tsx`**:
   - Modal içerisine tek tıkla URL/kod yapıştırma desteğinin eklenmesi (403 ekranı durumunda tam koruma).
   - Bağlantı tamamlandığında modalın anında kapanması ve Spotify canlı çaların devreye girmesi.

3. **`src/main.tsx`**:
   - WebSocket ve Vite HMR bağlantı hatalarını kökten bastıran global hata dinleyicisinin entegrasyonu.

4. **`src/App.tsx`**:
   - Firestore'dan gelen bayat `active_focus` verilerinin filtrelenmesi ve temizlenmesi.
   - Mini pill gösterim mantığının sadece gerçek aktif seanslara sınırlandırılması.

5. **`src/components/FloatingMiniFocusPill.tsx`**:
   - İsteğe bağlı kapatma/iptal butonu (`X`) eklenmesi.

6. **`src/components/ActiveFocusSession.tsx`**:
   - Sol üstteki tarihin altına aynı boy ve stilde `Saat: SS:DD` göstergesinin eklenmesi.

---

## 3. Doğrulama ve Test Adımları

1. `compile_applet` ve `lint_applet` ile tip ve derleme kontrolü.
2. Odak ekranında sol üstte tarih ve altında `Saat: SS:DD` formatının kontrol edilmesi.
3. Mini sayaç bileşeninin kullanıcı başlatmadan kendiliğinden açılmadığının doğrulanması.
4. WebSocket hata yakalayıcısının çalıştığının doğrulanması.
5. Spotify modalında hem otomatik PKCE hem de yedek hızlı kod doğrulamasının test edilmesi.

# Spotify PKCE OAuth Doğrudan Bağlantı & Mola Arayüzü İyileştirme Planı

Bu plan, kullanıcının bildirdiği Spotify OAuth `response_type must be code` hatasını kalıcı olarak çözmek, manuel token ve demo modlarını kaldırarak saf gerçek Spotify bağlantısı sağlamak ve mola arayüzündeki gereksiz yazı ve rozetleri temizlemek için hazırlanmıştır.

---

## 1. Tespit Edilen Sorunlar ve Çözüm Mimarisi

### A. Spotify `response_type must be code` Hatası ve Çözümü
- **Neden**: Spotify, web uygulamalarında artık `response_type=token` (Implicit Grant) akışını desteklememekte ve zorunlu olarak **Authorization Code Flow with PKCE (`response_type=code`)** talep etmektedir. `response_type=token` gönderildiğinde Spotify sunucusu doğrudan `"response_type must be code"` hatası verip beyaz sayfada kalmaktadır.
- **Çözüm**: 
  1. `crypto.subtle` ile standart Spotify PKCE (`code_verifier` & `code_challenge` - S256) üretilecek.
  2. Kullanıcı "Spotify Hesabına Git & İzin Ver" dediğinde `https://accounts.spotify.com/authorize?client_id=...&response_type=code&redirect_uri=...&code_challenge_method=S256&code_challenge=...` adresi açılacak.
  3. Kullanıcı izin verip siteye döndüğünde URL'deki `?code=...` parametresi yakalanacak.
  4. `https://accounts.spotify.com/api/token` adresine doğrudan POST isteği yapılarak `access_token` ve `refresh_token` alınacak (Spotify PKCE istemci tarafında `client_secret` gerektirmez).
  5. Token başarıyla kaydedildiğinde anında Spotify API'den kullanıcının çalan şarkısı (`/v1/me/player/currently-playing`) çekilmeye başlanacak.

### B. Spotify Arayüzündeki Fazlalıkların Kaldırılması
- "Hızlı Canlı Spotify Bağlantısı" (demo modu) tamamen kaldırılacak.
- Manuel "Access Token Yapıştır" kutusu ve ilgili karmaşık açıklamalar tamamen kaldırılacak.
- Sade, tek odaklı ve şık bir modal:
  - Client ID girişi (kullanıcı kendi Spotify Developer Dashboard'undan aldığı ID'yi kaydedebilir)
  - Otomatik tespit edilen Redirect URI (1-tıkla kopyalama butonuyla)
  - Tek bir ana eylem butonu: **"Spotify ile Oturum Aç & İzin Ver"**
  - Bağlandıktan sonra kulaklıkta/telefonda/bilgisayarda Spotify'dan müzik açıldığında doğrudan uygulamada anlık yansıyacak.

### C. Mola ve Durdur Butonları Altındaki Yazıların Kaldırılması
- `ActiveClockCanvas.tsx` içerisinde:
  - Sol Turuncu Mola Butonunun altındaki `"Mola Al"` / `"Molayı Bitir"` yazısı kaldırılacak.
  - Sağ Durdur/Başlat Butonunun altındaki `"Duraklat"` / `"Devam Et"` yazısı kaldırılacak.
  - Sadece sade, temiz dairesel Apple stili butonlar kalacak.

### D. Üst ve Alt Mola Rozetlerinin Temizlenmesi
- Saat ekranında mola verildiğinde:
  - Üstte çıkan `☕ Mola Aktif — Kronometre Duraklatıldı` rozeti tamamen kaldırılacak.
  - `ActiveFocusSession.tsx` ekranındaki `isCampActive` durumunda beliren `Mola Verildi` HUD alt afişi saat modunda gösterilmeyecek.
  - **SADECE** saatin altındaki listede: `1. Mola : sayıyor... 00:05` alanı kalacak ve saniyeleri canlı olarak saymaya devam edecek (kullanıcının tam istediği gibi).

---

## 2. Değişiklik Yapılacak Dosyalar

1. `src/services/spotifyService.ts`:
   - `code_verifier` (rastgele 64 karakter) ve `code_challenge` (SHA-256 Base64URL) üretimi ekleme.
   - `startSpotifyLogin` fonksiyonunu `response_type=code` ve `code_challenge` ile güncelleme.
   - URL'de veya popup'ta dönen `?code=...` kodunu yakalayıp `https://accounts.spotify.com/api/token` ile takas eden `exchangeCodeForToken` metodunu uygulama.
   - `isDemoSpotifyConnected` ve demo akışını tamamen temizleme.

2. `src/components/visuals/SpotifyFocusWidget.tsx`:
   - "Hızlı Canlı Spotify Bağlantısı" kartını kaldırma.
   - "Spotify Web API Access Token" yapıştırma alanını ve butonunu kaldırma.
   - Sadeleştirilmiş doğrudan OAuth giriş butonunu sunma.
   - Canlı müzik senkronizasyonunu saf Spotify Web API'ye bağlama.

3. `src/components/visuals/ActiveClockCanvas.tsx`:
   - Mola butonunun altındaki `Mola Al` / `Molayı Bitir` yazısını kaldırma.
   - Durdur butonunun altındaki `Duraklat` / `Devam Et` yazısını kaldırma.
   - Üstteki `☕ Mola Aktif — Kronometre Duraklatıldı` bildirimini kaldırma.
   - Saatin altındaki `1. Mola : sayıyor...` canlı listesini eksiksiz koruma.

4. `src/components/ActiveFocusSession.tsx`:
   - `mode === 'clock'` iken altta açılan `Mola Verildi` HUD kartını gizleme.

---

## 3. Doğrulama Adımları

1. Kodların derlenmesi (`compile_applet`) ve TypeScript tip kontrolü (`lint_applet`).
2. Spotify PKCE URL oluşturma mantığının `response_type=code` ve `code_challenge` parametrelerini doğru içerdiğinin doğrulanması.
3. Mola ve Durdur butonlarının altında hiçbir yazı kalmadığının, üstteki ve alttaki mükerrer mola kutularının gizlendiğinin ve sadece saatin altındaki canlı mola satırının çalıştığının doğrulanması.

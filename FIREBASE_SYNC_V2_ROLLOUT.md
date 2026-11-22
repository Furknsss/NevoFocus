# NevoFocus Firebase Sync v2 — güvenli yayın ve kurtarma runbook'u

**Durum: GELİŞTİRME / PR #15. Canlı siteye otomatik dağıtılmamalı.**

## Tek yetkili veri kaynakları
- Kimlik: Firebase Auth'un doğrulanmış `auth.currentUser.uid`. E-posta ya da localStorage UID kimlik doğrulaması değildir.
- Çalışma geçmişi: `users/{uid}/sessions/{id}` ve `users/{uid}/tasks/{id}`.
- Silme: `deleted: true` işaretleri, cihazlar çevrimdışıyken geri gelmeyi önler; fiziksel silme yapılmaz.
- İstatistikler: Tamamlanan, pozitif saniyeli, silinmemiş seanslardan yeniden hesaplanır.
- Bulut yedeği kanıtı: `users/{uid}/backups/latest_v2` **özet belgedir**. Sayı/süre kontrolü; gerçek kayıtlar ayrı koleksiyonlarda.
- Eski `users/{uid}/backups/latest` v1 korunur, otomatik silinmez.

## Yayın öncesi ZORUNLU denetim
1. Çalışan eski PC sitesinden **Ayarlar → Bulut & Yedek → Yedek İndir (.json)** alıp başka diskte sakla.
2. Eski ve yeni Firebase projelerini karıştırma. `firebase-applet-config.json` içinde `nevofocus` ve `(default)` olduğunu doğrula.
3. Android'in kurulan APK imzası Firebase Console **Android SHA-1** ve Google Cloud **Android OAuth istemcisi** ile eşleşmeli. Debug anahtarıyla üretim dağıtımı yapma.
4. `.github/workflows/firebase-security.yml` ve Android workflow testleri tümüyle yeşil olmalı.
5. **Yeni projedeki** Firestore Rules'a bu dalın `firestore.rules` dosyasını yayımla; emülatör testi tek başına canlı kuralı yayınlamaz.
6. Ayrı test hesabıyla iki cihazda giriş, 2 seans/3 görev ekleme, bir görevi tamamlayıp geri alma, silme, çevrimdışı seans oluşturma, tekrar online olma ve hesap değiştirmeyi test et.
7. Ana hesaba JSON içe aktarımı yaptıktan sonra **Ayarlar → Bulut & Yedek → Sunucuda Doğrula** çalıştır: seans sayısı, görev sayısı, toplam saniye ve son yedek zamanı eski kayıtlarla karşılaştırılmalı. Eksik varsa ana siteyi yönlendirme.
8. Firebase Auth **farklı proje UID'si** üretebilir. Otomatik email/UID eşleştirmesi yapılmaz; eski kullanıcı yedeği izinli şekilde yeni hesaba içe aktarılır.
9. Tüm testler tamamlanınca kademeli yayın; gerekirse eski Vercel dağıtımına dön. Eski Firestore verileri bağımsız olarak korunmalı.

## Kurtarma / sorun giderme
- **Veri yok**: Eski JSON yedeğini veya orijinal Firebase'i silme. Bulutta `users/<yeni uid>/sessions`, `tasks` ve `backups/latest_v2` gerçekten var mı kontrol et.
- **Çevrimdışı**: Yerel kayıtları ve tarayıcı/app verilerini temizleme; bağlantı geri gelince tekrar dene.
- **Bulutta 0 ama yerelde çok**: UID ve proje eşleşmesini kontrol et. Otomatik göç yapma; JSON'u sakla.
- **İstatistik farklı**: Belgeleri ve `deleted` işaretlerini karşılaştır; özet yerine kaynak seanslardan saniye topla.
- **Birden fazla cihaz**: Son güncelleme `updatedAt` üstünden çözülür; aynı kayıt aynı anda düzenlenirse çatışma izlenir.
- **Google giriş başarısız**: Firebase Authentication'da Google sağlayıcısı, Android SHA-1/OAuth istemcisi ve paket `com.furknsss.nevofocus` kontrol edilir.

## Bilinen sınırlar
- React UI ve Firebase SDK emülatör/CI testleri gerçek üretim Firestore datasına erişimin yerine geçmez.
- Bu paket, **Firebase proje yönetim hesabına bağlı olmadığı için** canlı Firestore'daki kayıtları veya yayımlanmış Rules'u doğrulayamaz/değiştiremez.
- Firestore istemci uygulamasında otomatik geçmiş seans yedeği vardır; gerçek **felaket kurtarma** için ayrı Admin SDK/Cloud Functions/scheduled managed Firestore export + farklı ortamda saklama gereklidir.
- Silme şu an bilinen sahipli alt koleksiyonları temizler; ileride eklenen topluluk alt koleksiyonları için sunucu tarafı recursive delete gerekir.
- Büyük offline media (ÖSYM ses dosyası) kullanıcı cihazında saklanır; Firestore ile aktarılmaz.

# Saf Siyah Canlı Fokus Kapsülü & Otomatik Algılamalı Müzik Çalar Tasarımı

Odak ekranındaki müzik çaların gereksiz bağlantı/platform seçici butonlardan arındırılarak tamamen otomatik algılamalı hale getirilmesi, sağ üstteki bildirim butonunun yalnızca simge olarak sadeleştirilmesi ve hem uygulama içi küçültmede hem uygulama dışı PiP (Picture-in-Picture) pencerede hem de bildirimlerde kullanıcının paylaştığı referans fotoğraftaki saf siyah, yüksek kontrastlı kapsül tasarımının uygulanması.

## Kullanıcı Onayı & Netleştirilen Kararlar

> [!IMPORTANT]
> Kullanıcının sorulan sorulara verdiği yanıtlar doğrultusunda kesinleşen tasarım kararları:

- **Saf Siyah Kapsülün Görüneceği Yerler**: Referans fotoğraftaki saf siyah kapsül tasarımı (**en solda büyük beyaz süre**, sağında **turuncu Mola**, **kırmızı Durdur / yeşil Başlat** ve **beyaz Büyüt** butonları) **hem uygulama dışı PiP (Picture-in-Picture) yüzen pencerede**, **hem uygulama içi küçültülmüş kapsülde**, **hem de bildirim / bildirim önizleme ekranında** birebir aynı tasarımla yer alacak.
- **Kapsül İçi Buton Görünümü**: Kapsülün içindeki 3 aksiyon butonu **sadece simgelerden** oluşacak (Turuncu **Kahve/Mola** ikonu, Kırmızı **Durdur** / Yeşil **Başlat** ikonu, Beyaz **Büyüt** ikonu) ve hepsi eşit büyüklükte dairesel/yuvarlatılmış premium butonlar olacak.
- **Müzik Çalar & Sol Müzik Butonu**:
  - Butona basınca alttan açılan şarkı çalarında `Spotify | YT Music | Apple Music` geçiş butonları, `Bağlantılar` butonu ve `Hesabını Bağla` / `Bağlantıyı Kes` butonları **kesinlikle yer almayacak**.
  - Hesap bağlama işlemleri **yalnızca Ayarlar > Bağlantılar** sekmesinden yapılacak.
  - Hangi platformdan müzik çalındığı otomatik algılanacak: müzik çalmıyorsa veya hesap bağlı değilse soldaki buton **Müzik (Şarkı) simgesi** olarak kalacak; Spotify'dan çalınıyorsa **Spotify butonuna**, YouTube Music'ten çalınıyorsa **YouTube Music logosuna**, Apple Music'ten çalınıyorsa **Apple Music logosuna** otomatik dönüşecek.
- **Sağ Üst Bildirim Butonu**: Odak ekranının sağ üst köşesinde `"Canlı Bildirim"` metni kaldırılacak, diğer sağ üst ikonlar gibi **yalnızca bildirim (zil) simgesi** kalacak.

---

## 1. Genel Bakış & Temel Konsept

- **Ne Yapar**:
  1. **Sade ve Otomatik Algılamalı Müzik Çalar**: Odak ekranında soldaki müzik butonuna basıldığında açılan çalar, karmaşık bağlantı ayarları veya platform sekmeleri olmadan doğrudan çalan şarkıyı, ilerleme çubuğunu ve medya kontrollerini (Önceki, Oynat/Duraklat, Sonraki) gösterir. Aktif müzik platformu bağlı hesaplardan ve aktif oturumdan otomatik algılanır.
  2. **Saf Siyah (Pure Black) Fokus Kapsülü**: Odak ekranı küçültüldüğünde, başka sekmeye/uygulamaya geçildiğinde açılan **Picture-in-Picture (PiP)** yüzen penceresinde ve bildirim önizlemesinde; sol tarafta hiçbir mod logosu veya yazı olmadan doğrudan **büyük, net beyaz süre (`00:39` formatında)** ve hemen sağında eşit boyutlu **Turuncu Mola**, **Kırmızı Durdur / Yeşil Başlat** ve **Beyaz Büyüt** simge butonları yer alır.
  3. **Sadece Simge Bildirim Tetikleyicisi**: Sağ üst barda metin kalabalığı yapan `"Canlı Bildirim"` yazısı kaldırılarak diğer üst bar kontrolleriyle (Ses, Tam Ekran) uyumlu dairesel zil simgesi kullanılır.

---

## 2. Kullanıcı Deneyimi & Görsel Tasarım

### A. Saf Siyah Fokus Kapsülü (`#000000` / `rounded-full`)
Kullanıcının paylaştığı One UI canlı bildirim kapsülü referans alınarak, sol taraftaki dağ/mod ikonu ve metinler tamamen kaldırılır:

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│    00:39        ( ☕ )       ( ⏸ / ▶ )       ( ⤢ )       │
│  [Saf Beyaz]   [Turuncu]   [Kırmızı/Yeşil]   [Beyaz]     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

- **Arka Plan**: Saf siyah (`#000000`), tam yuvarlatılmış kapsül (`rounded-full`), ince zarif kenarlık (`border border-white/15`) ve derin gölge (`shadow-[0_12px_40px_rgba(0,0,0,0.95)]`).
- **En Solda Süre**: `font-mono text-2xl sm:text-3xl font-black text-white tracking-tight tabular-nums` — mod logosu veya ders adı olmadan doğrudan premium beyaz sayaç/kronometre. (Moladayken süre kehribar/beyaz tonunda mola süresini veya aktif süreyi akıcı şekilde gösterir).
- **Sağdaki 3 Eşit Boyutlu İkon Buton (`w-11 h-11 rounded-full`)**:
  1. **Mola Butonu (Turuncu)**: Odak ekranındaki mola rengiyle uyumlu turuncu (`bg-[#ff5500] hover:bg-[#ff6600] text-white` veya aktif molada parlak kehribar/turuncu vurgu) içinde `<Coffee />` ikonu.
  2. **Durdur / Başlat Butonu (Kırmızı / Yeşil)**:
     - Süre çalışırken **Kırmızı** (`bg-red-600 hover:bg-red-500 text-white`) içinde `<Pause />` (Durdur) ikonu.
     - Süre duraklatılmışken **Yeşil** (`bg-emerald-500 hover:bg-emerald-400 text-black`) içinde `<Play />` (Başlat) ikonu.
  3. **Büyütme Butonu (Beyaz)**: Saf beyaz (`bg-white hover:bg-neutral-200 text-black`) içinde `<Maximize2 />` ikonu. Tıklandığında anında tam ekran Focus görünümüne geri döndürür.

### B. Otomatik Algılamalı Müzik Butonu & Alt Çalar
- **Sol Müzik Butonu**:
  - Müzik çalmıyorken veya hiçbir müzik hesabı bağlı değilken: **Müzik / Şarkı simgesi (`<Music />`)**.
  - Spotify'dan çalınıyorken: **Spotify logosu** ve yeşil (`#1DB954`) vurgu.
  - YouTube Music'ten çalınıyorken: **YouTube Music logosu** ve kırmızı (`#FF0033`) vurgu.
  - Apple Music'ten çalınıyorken: **Apple Music logosu** ve mercan kırmızısı (`#FA243C`) vurgu.
- **Alttan Açılan Çalar Paneli**:
  - Üst barda yalnızca algılanan platformun logosu ve adı (örn. `Spotify`, `YouTube Music`, `Apple Music` veya bağlı değilse `Müzik Çalar`) ile sağda kapatma (`X`) butonu bulunur.
  - Çaların içinde platform değiştirme sekmeleri, `Bağlantılar` butonu veya `Hesabını Bağla` butonu **bulunmaz**.

### C. Sağ Üst Bildirim İkonu
- Odak ekranının sağ üst köşesindeki bildirim butonu `p-2 rounded-full` dairesel buton haline getirilir; `"Canlı Bildirim"` metni kaldırılır ve yalnızca `<Bell />` simgesi (izin durumuna göre zarif durum noktasıyla) gösterilir.

---

## 3. Temel Ürün Kararları & Teknik Yaklaşım

- **Karar 1: Üçlü Ortamda Birebir Aynı Saf Siyah Kapsül Deneyimi**
  - *Seçilen Yaklaşım*:
    1. **Uygulama İçi Küçültme (`FloatingMiniFocusPill`)**: Odak ekranı küçültüldüğünde veya başka cihazda aktif odak varken sağ altta/alt ortada saf siyah kapsül gösterilir.
    2. **Uygulama Dışı Yüzen PiP Penceresi (`Document Picture-in-Picture` + `Canvas Video PiP`)**: Kullanıcı bildirim izni verdikten sonra uygulamadan çıktığında veya PiP modunu açtığında, işletim sistemi üzerinde diğer uygulamaların üstünde duran saf siyah kapsül penceresi (`00:39` + Turuncu Mola + Kırmızı/Yeşil Durdur-Başlat + Beyaz Büyüt) canlı ve tıklanabilir olarak çalışır.
    3. **Sistem Bildirimi & Bildirim Önizleme (`NotificationPreviewModal` & `sw.js`)**: Bildirim önizleme modalında aynı saf siyah kapsül canlı olarak gösterilir ve gerçek zamanlı kontrol sağlar; ayrıca arka plan Service Worker bildirim aksiyonlarına **Mola**, **Durdur/Başlat** ve **Büyüt (Aç)** işlevleri eklenir.
- **Karar 2: Otomatik Platform Algılama Mekanizması**
  - *Seçilen Yaklaşım*: `spotifyService` bağlı olan platformları ve Spotify Web API / medya oturumunu sürekli kontrol eder. Hangi platform bağlıysa ve aktif çalıyorsa onu otomatik olarak aktif platform yapar. Hiçbir platform bağlı değilse veya müzik durdurulmuşsa sol buton `<Music />` simgesinde kalır.

---

## 4. Teknik Mimari & Veri Akışı

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         AKTİF ODAK SEANSI (ActiveFocusSession)             │
├────────────────────────────────────────────────────────────────────────────┤
│  [Sol Müzik Butonu]                      [Sağ Üst Bar]                     │
│   • Çalmıyorsa / Bağlı Değilse: 🎵        • 🔔 (Sadece Bildirim İkonu)      │
│   • Spotify Çalıyorsa: Spotify Logosu     • Görevler / Ses / Küçült / ⤢    │
│   • YT Music Çalıyorsa: YT Music Logosu                                    │
│   • Apple Music Çalıyorsa: Apple Logosu                                    │
└───────────────┬──────────────────────────────────────────┬─────────────────┘
                │                                          │
                ▼                                          ▼
┌───────────────────────────────────────┐  ┌─────────────────────────────────┐
│     ALTTAN AÇILAN ŞARKI ÇALAR         │  │   SAF SİYAH FOKUS KAPSÜLÜ       │
│  • Sadece aktif platform logosu + adı │  │  [ 00:39 ]  (☕)  (⏸/▶)  (⤢)   │
│  • Bağlantılar / Hesabını Bağla YOK   │  │  • Uygulama İçi Küçültme        │
│  • Platform seçici butonlar YOK       │  │  • Uygulama Dışı PiP Penceresi  │
│  • Şarkı Bilgisi + İlerleme + Kontrol │  │  • Bildirim & Önizleme Modalı   │
└───────────────────────────────────────┘  └─────────────────────────────────┘
```

### Etkileşim ve Durum Eşlemesi
- **Mola (`☕` - Turuncu Buton)**: Tıklandığında hem uygulama içinde hem PiP penceresinde hem de bulutta (`active_focus/current`) mola durumunu (`isCampActive`) anında değiştirir.
- **Durdur / Başlat (`⏸` Kırmızı / `▶` Yeşil Buton)**: Çalışırken kırmızı renkte `Pause` ikonu gösterir ve tıklandığında süreyi duraklatır; duraklatıldığında yeşil renkte `Play` ikonu gösterir ve tıklandığında süreyi kaldığı saniyeden devam ettirir.
- **Büyüt (`⤢` - Beyaz Buton)**: Tıklandığında PiP penceresini kapatıp/odaklayıp doğrudan tam ekran Focus seansını açar.

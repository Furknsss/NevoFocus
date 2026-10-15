# Canlı Görev Renkleri, Arka Plan Seans Devamlılığı, Üst Bar Günlük Kronometre ve Manuel Süre Girişi Uygulama Planı

Kullanıcının belirlediği 4 temel işlevsellik ve yanıtladığı tercihler doğrultusunda hazırlanmış kapsamlı uygulama planı:

---

## 1. Görev Türleri & Sınav Alanları Renk Ayrımı & Takvim İbaresi
- **Görev Türleri Canlı Renk Ayrımı (TasksView.tsx):**
  - Görev oluştururken ve liste kartlarında görevin sağında yer alan rozetlerde her türe özel net renk paleti:
    - **Soru Çözümü:** Turuncu rozet & ikon (`bg-orange-500/15 text-orange-400 border-orange-500/30`)
    - **Video İzleme:** Mavi rozet & ikon (`bg-blue-500/15 text-blue-400 border-blue-500/30`)
    - **Konu Çalışma:** Zümrüt Yeşili rozet & ikon (`bg-emerald-500/15 text-emerald-400 border-emerald-500/30`)
    - **Rutin / Tekrar:** Canlı Mor rozet & ikon (`bg-purple-500/15 text-purple-400 border-purple-500/30`)
    - **Deneme Çözümü:** Canlı Pembe rozet & ikon (`bg-pink-500/15 text-pink-400 border-pink-500/30`)
- **Sınav Alanları (TYT vs AYT vs YDT) Renk Ayrımı:**
  - Mevcut durumda hepsi mavi görünen alan etiketleri ayrıştırılacak:
    - **TYT:** Canlı Gökyüzü Mavisi (`bg-sky-500/20 text-sky-300 border-sky-500/30`)
    - **AYT:** Derin İndigo / Gece Moru (`bg-indigo-500/20 text-indigo-300 border-indigo-500/30`)
    - **YDT:** Sıcak Kehribar / Altın Sarısı (`bg-amber-500/20 text-amber-300 border-amber-500/30`)
    - **Okul / Genel:** Zümrüt (`bg-teal-500/20 text-teal-300 border-teal-500/30`)
- **Aylık Takvim Hücre İbaresi (StatisticsView.tsx):**
  - Takvim hücrelerinde alt satırda yer alan "dinlenme" ibaresi kaldırılarak doğrudan **"odaklanma"** (örneğin: `1 sa 20 dk odaklanma` veya `0 seans odaklanma`) yazılacak.

---

## 2. Arka Planda & Sayfa Yenilemede Kesintisiz Seans & Erken Bitirmede Gerçek Süre
- **Kalıcı Aktif Seans Durumu (localStorage):**
  - `active_focus_session_state` anahtarıyla seansın modu, dersi, görevi, hedef süresi, başlangıç zamanı (`startTimeMs`), duraklatma ve mola bilgileri her saniye/durum değişikliğinde yerel belleğe kaydedilecek.
  - Kullanıcı sekmeyi kapatsa veya sayfayı yenilese dahi, uygulama açıldığında otomatik olarak aktif seans ekranı açılacak ve duvar saati farkı (`Date.now() - startTimeMs`) hesaplanarak seans tam kaldığı yerden canlı akmaya devam edecek.
  - Seans bittiğinde veya iptal edildiğinde bu geçici kayıt temizlenecek.
- **Erken Bitirmede Gerçek Sürenin Kaydedilmesi:**
  - 60 dakikalık geri sayım başlatılıp 54. dakikada "Bitir / Tamamla" butonuna basıldığında, sisteme 60 dakika yerine **gerçek çalışılan net süre olan 54 dakika** (`elapsedSeconds`) kaydedilecek.
  - Kullanıcı seansı hangi dakikada bitirirse istatistiklere, grafiklere ve profile tam olarak o süre işlenecek.

---

## 3. Üst Bar: Günlük Toplam Odak Kronometresi (Ses Butonunun Solunda)
- `Header.tsx` içerisinde günün o ana kadarki toplam çalışma süresi (`Bugün: 2 sa 15 dk`), sağ üst köşedeki **Ses (Zen Audio) butonunun hemen soluna** şık bir sayaç rozeti olarak konumlandırılacak.
- Canlı çalışan odak seansıyla birlikte bu sayaç da eşzamanlı olarak artacak ve kullanıcı dilediği an o günkü toplam odaklanma süresini tek bakışta görebilecek.

---

## 4. Görev Listesinden Odaksız Tamamlamada Saat & Dakika Sorgulama
- Kullanıcı aktif odak seansı açmadan ya da seansı iptal ettikten sonra Görevler listesindeki tamamlama kutucuğuna tıkladığında:
  - Şık bir **"Görevi Tamamla & Süre Gir"** modalı açılacak.
  - Kullanıcı için doğrudan doldurulabilir iki adet net kutu sunulacak:
    - `[   ] Saat`  ve  `[   ] Dakika` (varsayılan olarak görevin planlanan süresi hazır gelecek).
  - "Kaydet & Görevi Tamamla" butonuna basıldığında:
    - Girilen saat ve dakika (`hours * 3600 + minutes * 60`) baz alınarak tamamlanmış bir `FocusSession` nesnesi oluşturulup kaydedilecek.
    - Günlük odak saatine, istatistiklere ve plana uyum yüzdesine bu süre eklenecek.

---

## 5. Doğrulama & Derleme
- `lint_applet` ve `compile_applet` ile sıfır hata doğrulaması.
- Görev listesinde her görev türünün ve TYT/AYT alanlarının farklı renklerde görüntülendiğinin teyidi.
- Sayfa yenilendiğinde aktif odak seansının kaldığı yerden aktığının ve erken bitirmede net sürenin kaydedildiğinin doğrulanması.
- Üst barda ses butonunun solundaki günlük kronometrenin ve görev manuel tamamlama modalının test edilmesi.

# FOKUS - Premium Focus & YPT Öğrenci Takip Sistemi

Forest, Climb, Focus Flight ve Deep Dive modlarıyla donatılmış, YPT tarzı 24 saatlik zaman çizelgeli ve istatistikli premium odaklanma platformu.

---

## 🚀 GitHub & Vercel Dağıtım Rehberi (Deployment Guide)

Bu proje Vercel üzerinde tek tıkla çalışacak şekilde (`vercel.json`, `dist` çıktı dizini, SPA routing yönlendirmeleri ve Firebase entegrasyonu) hazır hale getirilmiştir.

### 1. Adım: GitHub Deposu Açma ve Projeyi Gönderme (Push)

1. [GitHub](https://github.com/new) üzerinde yeni bir repository (depo) oluşturun (Örneğin: `fokus-app`).
2. Bu AI Studio terminalinde veya bilgisayarınızda şu komutları çalıştırarak GitHub deponuza bağlayın:

```bash
# GitHub deponuzun linkini ekleyin:
git remote add origin https://github.com/KULLANICI_ADINIZ/fokus-app.git

# Ana dala gönderin:
git branch -M main
git push -u origin main
```

*(Eğer token veya şifre sorarsa GitHub Personal Access Token (PAT) kullanabilirsiniz).*

---

### 2. Adım: Vercel'e Bağlama ve Yayınlama (Vercel Deploy)

1. [vercel.com](https://vercel.com) adresine gidin ve giriş yapın.
2. **"Add New..."** -> **"Project"** butonuna tıklayın.
3. GitHub hesabınızı bağlayıp az önce oluşturduğunuz `fokus-app` deposunu seçin (**Import**).
4. Yapılandırma ayarları:
   - **Framework Preset**: `Vite` (Vercel otomatik tanır)
   - **Root Directory**: `./` (Varsayılan)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. **"Deploy"** butonuna basın. Yaklaşık 30-45 saniye içinde siteniz canlıya (`https://proje-adiniz.vercel.app`) alınacaktır! 🎉

---

### 3. Adım: Sürekli Güncelleme Akışı (Continuous Deployment)

Artık sistem tam otomatiktir:
1. Burada veya yerel ortamınızda geliştirmeleri yapın.
2. `git add .`
3. `git commit -m "yeni özellik veya güncelleme"`
4. `git push`
5. GitHub'a her `git push` yaptığınızda Vercel otomatik olarak yeni versiyonu derleyip birkaç saniye içinde canlıya alır.

---

## 🛠️ Yerel Geliştirme (Local Development)

```bash
# Bağımlılıkları yükleyin
npm install

# Geliştirme sunucusunu başlatın (port 3000)
npm run dev

# Canlı derleme testi
npm run build
```

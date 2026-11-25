# Steal from Granny: Prop Hunt (eski adı Kılık Soygunu): yayın kılavuzu

*24 Kasım 2026 gecesi hazırlandı.*

## Yüklenecek dosya

`release/kilik-soygunu-poki.zip` (yaklaşık 4 MB). İçinde `index.html`, `assets/`, `models/`, `chars/` ve `ui/` var; açılınca doğrudan çalışır. Bütün yollar göreceli olduğu için Poki'nin alt klasöründe de çalışır.

Yeniden üretmek için `kilik-soygunu` klasöründe:

```
npm run release
```

## Poki'ye gönderme

1. Poki for Developers sayfasından geliştirici hesabı aç ve oyunu gönder. Poki gönderilen oyunları seçerek yayınlar. Önce Poki'nin test sayfasında (Poki Inspector) zip'i yükleyip dene.
2. **Poki SDK zaten bağlı** (`index.html` içindeki betik ve `src/platform.ts`):
   - Modeller yüklenince `gameLoadingFinished` çağrılıyor.
   - Gece başlayınca ve kaldığın yerden devam edince `gameplayStart`; duraklatma, kazanma, yakalanma ve menüye dönüşte `gameplayStop`.
   - İlk gece hariç her yeni geceden önce `commercialBreak`.
   - `rewardedBreak` kullanılan yerler:
     - Gece sonu ×2–×5 çarpanı
     - Yakalanınca ganimetle devam
     - Gece başı "+1 karın"
     - Görev ödülünü ×2 alma
     - Görevi değiştirme
   - Reklam sırasında bütün ses kısılıyor; sekme gizlenince oyun duraklıyor.
   - SDK yoksa (reklam engelleyici, çevrimdışı) oyun kilitlenmiyor, ödüller yine veriliyor.
3. Kapak görseli ve kısa video için iyi anlar:
   - Teyze arkasını dönünce yürüyen saksı
   - Kedinin salatalıktan korkması
   - Karanlık gecede fener hüzmesi
   - Robot süpürgenin jöleyi emmesi

## Oyunun içinde ne var

- **Kontroller:** Klavye (WASD, E, Shift, Q) ya da dokunmatik (joystick ve 3 düğme).
- **Dil:** Türkçe ve İngilizce. Cihazın diline göre seçiliyor; ayarlardan değişiyor.
- **Zorluk:** Kolay, Orta, Zor.
- **6 gece:**

| Gece | Ad | Yeni olan |
|---|---|---|
| 1 | İlk Gece | Öğretici |
| 2 | Pamuk Uyanık | Kedi |
| 3 | Çalışma Odası | Robot süpürge |
| 4 | Misafir Dede | İki bekçi |
| 5 | Elektrik Kesik | Karanlık, fenerli Teyze |
| 6 | Büyük Soygun | Teyze en sık kullandığın kılığı hatırlıyor |

- **İlerleme:**
  - Yıldızlar ve altın
  - 5 yükseltme, her biri 3 seviye
  - 8 jöle rengi
  - Kılık albümü (34 tür) ve ganimet koleksiyonu
  - Günlük kavanoz ve günlük 3 görev
- **Ayarlar:** ses, müzik, görüntü kalitesi, dil. Telefonda kalite otomatik olarak "düşük" başlıyor.
- **Menü arkasında tanıtım oyunu:** bot kendi kendine soygun yapıyor.

## Arayüz

- Bütün ikonlar, karakter yüzleri, logo, gece kartı resimleri ve duvar kâğıdı dokusu Nano Banana (Google AI Studio) ile üretildi. Kaynak görseller `art/ui-src/` içinde.
- `scripts/cut-icons.py` sayfaları tek tek şeffaf ikonlara böler; `scripts/cut-art.py` tek bir görseli keser.
- Yazı tipi Fredoka (SIL Open Font License), oyunla birlikte paketleniyor; dış bağlantı gerekmiyor.

## Doğrulananlar

- 54 otomatik test geçiyor: kurallar, kayıt, görevler, yol bulma, her gecenin kazanılabilirliği.
- Bağımsız bir kod incelemesi 10 sorun buldu (reklam sırasında gecenin iki kez başlaması, gıdıkta hiçbir şey yapmadan geçmek, değerli ganimetle dolan karnın oyunu kilitlemesi, bozuk kayıt dosyasının çökertmesi vb.); hepsi düzeltildi ve test edildi.
- Bir bot 6 geceyi 3 zorluğun hepsinde, her birinde 3 farklı oyunla oynadı; hepsini kazandı.
- Tarayıcıda Poki SDK hata ayıklama modunda başlangıç, test reklamı ve ödül akışı çalıştı.
- Masaüstünde kare başına 3,7 ms (ekran kartı dahil). Bu ölçüm yeni karakterlerden önce yapıldı.
- Yeni karakterler: Teyze ve Dede'de yürüme, koşma ve bekleme animasyonu var. Teyze alarmda oklavayı, karanlıkta feneri, Dede bastonu elinde tutuyor. Üçü de tarayıcıda, derlenmiş sürümde yükleniyor. Model yüklenemezse eski elle yapılmış karakter devreye giriyor.

## Bilinen eksikler ve riskler

- **Gerçek bir insan oyuncuyla test edilmedi.** Bot her şeyi bildiği için geceleri 15–90 saniyede bitiriyor; insan muhtemelen 2–4 dakika harcar. Zorluk ayarı bot verisine dayanıyor.
- **Telefonda kare hızı ölçülmedi.** Düşük kalite modu var: efekt yok, 1× piksel, küçük gölge.
- **İsim:** "Steal from Granny: Prop Hunt". Çocukların çok aradığı üç kelimeyi birleştiriyor: steal, granny, prop hunt. Her iki dilde de bu İngilizce ad kullanılıyor.
  - Poki'de ve mağazalarda aynı adla oyun olup olmadığına bakılmadı.
  - "Granny" kelimesi başka bir korku oyununun adında da geçiyor; logo ve görseller ona benzemiyor ama yayın öncesi kontrol et.
- **Ses:** müzik ve efektler kodla üretiliyor. Profesyonel ses dosyaları kaliteyi artırır.
- **Modeller:** Eşyalar Kenney ve KayKit (CC0); atıf zorunlu değil, ayarlar ekranında teşekkür var.
- **Karakterler (Teyze, Dede, Pamuk) Tripo3D ile üretildi.** Yayından önce Tripo hesabının planında üretilen modellerin ticari kullanım hakkını kontrol et; ücretsiz planda atıf gerekebilir.
- **Pamuk'un iskeletini oyun kendisi kuruyor** (`src/render/catRig.ts`). Tripo'nun otomatik iskeleti eksikti: bir arka bacak yoktu. Oyun yüklenirken dört ayak, kuyruk ve kafa modelden bulunuyor, ağırlıklar otomatik veriliyor. Yürüyüş kodla yapılıyor: çapraz bacaklar birlikte adım atıyor (tırıs), kuyruk sallanıyor, kafa sallanıyor. Hazır animasyon dosyası kullanılmadığı için hareketler basit.

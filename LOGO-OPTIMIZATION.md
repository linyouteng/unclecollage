# Logo 最佳化變更紀錄

## 新增的頁面用圖

| 圖檔 | 像素尺寸 | 用途 |
|---|---:|---|
| `assets/brand/logo-mark-32.webp` | 32×32 | 案例清單導覽列，一般螢幕 |
| `assets/brand/logo-mark-64.webp` | 64×64 | 管理頁導覽列，或案例清單高解析螢幕 |
| `assets/brand/logo-mark-128.webp` | 128×128 | 管理頁高解析螢幕 |
| `assets/brand/logo-wordmark-h64.webp` | 201×64 | 橫式品牌 Logo，一般螢幕 |
| `assets/brand/logo-wordmark-h128.webp` | 402×128 | 橫式品牌 Logo，高解析螢幕 |
| `assets/brand/logo-social-1200x630.jpg` | 1200×630 | Open Graph／Twitter 預設分享圖 |

頁面已使用 `srcset`，瀏覽器會依一般或高解析螢幕選擇適合的版本。

## 舊網址相容性

原有的 `/logo.png` 與 `/logo2.png` 網址仍然保留，但已將超高解析來源縮小並壓縮，避免舊連結或舊快取直接引用時失效。沒有程式引用的 `logo1.png` 已移除。

## PWA

原有 32、180、192、512 px PNG 圖示維持原尺寸，並重新進行無損 PNG 壓縮。Service Worker 快取版本由 `v1.0.3` 更新為 `v1.0.4`，改為預先快取適合頁面尺寸的品牌圖檔，不再預載三張大型來源 Logo。

## 容量結果

- 原始圖片總量：3,659,860 bytes
- 最佳化後圖片總量：942,490 bytes
- 減少：2,717,370 bytes（74.2%）

原始高解析圖稿仍保留在本次修改前的來源 ZIP 中。

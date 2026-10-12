# 自然大叔照片案例系統｜正式網域與 SEO / 隱私整理

日期：2026-10-07

## 正式網址

- 照片案例系統：`https://photos.naturaluncle.com/`
- 公開案例清單：`https://photos.naturaluncle.com/gallery.html`
- 官方網站：`https://naturaluncle.com/`
- 線上預約：`https://booking.naturaluncle.com/`
- 價目表：`https://price.naturaluncle.com/`

## 本次修改

1. 將舊的 `natural-uncle-official.netlify.app` 連結改為 `naturaluncle.com`。
2. 將舊的 `uncle-reservation-platform.netlify.app` 連結改為 `booking.naturaluncle.com`。
3. 公開案例頁「價格方案」改連至 `price.naturaluncle.com`。
4. 公開案例清單 `gallery.html` 補上 canonical、Open Graph、Twitter Card 與可索引設定。
5. 建立/管理頁 `index.html` 設為 `noindex,nofollow,noarchive`，避免管理入口出現在 Google。
6. 個別案件頁 `post.html` 與動態分享網址加入 `noindex,nofollow,noarchive`，避免客戶案件標題、地點或照片頁被搜尋引擎收錄；社群分享預覽功能仍保留。
7. 動態分享 Function 回應加入 `X-Robots-Tag`。
8. 新增 `robots.txt` 與 `sitemap.xml`；Sitemap 僅提交公開案例清單頁。
9. PWA cache 版本升級至 `v1.0.5`，讓已安裝/加入主畫面的裝置能更新新版靜態頁。

## Google Search Console

可提交：`https://photos.naturaluncle.com/sitemap.xml`

個別客戶案件頁刻意不列入 Sitemap。

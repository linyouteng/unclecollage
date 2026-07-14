# unclecollage

## 分享網址格式

新增案件若未手動輸入網址代碼，系統會依服務日期自動產生流水號，例如 `20260528-001`、`20260528-002`。公開分享網址格式為 `https://你的網站網址/20260528-001`；舊版 `/p/<slug>` 連結仍保留支援。


## PWA / 加入主畫面

本版本已加入 `manifest.webmanifest`、`service-worker.js`、`assets/pwa.js` 與 PWA 圖示。部署到 Netlify HTTPS 網址後，手機可透過瀏覽器「加入主畫面」或「安裝應用程式」方式，以接近 APP 的形式開啟。

- iPhone / iPad：建議使用 Safari，點分享按鈕，再選「加入主畫面」。
- Android / 桌機 Chrome、Edge：可點瀏覽器的「安裝」提示，或右上角選單中的「安裝應用程式 / 加入主畫面」。


## Logo assets

頁面已改用依顯示尺寸輸出的品牌圖檔：

- `assets/brand/logo-mark-32.webp`：案例清單導覽列
- `assets/brand/logo-mark-64.webp`、`logo-mark-128.webp`：管理頁與高解析螢幕
- `assets/brand/logo-wordmark-h64.webp`、`logo-wordmark-h128.webp`：橫式品牌 Logo
- `assets/brand/logo-social-1200x630.jpg`：社群分享預設圖片

`logo.png` 與 `logo2.png` 僅保留縮小後的相容版本，避免舊連結直接引用時失效。PWA 圖示維持既有尺寸並重新進行無損 PNG 壓縮。

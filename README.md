# unclecollage

## 分享網址格式

新增案件若未手動輸入網址代碼，系統會依服務日期自動產生流水號，例如 `20260528-001`、`20260528-002`。公開分享網址格式為 `https://你的網站網址/20260528-001`；舊版 `/p/<slug>` 連結仍保留支援。


## PWA / 加入主畫面

本版本已加入 `manifest.webmanifest`、`service-worker.js`、`assets/pwa.js` 與 PWA 圖示。部署到 Netlify HTTPS 網址後，手機可透過瀏覽器「加入主畫面」或「安裝應用程式」方式，以接近 APP 的形式開啟。

- iPhone / iPad：建議使用 Safari，點分享按鈕，再選「加入主畫面」。
- Android / 桌機 Chrome、Edge：可點瀏覽器的「安裝」提示，或右上角選單中的「安裝應用程式 / 加入主畫面」。

# unclecollage

## 分享網址格式

新增案件若未手動輸入網址代碼，系統會依服務日期自動產生流水號，例如 `20260528-001`、`20260528-002`。公開分享網址格式為 `https://photos.naturaluncle.com/20260528-001`；舊版 `/p/<slug>` 連結仍保留支援。


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

## 客戶社群分享功能（2026-10-22）

客戶分享頁 `post.html` 已新增位於完整照片與說明之後的社群分享區塊；原本頁面上方的「連結分享」按鈕已移至底部分享流程，避免客戶尚未看完成果就先看到分享邀請。照片瀏覽、下載 ZIP 與原有服務連結保留。

- 預設分享文案以客戶分享清洗紀錄的角度撰寫，可自行修改。
- LINE：開啟 LINE 分享畫面並帶入文字及案件網址。
- Facebook：開啟網址分享畫面，並嘗試先複製文案，供客戶自行貼上；Facebook 不允許網站預先填入貼文文字。
- Threads：開啟發文意圖頁並預填文字及案件網址。
- Instagram：提供複製文案、複製案件網址及開啟 Instagram 的步驟，提醒客戶在限時動態使用「連結」貼紙。
- 所有平台均由客戶自行確認及發布，不會自動發文。
- Service Worker 快取版本升級至 `v1.0.6`，讓已安裝的 PWA 能更新新的分享頁面。

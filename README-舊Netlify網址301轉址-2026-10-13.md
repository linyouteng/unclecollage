# 舊 Netlify 網址 301 永久轉址（2026-10-13）

本版新增照片案例系統舊網址到正式網域的 301 永久轉址。

- 舊網址：`https://unclecollage.netlify.app/*`
- 正式網址：`https://photos.naturaluncle.com/*`
- 狀態碼：`301 Moved Permanently`
- 保留原路徑，例如：
  - `https://unclecollage.netlify.app/gallery.html` → `https://photos.naturaluncle.com/gallery.html`
  - `https://unclecollage.netlify.app/20260528-001` → `https://photos.naturaluncle.com/20260528-001`
  - `https://unclecollage.netlify.app/p/demo` → `https://photos.naturaluncle.com/p/demo`

原有 `/p/*` 與 `/:slug` 的 Netlify Functions rewrite 均保留，正式網域上的照片分享功能不受影響。

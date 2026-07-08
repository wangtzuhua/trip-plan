# 🗾 九州慶生自駕之旅 2026 — 旅遊小工具

6天5夜熊本・阿蘇・高千穗・由布院自駕行程的手機版旅遊 App。
純前端（HTML / CSS / JavaScript），無資料庫、無建置步驟，任何靜態網站服務皆可部署。

## 功能

- 📅 **每日行程卡片**：景點／美食／交通／住宿／溫泉分類設計，含 Map Code（點擊複製）與電話（點擊撥打）
- 🧭 **一鍵導航**：每個地點自動附 Google Maps 駕車導航按鈕
- ⛅ **即時天氣**：每日卡片頂部顯示該日該地的天氣預報（[Open-Meteo](https://open-meteo.com/) 免費 API，免金鑰）
- 🏮 **導遊小知識**：每個景點附故事與攻略，「必吃美食 / 必點菜單 / 必買伴手禮 / 重要預約」以不同顏色標籤亮顯
- 🍱 **美食地圖頁**：依區域（熊本／阿蘇／由布院）分類，可依 ⭐評價 或 📍距離（GPS 定位）排序
- 🛍️ **購買清單頁**：依商店分類（藥妝店／唐吉訶德／3COINS／超市／伴手禮），可勾選且自動記住進度
- 🎫 **資訊頁**：航班、租車、住宿、緊急聯絡電話、出發前檢查清單（勾選狀態自動儲存在手機）
- 📲 **PWA（可安裝＋離線可用）**：加入主畫面後像原生 App；行程、美食、購物清單皆已快取，**山區沒訊號也能開**（天氣預報需連網才會更新）

## 本機預覽

```bash
cd 旅遊計劃
python3 -m http.server 8000
# 開啟 http://localhost:8000
```

## 部署（GitHub Pages · 已附自動部署）

1. 建立一個 GitHub repo，把這個資料夾的內容 push 上去（`main` 分支）
2. Repo → **Settings → Pages → Source** 選 **GitHub Actions**
3. 已附好 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)，push 到 `main` 即自動部署
4. 網址會是 `https://<你的帳號>.github.io/<repo名稱>/`

> ⚠️ GitHub Pages 免費方案的 repo 需設為 **public**（私有 repo 用 Pages 需付費的 GitHub Pro）。
> 若想維持原始碼私有，可改用 Netlify / Cloudflare Pages / Vercel 連私有 repo（皆免費支援）。
>
> PWA 與離線快取採**相對路徑**，在 GitHub Pages 的子路徑（`/repo名稱/`）下也能正常運作。

## 手機使用小技巧

用 Safari / Chrome 開啟部署後的網址 → 分享 → **加入主畫面**，即可像原生 App 一樣全螢幕使用、且離線可看行程。iOS 加入主畫面後，啟動時會顯示專屬的鳥居啟動畫面（涵蓋 iPhone SE ~ 16 Pro Max 各解析度，[splash/](splash)）。

> 改版後想讓已安裝的使用者更新：把 [`sw.js`](sw.js) 最上方的 `CACHE = "kyushu-trip-v1"` 版本號 +1 即可。

## 資料維護

所有行程、餐廳、購買清單資料都在 [js/data.js](js/data.js)（購物清單在 `STORES` 陣列），直接編輯即可，不需要碰其他程式碼。

> ⚠️ 備註：餐廳評分為 Google Maps 參考值；緊急聯絡電話與航班班號請於出發前再次核對。

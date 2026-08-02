# SOP Web App

## 你的目錄 Google Sheet 需要四張分頁

### SOP
大分類 | SOP名稱 | Google Docs網址

### Database
大分類 | 名稱 | Google Sheet網址 | 暫時內容

「沒在測項」可填：Test | 沒在測項 | 你的空白 Google Sheet 網址 | TRUE

### Users
Email

### Menu
可保留目前內容，第一版程式主要從 SOP 與 Database 建立選單。

## 設定
1. 上傳本專案到 GitHub。
2. Google Sheet → 擴充功能 → Apps Script，把 apps-script/Code.gs 貼入。
3. 修改 Code.gs 的 INDEX_SPREADSHEET_ID。
4. Apps Script 部署為網頁應用程式，執行身分選「我」，存取權選「任何人」。
5. 複製 Apps Script 網址，貼到 js/config.js。
6. 在 Google Cloud Console 建立 Web OAuth Client ID，把 GitHub Pages 網址加入 Authorized JavaScript origins。
7. 把 Client ID 貼到 js/config.js。
8. GitHub Settings → Pages → Deploy from branch → main / root。

Google Docs 與 Google Sheet 不必公開；Apps Script 會驗證登入者是否存在 Users 白名單。

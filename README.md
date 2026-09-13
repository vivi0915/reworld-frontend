# re:world

本儲存庫是 Reworld 後續開發的主要原始碼來源。請沿用 GitHub 分支與提交紀錄，優先透過 GitHub Actions 建置與測試，避免每次建立新的本機副本。

目前正式前台：https://reworld-member-app.vivi56782003.chatgpt.site/

目前正式後台：https://reworld-member-app.vivi56782003.chatgpt.site/admin

正式網站目前由 Sites 託管。GitHub 提交不會自動更新這個網址；目前也沒有獨立測試站。這份公開儲存庫不包含正式會員資料、管理員密碼或私人帳號建立 migration。

## 本階段功能

Guest 可直接使用首頁、酒單、職業選擇、抽卡及符合營運條件時的 ACCESS。Player 保存 Player ID、選擇與抽卡紀錄。後台提供四個營運開關、維護訊息、會員搜尋及停權、統計、Door PIN 設定與操作紀錄。

手機 OTP 程式與安全限制已實作，但尚無 SMS 供應商，因此正式簡訊註冊尚未啟用。既有帳密登入保留。Door PIN 尚未設定時保持空值、Access 停用。Reward/Claim 已保留資料結構，實際獎勵規則待定。詳見 [OPERATIONS.md](OPERATIONS.md)。

## 驗證

使用 Node.js 24：`npm ci`、`npm run typecheck`、`npm run lint`、`npm test`。測試使用隔離資料庫與測試 SMS，不會操作正式會員。GitHub Actions 在 push、PR 或手動執行時完成同樣檢查。

需要本機預覽才執行 `npm run db:local`、`npm run dev`。不需預覽時可不安裝 node_modules；請勿刪除未備份的 `.wrangler` 本機資料庫。

## 選用 Cloudflare 自動部署

部署流程預設停用，且與現有 Sites 正式站不同。設定前不會產生新網址或搬移會員資料。

1. 準備 Cloudflare Workers 帳號與 D1 資料庫。
2. GitHub production environment 設定 Secrets：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`。
3. Repository Variables 設定真實 `REWORLD_D1_DATABASE_ID`，確認目標後設 `REWORLD_DEPLOY_ENABLED=true`。
4. 手動執行 Deploy reworld，或 main 通過檢查後自動部署。

新 D1 是空環境，不會自動擁有現有 viviadmin 帳號。正式資料搬移與網域切換必須另外安排。SMS 與 OTP secret 只在執行環境設定，禁止提交到 GitHub。

# re:world

手機優先的酒吧會員 App：註冊登入、會員資料、模擬門鎖、職業抽卡與冒險紀錄，以及四種屬性各三杯的擲骰子菜單。

## 部署架構

GitHub 保存原始碼；Cloudflare Workers 執行完整網站與 API；Cloudflare D1 保存會員與抽卡紀錄。GitHub Pages 僅支援靜態內容，無法單獨執行此專案的登入與資料庫 API。

此專案尚未綁定 Cloudflare 帳號。請勿將 Token、密碼、本機資料庫、會員名單或 `.env` 檔提交到 GitHub。

## 本機開發

使用 Node.js 24，執行 `npm ci`、`npm run db:local`、`npm run dev`。
資料僅存於本機 `.wrangler`；新環境不會帶入舊站會員。

## 連接 GitHub 自動部署

1. 建立並登入 Cloudflare 帳號，建立 D1 資料庫 `reworld-members`。
2. 在 GitHub 專案建立 `production` environment，將 Cloudflare API Token 與帳號 ID 填入 Secrets：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`。Token 僅授予目標帳號必要的 Workers 部署與 D1 權限。
3. 在 repository Variables 填入 `REWORLD_D1_DATABASE_ID`，確認後將 `REWORLD_DEPLOY_ENABLED` 設為 `true`。
4. 執行 Actions → Deploy reworld。流程會建置、套用資料表遷移，再發布到 Workers。
5. 以 Cloudflare 實際回傳的 workers.dev 網址測試；設定完成前沒有可用的新網址。

也可在本機完成 `wrangler login` 後，設定 `REWORLD_D1_DATABASE_ID` 並執行 `npm run deploy`。
不得覆写已套用的 drizzle migration；新增 schema 變更時使用 `npm run db:generate`。

## 管理員

新會員一律為一般會員；店家應先在新站註冊，再由維護者確認指定帳號後設定 admin 權限。這份原始碼不包含既有 viviadmin 帳號、密碼或登入憑證。

## 驗證與限制

`npm run typecheck`、`npm run build`。會員 API 整合測試需先啟動本機預覽，再執行 `RUN_MEMBER_API_TESTS=1 node --test tests/member-api.test.mjs`；測試結束後執行產生的本機測試清理 SQL。

門鎖為模擬；菜單酒名與價格待確認。新 Cloudflare 環境尚須檢查會員註冊、登入、抽卡與資料庫持久化，並確認帳號方案的執行時間限制能容納密碼雜湊。尚未包含 Email 驗證或密碼找回服務。

部署參考：https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/

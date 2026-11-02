# XeroxYT-NTv6

**YouTubeの動画・Shortsを検索して視聴するWebクライアントのフロントエンド**です。React・TypeScript・Vite製で、スマホ・iPad・PCに対応します。YouTube公式サイトのリポジトリではありません。

このリポジトリだけをデプロイしても、検索・動画情報・ログイン・履歴保存は動作しません。先に別リポジトリのAPIをCloudflareへデプロイして、そのURLを環境変数に設定してください。

- フロントエンド: https://github.com/Xerox-Pro/XeroxYT-NTv6
- 必須のAPI: https://github.com/Xerox-Pro/XeroxYT-NTv6-APIv1

## できること

- 動画検索、検索候補、チャンネル内検索、カテゴリ別おすすめ
- 通常動画と縦スクロールのShorts視聴、コメント、関連動画
- 概要欄を下から開くパネル、ミニプレイヤー
- マイページにアカウント・視聴履歴・再生リストを集約
- 表示名とアイコンの端末内カスタマイズ（サーバーには送信しません）
- D1を使ったサイトアカウント・視聴履歴の保存

動画のダウンロード機能はありません。AI StudioはAPI側にGEMINI_API_KEYを設定した場合に利用できます。

## デプロイ方法（Cloudflare API → Vercel）

1. [XeroxYT-NTv6-APIv1](https://github.com/Xerox-Pro/XeroxYT-NTv6-APIv1) のREADMEに従って、Cloudflare D1とWorkerを準備します。
2. APIの `/health` が応答することを確認し、WorkerのURLを控えます。
3. このリポジトリをVercelへインポートします。FrameworkはVite、Build Commandは `npm run build`、Output Directoryは `dist` です。
4. Vercelの **Settings → Environment Variables** に次の変数を設定します。Previewで試す場合はPreview、公開時はProductionにも設定してください。

| 変数 | 設定例 | 注意 |
|---|---|---|
| `API_BASE_URL` | `https://your-api.your-subdomain.workers.dev` | 必須。末尾の `/` や `/api` を付けない |

5. API側の `ALLOWED_ORIGINS` に、実際のフロントのURL（`https://your-site.vercel.app`）を追加してAPIを再デプロイします。複数の場合はカンマ区切り。PreviewのURLも個別に追加してください。
6. Vercelをデプロイし直します。環境変数の変更は、すでに作成済みのデプロイには反映されません。

Vercelのゲートウェイ関数が環境変数を読みます。API URLのソースへの直書きや `VITE_API_BASE_URL` は不要です。ブラウザーは常に同じサイトの `/api/…` を呼ぶため、ログインCookieを維持できます。変数が未設定・不正な場合はビルド時にエラーで案内します。

### ローカル開発

```sh
npm ci
cp .env.example .env.local
# .env.local の API_BASE_URL をデプロイ済みのAPIに変更
npm run dev
```

APIの `ALLOWED_ORIGINS` に `http://localhost:5173` も追加します。アカウントCookieにはSecure属性があるため、認証を含めた最終確認はHTTPSのVercel Previewを利用してください。

## 使い方

サイトを開いてサイトアカウントを作成するかログインします。サイトアカウントとYouTubeアカウントは別のものです。検索ボタンからキーワードや動画リンクを入力し、Shortsは上下にスクロールして切り替えます。タイトル下の概要カードを押すと、詳細・リンク・公開日などがパネルで開きます。

下部の「マイページ」に履歴と再生リストがあります。「プロフィールを編集」で表示名・画像を変更できます。これはアカウントのログイン名を変えず、同じ端末・同じブラウザー・同じサイトの保存領域だけに適用されます。別の端末や別のPreview URLには自動同期されません。再生リストやプロフィールの端末データはブラウザーのサイトデータ削除で消えます。

## 検証と制限

```sh
npm run lint
npm run build
node --test tests/*.test.mjs
```

Cloudflare Workers Freeでは、重い検索・動画情報の解析がCPU上限に達して1102エラーになることがあります。通信待ちとは別の制限で、すべての呼び出しの安定動作を保証するものではありません。API側のREADMEも確認してください。Google認証が必要なYouTubeの個人データ機能には、別途YouTubeへの認証が必要です。

## 複数APIと接続経路

`API_BASE_URL_1`、`API_BASE_URL_2`、`API_BASE_URL_3`…をVercelの環境変数へ追加できます。番号は飛んでも構いません。アプリに登録数の固定上限はありませんが、Vercelの環境変数数・実行時間の上限は適用されます。従来の `API_BASE_URL` は先頭の互換設定として利用できます。同じURLは重複を除去します。

```dotenv
API_BASE_URL_1=https://your-primary.workers.dev
API_BASE_URL_2=https://your-node-api.vercel.app
API_BASE_URL_3=https://your-api.onrender.com
```

`/api/[...path]` の軽量なゲートウェイが環境変数を読み、読み取りAPIが通信エラーや5xxなどで失敗した場合に次のAPIを試します。追加後は再デプロイしてください。ログインや履歴保存などの更新処理は、重複登録や二重書き込みを防ぐため先頭APIに固定し、自動再送しません。各APIは同じ認証データを参照するよう設定してください。

マイページの「APIの接続方法」で **自動 / 直接接続 / サーバー経由** を選べます。自動では直接取得が失敗するとサーバー経由へ切り替え、10分間記憶します。手動の直接接続では自動切り替えしません。

直接接続にはAPI側のCORS許可と、そのAPIのホストで有効な認証Cookieが必要です。ブラウザーの第三者Cookie制限やSameSite制約で401になる場合も、自動モードならサーバー経由に切り替わります。認証を弱めて直接接続を強制することはしません。ログイン・履歴保存などは常に同一サイト経由で行います。ゲートウェイが公開する接続設定にはAPIのOriginだけを含み、環境変数全体や秘密鍵は返しません。

APIはCloudflare Workersに加え、Vercel / RenderのNode.jsにも対応しています。Node版の認証は同じD1へのREST接続、またはCloudflare APIを認証元にする設定が必要です。詳細はAPIリポジトリを参照してください。

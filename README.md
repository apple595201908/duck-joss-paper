# 鴨鴨燒紙錢

> 中元普渡限定的手機連點網頁遊戲：幫鴨鴨把金紙投入金爐，越快越有效率，但貪快會讓金爐發爐。

[立即線上遊玩](https://duck-joss-paper.yoyo50582.chatgpt.site) · [GitHub Repository](https://github.com/apple595201908/duck-joss-paper) · [MIT License](./LICENSE)

![鴨鴨燒紙錢社群預覽](./public/og.png)

## 專案定位

《鴨鴨燒紙錢》是《鴨鴨喝牛奶》的獨立中元普渡限定版。兩款遊戲共享同一套經過測試的「連點、累積危險、停手散熱」核心節奏，但程式專案、Git 儲存庫、網站、名稱、文案、音效語意與全部主要美術資產均各自獨立。

本專案不會覆寫或取代原版；原版仍可獨立開發、部署與遊玩。

## 遊戲特色

- 手機優先：直式與橫式皆會使用完整可視區域，不把遊戲限制在正方形卡片中。
- 純連點操作：每次點擊只投入一份金紙，長按不會持續投紙。
- 風險與速度博弈：越密集連點，投入效率越高，但金爐熱度也上升得更快。
- 以畫面判斷：正式遊戲不顯示底部熱度或速度進度條，玩家需觀察火焰、色彩與「發爐警告」。
- 高手與新手有明顯秒數差：一般節奏約 20 秒，保守玩法約 30–40 秒，高手可在約 15–17 秒完成。
- 完整發爐演出：到達危險上限時，先播放鴨鴨與金爐發爐反應，再顯示失敗結果。
- 本機最佳紀錄：瀏覽器會保存最佳完成秒數與靜音設定。
- 離線式核心玩法：遊戲執行不依賴外部 API、資料庫或帳號登入。

## 遊玩方式

### 手機與平板

1. 開啟遊戲。
2. 點擊「開始遊戲」，等待 `READY!` 與 `GO!`。
3. 快速連點遊戲畫面，把金紙投入金爐。
4. 觀察金爐火勢與左側發爐警告；火勢過強時短暫停手。
5. 在金爐發爐前把金紙燒完，即可留下完成秒數。

### 電腦

- 滑鼠：連點遊戲畫面。
- 鍵盤：反覆按下空白鍵；按住空白鍵不會自動連續輸入。
- 暫停：使用右上角暫停按鈕。
- 聲音：使用右上角喇叭按鈕切換靜音。

## 勝負條件

| 結果 | 條件 |
| --- | --- |
| 成功 | 金紙進度到達 `capacity` |
| 發爐失敗 | 熱度到達 `riskLimit`，並播完發爐反應 |
| 逾時失敗 | 經過 60 秒仍未燒完金紙 |

若同一次點擊同時燒完最後一份金紙並超過熱度上限，完成金紙優先，玩家判定成功。

## 核心玩法設計

### 為什麼不能只狂點

每次點擊同時產生兩個結果：

1. 增加金紙燃燒進度。
2. 增加金爐熱度。

快速節奏會提高每次投紙的效率，但熱度代價上升得更快。玩家若完全不停手，通常會在一半進度前發爐；若過度保守，雖然安全，完成時間會明顯拉長。

### 速度分級

遊戲每 40 個模擬 frame 統計一次點擊數：

| 40 frame 內的點擊數 | 目標速度等級 |
| --- | --- |
| 0–2 | 0，慢速 |
| 3 | 1，中速 |
| 4 次以上 | 2，快速 |

升速會立即逐級提升；降速則需持續 20 frame，避免玩家手感因單一漏點而劇烈跳動。

### 每次投紙量

```text
投紙量 = 5.5 + 速度等級 × 0.6 + 危險區效率獎勵
```

危險區效率獎勵會在熱度 35% 之後開始增加，80% 時達到最大值 `0.8`。這讓熟練玩家可貼近警戒區換取更快成績，但承擔更高的發爐風險。

### 每次點擊的熱度

```text
新增熱度 = 2.9 + 速度等級 × 1.15
點擊後熱度 =（原熱度 + 新增熱度）× 1.031
```

熱度不是線性累積。越接近危險區，連續貪點的代價越大，因此玩家需要主動停手。

### 自然散熱

```text
每 frame 散熱量 = 0.10 + 0.58 ×（熱度比例 ^ 1.05）
```

高熱時散熱較快，讓玩家可以採用「推到警戒、短暫停手、重新投入」的循環，而不是只能一路放慢。

### 平衡目標

| 玩家策略 | 預期結果 |
| --- | --- |
| 無腦高頻狂點 | 在金紙未燒到一半前發爐 |
| 一般穩定節奏 | 約 19–22 秒成功 |
| 保守慢速節奏 | 約 30–40 秒安全成功 |
| 熟練高風險控制 | 約 15–17 秒成功 |

自動化測試要求高手與保守玩家的完成時間差至少 18 秒，確保成績能反映節奏判斷，而不只是每場都落在相近秒數。

## 完整參數

主要參數位於 [`src/game/config.ts`](./src/game/config.ts)。

| 參數 | 值 | 用途 |
| --- | ---: | --- |
| `fixedHz` | `60` | 固定模擬更新率 |
| `timeLimitMs` | `60000` | 單局上限 60 秒 |
| `capacity` | `590` | 燒完全部金紙所需進度 |
| `rateWindowFrames` | `40` | 點擊速度統計視窗 |
| `slowClickThreshold` | `2` | 慢速門檻 |
| `fastClickThreshold` | `4` | 快速門檻 |
| `downshiftDelayFrames` | `20` | 降速延遲 |
| `tapPaperBase` | `5.5` | 每次投紙基礎進度 |
| `tapPaperSpeedBonus` | `0.6` | 每一速度等級的額外進度 |
| `riskPaperMaxBonus` | `0.8` | 高風險區的最大效率獎勵 |
| `riskPaperBonusStartRatio` | `0.35` | 風險獎勵開始點 |
| `riskPaperBonusFullRatio` | `0.80` | 完整風險獎勵點 |
| `tapRiskBase` | `2.9` | 每次點擊基礎熱度 |
| `tapRiskSpeedBonus` | `1.15` | 每一速度等級的額外熱度 |
| `riskGrowth` | `0.031` | 點擊後的熱度複利增幅 |
| `riskReliefIdleBase` | `0.10` | 每 frame 基礎散熱 |
| `riskReliefIdleBonus` | `0.58` | 高熱區額外散熱 |
| `riskReliefCurvePower` | `1.05` | 散熱曲線指數 |
| `riskLimit` | `100` | 發爐上限 |
| `warningRatio` | `0.35` | 警告視覺開始點 |
| `criticalRatio` | `0.75` | 危急視覺開始點 |
| `tapThrowAnimationFrames` | `14` | 每次點擊延續投紙姿勢的 frame 數 |
| `FLARE_REACTION_FRAMES` | `54` | 發爐反應演出長度 |

## 狀態流程

```text
title
  └─ start → ready
                └─ READY / GO → playing
                                      ├─ 金紙燒完 → clear
                                      ├─ 熱度達上限 → flaring → fail
                                      └─ 60 秒到 → fail

clear / fail
  └─ retry → ready
```

`flaring` 是獨立場景，不會立即跳出失敗結果。進入該場景後，正式成績停止、輸入停用，先完整播放發爐效果，再轉入 `fail`。

## 美術設計

本限定版的主要視覺重新製作為台灣中元普渡夜間場景：

- 台灣廟埕、紅燈籠、供桌與普渡供品。
- 穿著紅金節慶背心的可愛黃鴨。
- 紅金金爐的平靜、升溫、危急與發爐四種狀態。
- 飛行金紙、火星、熱浪、紅色警戒閃光與大型「快發爐了！」提示。
- 社群分享圖與金爐主題 favicon。

主要點陣美術為本專案專用資產，不沿用原版牛奶場景：

| 檔案 | 用途 |
| --- | --- |
| `public/assets/ghost-festival-background.png` | 中元普渡廟埕背景 |
| `public/assets/joss-duck-poses.png` | 3×2 鴨鴨動作圖集 |
| `public/assets/joss-furnace-states.png` | 2×2 金爐狀態圖集 |
| `public/og.png` | 社群分享預覽圖 |
| `public/favicon.svg` | 網站圖示 |

圖集裁切資料分別存放於：

- `src/assets/joss-duck-poses.json`
- `src/assets/joss-furnace-states.json`

### 鴨鴨圖集

整張圖為 `1536 × 1024`，每格 `512 × 512`：

| Frame | 動作 |
| --- | --- |
| `ready` | 準備投紙 |
| `throw` | 一般投紙 |
| `fastThrow` | 快速連投 |
| `nearFlare` | 接近發爐 |
| `flare` | 發爐反應 |
| `success` | 成功完成 |

### 金爐圖集

整張圖為 `1254 × 1254`，每格 `627 × 627`：

| Frame | 火勢 |
| --- | --- |
| `calm` | 平靜 |
| `warm` | 升溫 |
| `danger` | 危急 |
| `flare` | 發爐 |

## 畫面與裝置適配

遊戲採固定 `400 × 300` 邏輯畫布，透過 CSS 與 renderer 等比例映射到實際螢幕。這能保持物理、點擊區域與美術構圖一致，同時支援：

- iPhone / Android 直式全版面。
- 手機橫式與瀏海安全區。
- 平板與桌面瀏覽器。
- `100dvh` 動態視窗高度。
- `env(safe-area-inset-*)` 安全區。
- 高 DPI Canvas 輸出。
- 旋轉、失焦與分頁切換時自動取消輸入或暫停。

## 技術架構

| 類別 | 技術 |
| --- | --- |
| UI | React 19、Next.js 16 App Router |
| 建置與開發 | Vinext、Vite 8 |
| 遊戲畫面 | Canvas 2D |
| 程式語言 | TypeScript 5.9 |
| 測試 | Vitest 4 |
| 程式碼檢查 | ESLint 9 |
| 部署 | OpenAI Sites / Cloudflare Workers 相容輸出 |

### 為什麼玩法邏輯與畫面分離

`simulation.ts` 是純狀態轉換；它不直接操作 Canvas、DOM、音效或 `localStorage`。因此節奏參數可在 Vitest 中以固定 frame 重播並驗證，不受實際裝置更新率影響。

React 容器負責輸入、音效、儲存與主迴圈，renderer 只根據當前 state 繪圖。這種分工可降低美術換版時破壞核心平衡的風險。

## 專案結構

```text
duck-joss-paper/
├─ .openai/
│  └─ hosting.json                 # Sites 專案綁定
├─ app/
│  ├─ globals.css                  # 全螢幕版面與 UI 主題
│  ├─ layout.tsx                   # SEO、OG 與網站 metadata
│  └─ page.tsx                     # 首頁入口
├─ public/
│  ├─ assets/
│  │  ├─ ghost-festival-background.png
│  │  ├─ joss-duck-poses.png
│  │  └─ joss-furnace-states.png
│  ├─ favicon.svg
│  └─ og.png
├─ skills/
│  └─ maintain-duck-joss-paper/    # 專案維護 Skill
├─ src/
│  ├─ assets/                      # Sprite metadata
│  ├─ game/
│  │  ├─ audio.ts                  # 合成音效與背景音樂
│  │  ├─ config.ts                 # 平衡參數
│  │  ├─ input.ts                  # Pointer / keyboard 輸入
│  │  ├─ metrics.ts                # 顯示值與公式
│  │  ├─ model.ts                  # 狀態與事件型別
│  │  ├─ renderer.ts               # Canvas 2D 繪製
│  │  ├─ scenes.ts                 # 場景文案與時間格式
│  │  └─ simulation.ts             # 固定步長遊戲模擬
│  └─ ui/
│     └─ DuckJossPaperGame.tsx     # React 遊戲容器
├─ tests/
│  └─ simulation.test.ts           # 玩法與平衡測試
├─ LICENSE
├─ package.json
├─ vite.config.ts
└─ vitest.config.ts
```

## 本機開發

### 環境需求

- Node.js `22.13.0` 或更新版本。
- npm。
- 支援 Canvas、Pointer Events、Web Audio 與 `localStorage` 的現代瀏覽器。

### 安裝與啟動

```bash
git clone https://github.com/apple595201908/duck-joss-paper.git
cd duck-joss-paper
npm ci
npm run dev
```

預設開發網址：<http://localhost:3000/>

### 常用指令

| 指令 | 用途 |
| --- | --- |
| `npm run dev` | 啟動本機開發伺服器 |
| `npm test` | 執行 20 項模擬與平衡測試 |
| `npm run typecheck` | TypeScript 型別檢查 |
| `npm run lint` | ESLint 靜態檢查 |
| `npm run build` | 建立正式部署輸出 |
| `npm run start` | 啟動正式輸出伺服器 |

## 測試策略

`tests/simulation.test.ts` 驗證以下行為：

- 60 秒無輸入會逾時。
- 一次 press 只投入一次金紙，release 不追加進度。
- 金紙完成後計時凍結且只保留更好的紀錄。
- 40-frame 點擊視窗能正確切換三種速度等級。
- 快速節奏同時增加效率與熱度成本。
- 高危險區會提供有限的技巧獎勵。
- 高熱度比低熱度散得更快。
- 快速連點能延續連貫投紙姿勢。
- 發爐反應一定先於失敗視窗。
- 同一點擊完成與發爐時，完成優先。
- 暫停不會偷跑計時。
- 無腦狂點會在一半進度前發爐。
- 一般、保守與高手節奏落在指定時間區間。
- 高手與新手完成時間有至少 18 秒差距。
- 金紙剩餘百分比永遠維持在 0–100。

修改任何平衡參數後，至少執行：

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## 調整玩法平衡

所有主要數值集中在 `src/game/config.ts`。建議一次只修改一組目的相近的參數，再執行完整測試。

| 目標 | 優先調整 |
| --- | --- |
| 整體更快完成 | 降低 `capacity` 或提高 `tapPaperBase` |
| 拉大高手優勢 | 微調 `tapPaperSpeedBonus`、`riskPaperMaxBonus` |
| 懲罰無腦狂點 | 提高 `tapRiskSpeedBonus` 或 `riskGrowth` |
| 給玩家更多停手機會 | 提高 `riskReliefIdleBonus` |
| 延後警告畫面 | 提高 `warningRatio`、`criticalRatio`，不改真實熱度 |
| 延長發爐演出 | 提高 `FLARE_REACTION_FRAMES` |

請避免只依靠手感判斷。每次調整後都應同步更新測試的目標區間，並記錄為何改變。

## 音效

音效由 Web Audio API 即時合成，不需額外下載音檔：

- READY / GO 提示音。
- 金紙飛行與摩擦感短音效。
- 遊戲背景節奏。
- 成功與發爐結果音效。

首次使用者手勢前，瀏覽器可能禁止音訊；點擊開始後會自動解鎖 AudioContext。靜音狀態會寫入 `localStorage`。

## 本機資料

本遊戲不蒐集個人資料，也不設後端帳號。以下資料只保存在玩家自己的瀏覽器：

| Key | 內容 |
| --- | --- |
| `duck-joss-paper-best-ms` | 最佳完成毫秒數 |
| `duck-joss-paper-muted` | 靜音設定 |

清除網站資料即可重設紀錄。

## 可及性

- Canvas 可取得鍵盤焦點。
- 空白鍵提供與連點等價的桌面操作。
- 主要按鈕與圖示按鈕具有可讀的 `aria-label`。
- 場景狀態透過 `aria-live` 傳達。
- 色彩警告同時搭配火焰、動作與文字，不只依賴單一顏色。
- 暫停、靜音與重試皆使用原生按鈕元素。

## SEO 與社群分享

`app/layout.tsx` 已設定：

- 繁體中文網站標題與描述。
- `zh_TW` Open Graph locale。
- 正式網址 metadata base。
- 大型社群分享圖 `public/og.png`。
- Twitter / X summary large image。

若正式網域改變，請同步更新 `metadataBase`、README 遊戲連結與部署文件。

## 部署

正式版本部署於 OpenAI Sites，專案 ID 記錄在 `.openai/hosting.json`。部署流程會：

1. 執行測試、型別檢查、lint 與 build。
2. 封裝靜態資產及 Worker 輸出。
3. 建立版本並部署為公開網站。
4. 使用固定網址提供遊玩。

正式網址：<https://duck-joss-paper.yoyo50582.chatgpt.site>

## 專案維護 Skill

[`skills/maintain-duck-joss-paper/SKILL.md`](./skills/maintain-duck-joss-paper/SKILL.md) 定義未來維護此專案時應遵守的工作流程與不可破壞的遊戲規則，包括：

- 保持與原版專案完全分離。
- 區分純美術修改與玩法數值修改。
- 維持連點而非長按的輸入模型。
- 保持發爐演出先於失敗視窗。
- 以測試驗證一般、新手與高手的秒數落差。
- 先完成本機品質檢查，再推送與部署。

## 文化與內容說明

本作以台灣中元普渡常見的廟埕、供桌、燈籠、金紙與金爐為視覺靈感，採可愛、節慶、遊戲化的虛構表現。遊戲不提供宗教儀式指引；現實中焚燒紙錢應遵守所在地法規、場地規範與消防安全要求。

## 貢獻方式

1. Fork 此儲存庫。
2. 建立功能分支。
3. 完成程式碼與測試。
4. 執行完整品質檢查。
5. 提交清楚描述問題、修改內容與驗證方式的 Pull Request。

建議 commit 使用明確的祈使語氣，例如：

```text
Tune high-risk cooldown curve
Improve furnace flare animation
Add landscape safe-area coverage
```

## 授權

本專案採用 [MIT License](./LICENSE)。你可以在保留著作權與授權聲明的前提下使用、修改、合併、發布、散布、再授權或販售本軟體。

美術資產與程式碼一併收錄於本儲存庫；若將素材移植到其他作品，仍需遵守 MIT 授權中的聲明保留要求。

## 相關連結

- 線上遊戲：<https://duck-joss-paper.yoyo50582.chatgpt.site>
- GitHub：<https://github.com/apple595201908/duck-joss-paper>
- 原版《鴨鴨喝牛奶》：<https://duck-milk-rhythm.yoyo50582.chatgpt.site>

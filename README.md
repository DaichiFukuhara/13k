# js13kGames 2026 — Unicorns and Rainbows

AIDE の思考フローを用いて設計を行っている。

## 提出する1本

**シードから技構成だけを生成した未知の敵を観察し、移動・ジャンプ・ローリング・パリィを
使い分けて崩す、1画面固定の2Dボスアクション。**

| | |
| --- | --- |
| **設計の正本** | [`design/tree/`](design/tree/index.md)（AIDE 設計ツリー）。全体を掴むなら [`design/SUMMARY.md`](design/SUMMARY.md) |
| **仕様書** | [`design/spec/`](design/spec/README.md)（判断を抜いた設計書。生成・戦闘・提示・画面・器の5冊） |
| **実装の土台** | [`prismatic-duel/`](prismatic-duel/)（2026-09-04 決定・コードと build 環境のみ） |
| **締切** | 2026-09-13 20:00 JST / ZIP 13,312 bytes 以下 |

> **土台にしたのはコードと build 環境であって、`prismatic-duel` のゲーム設計ではない。**
> 設計は `design/tree/` が正本であり、合わない実装は捨てる。

## 採用されていないもの

**下記は提出しない。**削除せず、経緯と素材として残している
（2026-09-04・根の決定 `root@2026-09-04-decision-7` 本文 6.1）。
各ファイルの冒頭にも同じ注記がある。

| 系統 | ファイル |
| --- | --- |
| **Virginight**（別企画） | `game.js` / `index.html` / `style.css` / [`VIRGINIGHT_DESIGN.md`](VIRGINIGHT_DESIGN.md) / [`NIGHT_TACTICS_DESIGN.md`](NIGHT_TACTICS_DESIGN.md) / [`NIGHT_TD_DESIGN.md`](NIGHT_TD_DESIGN.md)（二重に破棄） |
| **企画案**（決定ではない） | [`SOULS_ACTION_DESIGN.md`](SOULS_ACTION_DESIGN.md) / [`GAME_PLAN.md`](GAME_PLAN.md) |
| **プロトタイプ** | `proto/`（`action.html` / `tactics.html` / `rainbow.html`） |

[`JS13KGAMES_GUIDE.md`](JS13KGAMES_GUIDE.md) は企画ではなく**大会ルールの要約**なので、
この表には含まない（有効）。

> 🧭 受け入れ条件「**一意**」（このリポジトリを初めて読む人間が、提出する1本がどれかを
> 迷わず言える）は、**この節を読んで候補が2つ以上挙がらないこと**で判定する。

# design/ — AIDE 設計ツリー

このゲームを AIDE の設計ハーネスで作り直すためのツリー。

| パス | 中身 |
| --- | --- |
| `harness/` | 規約と役割。AIDE リポジトリからの複製（`harness/PROVENANCE.md` に出所） |
| `tree/` | このゲームの設計ツリー。ディレクトリがそのまま木、ノードは `index.md` 1枚 |

## 現在地

```
tree/
  index.md          深さ0 根    children-created  ← 決定・分割とも承認済み
    duel/index.md   深さ1 課題  draft             ← 次はここ
    read/index.md   深さ1 課題  draft             ← 次はここ
    ship/index.md   深さ1 課題  draft             ← 次はここ
```

| ノード | 課題 | 割り当てられた受け入れ条件 |
| --- | --- | --- |
| `duel` | 生成された敵と1人のプレイヤーが噛み合わず、回避不能な攻撃が出る | 学習（主）、初見（前提） |
| `read` | 何が・いつ・どこへ来るかが伝わらず、学習ではなく反射になる | テーマ、初見（主）、学習（前提） |
| `ship` | 13,312 bytes と締切に収まらず、提出する1本が一意に決まらない | 提出可能、一意、期限 |

seam は5本。`s1.attack-payload`（duel→read）、`s2.read-floor`（read→duel・逆向き）、
`s3.size-claim`・`s5.cut-refusal`（duel/read→ship）、`s4.size-verdict`（ship→duel/read・失効経路）。
定義は `tree/index.md` の分割提案 `split-1` にある。

## 子ノードの進め方

**1チャット = 1ノード。子は cold start で開く。**会話の続きではなく、ファイルだけで始める。

```
design/harness/README.md に従って design/tree/duel を進めてください。
閉包（自ノードと祖先チェーンの index.md）を先に読んでください。
```

`duel` の部分を `read` / `ship` に替えれば、そのまま各ノードの入口になる。
**兄弟の index.md は読まない。**兄弟との接続は各ノードの `uses_seams` と、
親の `split-1` にすべて書かれている。

これで始められないなら、原因はチャットではなく**ツリーに書かれていない情報**にある。

## 未処理

- **`split-1` は前検査を経ていない。**`precheck.md` は提案者と別実装の AI（現運用では Codex）を
  要求する。後から検査して重大が出た場合、`review.md` §3 により分割の再承認が要り、
  子3つの決定承認も失効する
- 根の 7 に未解決4件（完成範囲の仮置き / 初見テストの被験者 / 既存2実装の畳み方 /
  操作キャラ1人が「とりあえず」であること）

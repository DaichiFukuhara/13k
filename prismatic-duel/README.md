# Prismatic Duel

既存の Virginight を変更せずに並存する、制約付き生成ボスとの2Dアクション実装です。

## 起動

このディレクトリをHTTPサーバーで配信し、`index.html`を開きます。

```powershell
python -m http.server 4173 --directory prismatic-duel
```

同じ敵を再現する場合は、`?seed=`へ36進数のシードを渡します。

```text
http://localhost:4173/?seed=TEST01
```

## 操作

| 操作 | キー |
| --- | --- |
| 移動 | A/D または左右キー |
| ジャンプ | W、↑ または Space |
| 攻撃 | J または Z |
| パリィ | K または X |
| ローリング | L または C |
| 交代 | S または下キー |
| ポーズ | Escape |

## 検証と提出ビルド

```powershell
node prismatic-duel/test.mjs
node prismatic-duel/steal.test.mjs
node prismatic-duel/submit.mjs
```

`test.mjs`は10,000シード×3段階、合計30,000体のボスを生成し、再現性と危険度制約を検査します。
`steal.test.mjs`は奪取した技の変換規則と、全6形状を連続3回撃てることを検査します。

## 提出手順

`dist/`は`.gitignore`されているので、**提出物はリポジトリに残りません。**
残るのはソースだけで、**ZIPはコミットから再生成します。**

```powershell
node prismatic-duel/submit.mjs
```

これがビルドを2回まわし、次の5点を検査します。

1. 同じソースから**同じZIP**が出る（SHA-256の一致）
2. ZIPの中身が**最上位の`index.html` 1件だけ**
3. 展開した中身がビルド出力と**1バイトも違わない**
4. HTMLに**外部参照が0件**
5. **13,312 bytes以下**

通ると`dist/SUBMISSION.txt`を書き出します。ZIPのバイト数とSHA-256、提出したコミット、
ソースのURLが1枚に載ります。**提出後に「どれを出したか」を言い当てられるのはこの1枚だけです。**

大会へ出すのは次の2つです（設計 `design/tree/read/frame/shell` の 1.4.1）。

| 出すもの | 実体 |
| --- | --- |
| 遊べるZIP | `dist/prismatic-duel.zip` |
| 読めるソース | このリポジトリを、提出したコミットで指す |

git の状態（未コミット・未push）は印として出るだけで、合否には含めません。
**提出の直前に印が揃っていることを見てください。**

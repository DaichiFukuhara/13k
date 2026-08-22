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
| ジャンプ | W または Space |
| 攻撃 | J または Z |
| パリィ | K または X |
| ローリング | L または C |
| 交代 | S または下キー |
| ポーズ | Escape |

## 検証と提出ビルド

```powershell
node prismatic-duel/test.mjs
node prismatic-duel/build.mjs
```

`test.mjs`は10,000シード×3段階、合計30,000体のボスを生成し、再現性と危険度制約を検査します。

提出候補は`dist/prismatic-duel.zip`です。ZIPにはインライン化済みの`index.html`だけが入ります。

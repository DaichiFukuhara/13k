# Prismatic Duel

既存の Virginight を変更せずに並存する、制約付き生成ボスとの2Dアクション実装です。

主人公は四足のユニコーン。敵の技を1つだけ角へ写し、3体の守護者を倒して虹を取り戻します。
横薙ぎで距離を作り、突きで短い隙へ差し込み、叩きつけで体勢を崩すなど、6形状で立ち回りが変わります。

3体撃破後はそのままエンドレスの「PRISM ASCENT」へ進めます。敵のHP・体勢は1体ごとに上がり、
技生成の危険度は安全制約を保ったまま4段階まで上昇します。以後も3体ごとに変異ボスと記録画面が入り、
最高撃破数はブラウザへ保存されます。

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
| ポーズ | Escape（試用中も可） |
| 撃破後の技選択 | A/D または左右キー |
| 選択した技を試す | J または Z |
| 試用から技選択へ戻る | R |
| 技を確定して次へ | Enter |

パリィは横薙ぎ・突き・叩きつけ・突進に対応し、射撃は反射できます。落下攻撃（RAIN）は回避してください。
対応技は発生直前の9Fに予告の枠が白くなります。K/Xの受付は押してから4〜9F。
近接パリィは連撃を止め、体勢を8削って42Fの反撃時間を作ります。体勢0なら110Fの大きな隙になります。

## 検証と提出ビルド

音は`soundcheck.html`で比較できます。形状別の命中、反撃、パリィ、体勢崩し、撃破/獲得の旋律を実ゲームの処理で再生します。
戦闘BGMはランのシードから短調系の16音ループを生成します。同じシードは同じ旋律になり、3体の進行に合わせて低音・主旋律・応答音を重ねます。
「4つの戦闘音を続けて聴く」は比較用WAVも生成します。このページ・スクリプト・音声は提出ZIPには入りません。

```powershell
node prismatic-duel/test.mjs
node prismatic-duel/steal.test.mjs
node prismatic-duel/experience.test.mjs
node prismatic-duel/parry.test.mjs
node prismatic-duel/telegraph.test.mjs
node prismatic-duel/roles.test.mjs
node prismatic-duel/opportunities.test.mjs
node prismatic-duel/audio.test.mjs
node prismatic-duel/submit.mjs
```

`test.mjs`は10,000シード×3段階、合計30,000体のボスを生成し、再現性と危険度制約を検査します。
`steal.test.mjs`は奪取した技の変換規則と、全6形状を連続3回撃てることを検査します。
`experience.test.mjs`は実入力と戦闘更新を通して、試用の隔離・選び直し・最終結果・ポーズ復帰・反撃と被弾理由を検査します。
`parry.test.mjs`は近接4形状×左右×持続×連撃×硬直の96条件、受付境界、反撃窓/体勢崩しの維持、入力からの成功と反撃、回避、射撃反射を検査します。
`telegraph.test.mjs`は82件の時間・方向の条件で、予告と当たり判定の対応、RAINの後段と段間、試用中の表示、描画が状態を変更しないことを検査します。
`roles.test.mjs`は13件の技比較・多段効果の上限・角と胴体の判定・試用・虹進行・描画の回帰検査です。
`opportunities.test.mjs`は遠い隙・長い隙・先置きの比較と、バリアの開閉・反撃の音と停止・18条件の空振り消費/硬直を検査します。9月10日の調整は[検証記録](../design/PLAYTEST_2026-09-10.md)を参照してください。
`audio.test.mjs`は実イベントからの音、2/3/4音の予約、シードBGMの再現性と3段階の編成、空振り/試用時の獲得音なし、音声APIなしでの進行を検査します。
`node prismatic-duel/roles.sim.mjs 20`で、初期技と6形状×3段階×20シードの自動操作サンプルを再現できます。人の勝率や全シードの攻略保証を表すものではありません。

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

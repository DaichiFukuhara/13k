# Virginight

js13kGames 2026のテーマ「Unicorns and Rainbows」に向けて制作中の、探索とタワーディフェンスを組み合わせたブラウザゲームです。

## 現在の状態

現在はMVPとして、次の一周をプレイできます。

- 町または敵の城を探索する
- 素材と仲間を獲得する
- 武器を制作する
- 仲間を配置する
- 約30秒の防衛戦を行う
- 勝利後に翌日へ進む、または敗北後に同じ日をやり直す

今後の仕様は[`VIRGINIGHT_DESIGN.md`](VIRGINIGHT_DESIGN.md)にまとめています。

## 起動方法

`index.html`をブラウザで開くか、このディレクトリでローカルサーバーを起動してください。

```powershell
python -m http.server 4173
```

その後、`http://localhost:4173/`を開きます。

## ファイル

- `index.html`: エントリーポイント
- `style.css`: UIとドット絵風の表示
- `game.js`: ゲーム処理とCanvas描画
- `VIRGINIGHT_DESIGN.md`: 今後の基本設計
- `GAME_PLAN.md`: 初期企画と開発計画
- `dist/unicorns-and-rainbows-mvp.zip`: 動作確認済みMVPのZIP

## 容量

現在のMVP ZIPは7,807 bytesです。大会上限の13,312 bytes以内に収まっています。

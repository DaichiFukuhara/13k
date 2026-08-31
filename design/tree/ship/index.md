---
id: ship
parent: root
depth: 1
children: []
status: draft          # draft / questions-done / decision-approved
                       # / split-proposed / split-prechecked / split-approved
                       # / children-created / done
seams: []              # 子同士の接続。子がいなければ空
uses_seams: [s3.size-claim, s5.cut-refusal]
---

# ship（課題: 決めたものが 13,312 bytes と締切に収まらず、提出する1本が一意に決まらない）

<!-- 深さ1。このチャットで決めるのは「課題の範囲と、その課題に対する解決法」。
     まだ何も決まっていない（status: draft）。roles/interview.md の固定質問7つから始める。

     このノードは cold start で開くこと。渡す文言:

       design/harness/README.md に従って design/tree/ship を進めてください。
       閉包（自ノードと祖先チェーンの index.md）を先に読んでください。

     兄弟（duel / read）の index.md は読まない。兄弟との接続は下の uses_seams と、
     親（design/tree/index.md）の分割提案 split-1 の seam 節にすべて書かれている。 -->

## 親からの振り分け

<!-- 親（root）が split-1 の承認時に転記した。子は書き換えない。
     間違っていると判断したら、自分で直さず boundary_request で root へ返す。

     注記: 項目が README の6項目より多い（「提供する seam」を足している）。
     これは AIDE 本体側で既に root へ boundary_request が起票されている
     既知の差分（precedents.md 2026-08-31「bootstrap 例外が終了した」）。
     受信側しか列挙しない uses_seams だけでは、送り手に失効が届かないため。 -->

- 責任: 決めたものを 13,312 bytes の1本へ収め、提出する対象が一意に決まる状態にする
- 詳細化の対象: 5-A（大会ルール5件）の運用、6（提出は1本だけ）、
  7-3（既存2実装の畳み方）、7-5（AIDE 初回適用が期限に間に合わない場合の打ち切り判断）
- 継承する制約: 根の不変条件12件すべて。**不変条件を落とす指示を出してはならない**
  （`s5.cut-refusal` がその拒否経路）。形状定義を書き換えられないこと。
  容量 0.5〜0.7KB（自身の取り分。配分の裁定権とは別）
- 割り当てられた受け入れ条件: 提出可能、一意、期限
- uses_seams: `s3.size-claim`（duel と read から: 各自の容量見積もりと、削れる順に並べた機能リスト）、
  `s5.cut-refusal`（duel と read から: 指示が不変条件を壊す場合の拒否と代案）
- 提供する seam: `s4.size-verdict`（duel と read の各々へ）
- parent_decision_ref: `root@2026-08-31-decision-1`（本文1〜7）
  ＋ `root@2026-08-31-split-1`（分割・振り分け・親に残すもの・共通語彙・容量の暫定配分）

## 1. これは何を決めるものか

<!-- 深さ1: 課題の範囲と、それに対する解決法 -->

## 2. なぜ要るのか

## 3. 誰が使い、誰が影響を受けるか

## 4. 終わったとどうやって分かるか（受け入れ条件）

<!-- 親から割り当てられた条件を、このノードで検査可能な形にする。
     親条件の写しにしない。判定者と照合基準を書く。
     ここが空のまま決定承認または split へ進んではいけない -->

- [ ]

## 5. 変えてはいけない前提

<!-- 上の「継承する制約」がここへ降りてくる。継承したものは出所を書く -->

## 6. 決めないこと・任せること

<!-- 親の 6（決めないこと）のうち、自分の担当ぶんをここで具体化する。
     ここが空だと実装者が止まり続ける -->

## 7. 分からないこと・仮置きしていること

## 分割提案

<!-- 決定承認後に roles/split.md の形式で追記する。深さ1の子は深さ2（解決法）。
     前検査は提案者と別実装の AI が行う -->

## boundary_requests

<!-- 子孫からの境界変更の起票。追記のみ -->

## seam_inbox

<!-- 子同士の seam 成果物はここへ追記され、親が権威化して宛先の子へ降ろす -->

## 承認証跡

<!-- 未承認。決定の承認が入ったら ship@<日付>-decision-1 として記録する -->

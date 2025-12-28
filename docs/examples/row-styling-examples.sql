-- ======================================
-- 行スタイリング機能のサンプルSQL
-- ======================================

-- 例1: 文字列値に基づく行スタイリング（国名でフィルタ）
/**
 * @row 国名=="フランス":color=#ff0000,bg=#ffeeee
 * @row 国名=="日本":color=#0000ff,bg=#eeeeff
 * @row 国名=="アメリカ":color=#00aa00,bg=#eeffee
 * @column 売上 align=right format=number comma=true
 */
SELECT 国名, 都市, 売上, 担当者
FROM sales_data
ORDER BY 国名;

-- 例2: 数値に基づく行スタイリング（売上が1,000,000超えたら緑色）
/**
 * @row 売上>1000000:bg=#ccffcc,bold=true
 * @row 売上<0:bg=#ffcccc,color=#ff0000
 * @column 売上 align=right format=number comma=true
 * @column 前年比 align=right format=number decimal=1
 */
SELECT 店舗名, 売上, 前年比, 地域
FROM store_performance
ORDER BY 売上 DESC;

-- 例3: ステータスに基づく行スタイリング
/**
 * @row ステータス=="完了":bg=#d4edda,color=#155724
 * @row ステータス=="保留":bg=#fff3cd,color=#856404
 * @row ステータス=="キャンセル":bg=#f8d7da,color=#721c24
 * @column 金額 align=right format=number comma=true
 * @column 作成日時 format=datetime pattern=yyyy/MM/dd_HH:mm
 */
SELECT 注文ID, ステータス, 金額, 顧客名, 作成日時
FROM orders
ORDER BY 作成日時 DESC;

-- 例4: 在庫数に基づく行スタイリング（複数条件）
/**
 * @row 在庫数<=0:bg=#ff6b6b,color=#ffffff,bold=true
 * @row 在庫数<=10:bg=#ffd93d,color=#000000
 * @row 在庫数>100:bg=#6bcf7f,color=#ffffff
 * @column 在庫数 align=right
 * @column 単価 align=right format=number comma=true
 */
SELECT 商品名, カテゴリ, 在庫数, 単価, 倉庫
FROM inventory
ORDER BY 在庫数 ASC;

-- 例5: 行スタイルと列スタイルの組み合わせ
/**
 * @row 達成率>=100:bg=#e8f5e9
 * @row 達成率<80:bg=#ffebee
 * @column 売上 type=int align=right format=number comma=true if<0:color=red
 * @column 達成率 type=float align=right format=number decimal=1 if<80:color=red if>=100:color=green,bold=true
 * @column 更新日時 format=datetime pattern=yyyy/MM/dd
 */
SELECT 店舗名, 売上, 達成率, 前年比, 更新日時
FROM performance_dashboard
ORDER BY 達成率 DESC;

-- 例6: 評価ランクに基づく行スタイリング
/**
 * @row 評価=="A":bg=#4caf50,color=#ffffff,bold=true
 * @row 評価=="B":bg=#8bc34a,color=#ffffff
 * @row 評価=="C":bg=#ffeb3b,color=#000000
 * @row 評価=="D":bg=#ff9800,color=#ffffff
 * @row 評価=="F":bg=#f44336,color=#ffffff,bold=true
 * @column スコア align=right
 */
SELECT 学生名, 科目, スコア, 評価, 学年
FROM student_grades
ORDER BY スコア DESC;

-- 例7: 優先度に基づく行スタイリング
/**
 * @row 優先度=="高":bg=#ff5252,color=#ffffff,bold=true
 * @row 優先度=="中":bg=#ffa726,color=#ffffff
 * @row 優先度=="低":bg=#42a5f5,color=#ffffff
 * @column 期限 format=datetime pattern=yyyy/MM/dd
 */
SELECT タスク名, 優先度, 担当者, 期限, ステータス
FROM task_list
ORDER BY 期限 ASC;

-- 例8: 損益に基づく行スタイリング（ネガティブ値に注目）
/**
 * @row 損益<0:bg=#ffcdd2,color=#c62828,bold=true
 * @row 損益>=0:bg=#c8e6c9,color=#2e7d32
 * @column 収益 align=right format=number comma=true
 * @column 費用 align=right format=number comma=true
 * @column 損益 align=right format=number comma=true
 */
SELECT 部署, 収益, 費用, 損益, 四半期
FROM financial_summary
ORDER BY 損益 ASC;

-- 例9: 文字列比較演算子の使用例
/**
 * @row 顧客ランク>="Gold":bg=#ffd700,color=#000000,bold=true
 * @row 顧客ランク=="Silver":bg=#c0c0c0,color=#000000
 * @column 購入額 align=right format=number comma=true
 */
SELECT 顧客名, 顧客ランク, 購入額, 登録日
FROM customers
ORDER BY 顧客ランク DESC;

-- 例10: 複数の行ルールの組み合わせ（優先度順）
/**
 * @row 緊急フラグ=="はい":bg=#d32f2f,color=#ffffff,bold=true
 * @row 進捗率>=100:bg=#388e3c,color=#ffffff
 * @row 進捗率<30:bg=#f57c00,color=#ffffff
 * @column 進捗率 align=right
 * @column 開始日 format=datetime pattern=yyyy/MM/dd
 * @column 完了予定 format=datetime pattern=yyyy/MM/dd
 */
SELECT プロジェクト名, 進捗率, 緊急フラグ, 開始日, 完了予定
FROM projects
ORDER BY 緊急フラグ DESC, 進捗率 ASC;


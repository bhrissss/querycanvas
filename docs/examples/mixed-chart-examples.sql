-- ==========================================
-- 混合チャート（棒グラフ + 線グラフ）のサンプルSQL
-- ==========================================

-- 例1: 売上（棒グラフ）+ 目標（線グラフ）
/**
 * @chart type=mixed x=月 y=売上:bar,目標:line title="売上実績と目標"
 * @column 売上 type=int align=right format=number comma=true color="#36A2EB"
 * @column 目標 type=int align=right format=number comma=true color="#FF6384"
 */
SELECT 
  DATE_FORMAT(order_date, '%Y-%m') AS '月',
  SUM(amount) AS '売上',
  10000000 AS '目標'
FROM sales
WHERE order_date >= '2025-01-01'
GROUP BY DATE_FORMAT(order_date, '%Y-%m')
ORDER BY 月;


-- 例2: 売上（棒グラフ）+ 達成率（線グラフ）
/**
 * @chart type=mixed x=月 y=売上:bar,達成率:line title="月次売上と達成率"
 * @column 売上 type=int align=right format=number comma=true color="#4BC0C0"
 * @column 達成率 type=float align=right format=number decimal=1 color="#FF9F40"
 */
SELECT 
  DATE_FORMAT(order_date, '%Y-%m') AS '月',
  SUM(amount) AS '売上',
  (SUM(amount) / 10000000 * 100) AS '達成率'
FROM sales
WHERE order_date >= '2025-01-01'
GROUP BY DATE_FORMAT(order_date, '%Y-%m')
ORDER BY 月;


-- 例3: 注文数（棒グラフ）+ 平均単価（線グラフ）
/**
 * @chart type=mixed x=日付 y=注文数:bar,平均単価:line title="日次注文数と平均単価"
 * @column 注文数 type=int align=right format=number comma=true color="#9966FF"
 * @column 平均単価 type=int align=right format=number comma=true color="#FFCE56"
 */
SELECT 
  DATE_FORMAT(order_date, '%Y/%m/%d') AS '日付',
  COUNT(*) AS '注文数',
  AVG(amount) AS '平均単価'
FROM orders
WHERE order_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY order_date
ORDER BY order_date;


-- 例4: 店舗別売上（棒グラフ）+ トレンドライン（線グラフ）
/**
 * @chart type=mixed x=店舗 y=今月:bar,先月:bar,トレンド:line title="店舗別売上比較"
 * @column 今月 type=int align=right format=number comma=true color="#36A2EB"
 * @column 先月 type=int align=right format=number comma=true color="#C9CBCF"
 * @column トレンド type=int align=right format=number comma=true color="#FF6384"
 */
SELECT 
  shop_name AS '店舗',
  SUM(CASE WHEN DATE_FORMAT(order_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m') THEN amount ELSE 0 END) AS '今月',
  SUM(CASE WHEN DATE_FORMAT(order_date, '%Y-%m') = DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m') THEN amount ELSE 0 END) AS '先月',
  AVG(amount) AS 'トレンド'
FROM sales
GROUP BY shop_name
ORDER BY 今月 DESC;


-- 例5: カテゴリ別売上（積み上げ棒グラフ）+ 合計（線グラフ）
/**
 * @chart type=mixed x=月 y=商品A:bar,商品B:bar,合計:line title="商品別売上推移" stacked=true
 * @column 商品A type=int align=right format=number comma=true color="#FF6384"
 * @column 商品B type=int align=right format=number comma=true color="#36A2EB"
 * @column 合計 type=int align=right format=number comma=true color="#4BC0C0"
 */
SELECT 
  DATE_FORMAT(order_date, '%Y-%m') AS '月',
  SUM(CASE WHEN product = 'A' THEN amount ELSE 0 END) AS '商品A',
  SUM(CASE WHEN product = 'B' THEN amount ELSE 0 END) AS '商品B',
  SUM(amount) AS '合計'
FROM sales
WHERE order_date >= '2025-01-01'
GROUP BY DATE_FORMAT(order_date, '%Y-%m')
ORDER BY 月;


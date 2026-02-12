-- ============================================================
-- L3 種子資料：製程/作業類型
-- 基於 ISIC Rev.4 + SEOBAIKE 自定義擴充
-- 四國代碼對齊：TSIC / NAICS / NACE / JSIC
-- ============================================================

INSERT INTO l3_processes (l2_id, code, name_zh, name_en, tsic_code, naics_code, nace_code, jsic_code) VALUES
-- === L1-01 農林漁牧業 ===
-- L2-0101 農作物栽培業
((SELECT id FROM l2_subcategories WHERE code='L2-0101'), 'L3-010101', '糧食作物栽培',     'Cereal Crop Cultivation',      '01.1', '1111', '01.1', 'A011'),
((SELECT id FROM l2_subcategories WHERE code='L2-0101'), 'L3-010102', '蔬果栽培',         'Vegetable & Fruit Cultivation','01.2', '1112', '01.2', 'A012'),
((SELECT id FROM l2_subcategories WHERE code='L2-0101'), 'L3-010103', '特用作物栽培',     'Industrial Crop Cultivation',  '01.3', '1119', '01.3', 'A013'),
-- L2-0102 畜牧業
((SELECT id FROM l2_subcategories WHERE code='L2-0102'), 'L3-010201', '家禽飼養',         'Poultry Farming',              '01.47','1123', '01.47','A014'),
((SELECT id FROM l2_subcategories WHERE code='L2-0102'), 'L3-010202', '家畜飼養',         'Livestock Farming',            '01.4', '1121', '01.4', 'A014'),
((SELECT id FROM l2_subcategories WHERE code='L2-0102'), 'L3-010203', '乳品生產',         'Dairy Production',             '01.41','1124', '01.41','A014'),
-- L2-0103 林業
((SELECT id FROM l2_subcategories WHERE code='L2-0103'), 'L3-010301', '造林及育林',       'Silviculture & Reforestation', '02.1', '1131', '02.1', 'A021'),
((SELECT id FROM l2_subcategories WHERE code='L2-0103'), 'L3-010302', '伐木及林產採集',   'Logging & Forest Products',    '02.2', '1133', '02.2', 'A022'),
-- L2-0104 漁業及水產養殖業
((SELECT id FROM l2_subcategories WHERE code='L2-0104'), 'L3-010401', '海洋漁撈',         'Marine Fishing',               '03.1', '1141', '03.1', 'B031'),
((SELECT id FROM l2_subcategories WHERE code='L2-0104'), 'L3-010402', '水產養殖',         'Aquaculture',                  '03.2', '1125', '03.2', 'B032'),

-- === L1-02 礦業及土石採取業 ===
((SELECT id FROM l2_subcategories WHERE code='L2-0201'), 'L3-020101', '原油開採',         'Crude Oil Extraction',         '06.1', '2111', '06.1', 'C051'),
((SELECT id FROM l2_subcategories WHERE code='L2-0201'), 'L3-020102', '天然氣開採',       'Natural Gas Extraction',       '06.2', '2111', '06.2', 'C052'),
((SELECT id FROM l2_subcategories WHERE code='L2-0202'), 'L3-020201', '鐵礦開採',         'Iron Ore Mining',              '07.1', '2121', '07.1', 'C053'),
((SELECT id FROM l2_subcategories WHERE code='L2-0202'), 'L3-020202', '有色金屬礦開採',   'Non-ferrous Metal Mining',     '07.2', '2122', '07.2', 'C054'),
((SELECT id FROM l2_subcategories WHERE code='L2-0203'), 'L3-020301', '石及砂石採取',     'Stone & Sand Quarrying',       '08.1', '2123', '08.1', 'C055'),
((SELECT id FROM l2_subcategories WHERE code='L2-0203'), 'L3-020302', '化學礦及肥料礦開採','Chemical & Fertilizer Mining', '08.9', '2122', '08.9', 'C056'),
((SELECT id FROM l2_subcategories WHERE code='L2-0204'), 'L3-020401', '鑽探服務',         'Drilling Services',            '09.1', '2131', '09.1', 'C059'),
((SELECT id FROM l2_subcategories WHERE code='L2-0204'), 'L3-020402', '礦場工程服務',     'Mine Engineering Services',    '09.9', '2132', '09.9', 'C059'),

-- === L1-03 製造業 ===
((SELECT id FROM l2_subcategories WHERE code='L2-0301'), 'L3-030101', '食品加工',         'Food Processing',              '10',   '3111', '10',   'E091'),
((SELECT id FROM l2_subcategories WHERE code='L2-0301'), 'L3-030102', '飲料製造',         'Beverage Manufacturing',       '11',   '3121', '11',   'E101'),
((SELECT id FROM l2_subcategories WHERE code='L2-0301'), 'L3-030103', '菸草製造',         'Tobacco Manufacturing',        '12',   '3122', '12',   'E102'),
((SELECT id FROM l2_subcategories WHERE code='L2-0302'), 'L3-030201', '紡紗及織布',       'Spinning & Weaving',           '13',   '3131', '13',   'E111'),
((SELECT id FROM l2_subcategories WHERE code='L2-0302'), 'L3-030202', '成衣製造',         'Garment Manufacturing',        '14',   '3152', '14',   'E112'),
((SELECT id FROM l2_subcategories WHERE code='L2-0302'), 'L3-030203', '皮革及鞋類製造',   'Leather & Footwear Manufacturing','15','3161', '15',   'E121'),
((SELECT id FROM l2_subcategories WHERE code='L2-0303'), 'L3-030301', '石油煉製',         'Petroleum Refining',           '19',   '3241', '19',   'E171'),
((SELECT id FROM l2_subcategories WHERE code='L2-0303'), 'L3-030302', '基本化學品製造',   'Basic Chemical Manufacturing', '20.1', '3251', '20.1', 'E161'),
((SELECT id FROM l2_subcategories WHERE code='L2-0303'), 'L3-030303', '藥品製造',         'Pharmaceutical Manufacturing', '21',   '3254', '21',   'E165'),
((SELECT id FROM l2_subcategories WHERE code='L2-0304'), 'L3-030401', '基本金屬冶煉',     'Primary Metal Smelting',       '24',   '3311', '24',   'E221'),
((SELECT id FROM l2_subcategories WHERE code='L2-0304'), 'L3-030402', '金屬製品製造',     'Fabricated Metal Products',    '25',   '3321', '25',   'E241'),
((SELECT id FROM l2_subcategories WHERE code='L2-0304'), 'L3-030403', '機械設備製造',     'Machinery & Equipment Manufacturing','28','3331','28',   'E251'),
((SELECT id FROM l2_subcategories WHERE code='L2-0305'), 'L3-030501', '半導體製造',       'Semiconductor Manufacturing',  '26.1', '3344', '26.1', 'E281'),
((SELECT id FROM l2_subcategories WHERE code='L2-0305'), 'L3-030502', '電子零組件製造',   'Electronic Components Manufacturing','26.2','3344','26.2','E282'),
((SELECT id FROM l2_subcategories WHERE code='L2-0305'), 'L3-030503', '光學及精密儀器製造','Optical & Precision Instruments','26.7','3345','26.7','E275'),
((SELECT id FROM l2_subcategories WHERE code='L2-0306'), 'L3-030601', '汽車製造',         'Motor Vehicle Manufacturing',  '29.1', '3361', '29.1', 'E311'),
((SELECT id FROM l2_subcategories WHERE code='L2-0306'), 'L3-030602', '汽車零組件製造',   'Auto Parts Manufacturing',     '29.3', '3363', '29.3', 'E312'),
((SELECT id FROM l2_subcategories WHERE code='L2-0306'), 'L3-030603', '船舶及航空器製造', 'Ship & Aircraft Manufacturing','30',   '3366', '30',   'E313'),

-- === L1-04 電力及燃氣供應業 ===
((SELECT id FROM l2_subcategories WHERE code='L2-0401'), 'L3-040101', '火力發電',         'Thermal Power Generation',     '35.11','22111','35.11','F331'),
((SELECT id FROM l2_subcategories WHERE code='L2-0401'), 'L3-040102', '核能發電',         'Nuclear Power Generation',     '35.11','22111','35.11','F332'),
((SELECT id FROM l2_subcategories WHERE code='L2-0401'), 'L3-040103', '輸配電',           'Power Transmission & Distribution','35.13','22112','35.13','F333'),
((SELECT id FROM l2_subcategories WHERE code='L2-0402'), 'L3-040201', '天然氣配送',       'Natural Gas Distribution',     '35.22','22121','35.22','F341'),
((SELECT id FROM l2_subcategories WHERE code='L2-0402'), 'L3-040202', '液化石油氣供應',   'LPG Supply',                   '35.23','22121','35.23','F342'),
((SELECT id FROM l2_subcategories WHERE code='L2-0403'), 'L3-040301', '蒸汽供應',         'Steam Supply',                 '35.30','22133','35.30','F351'),
((SELECT id FROM l2_subcategories WHERE code='L2-0403'), 'L3-040302', '冷暖空調供應',     'HVAC Supply',                  '35.30','22133','35.30','F352'),

-- === L1-05 用水供應及污染整治業 ===
((SELECT id FROM l2_subcategories WHERE code='L2-0501'), 'L3-050101', '自來水處理及供應', 'Water Treatment & Supply',     '36.0', '22131','36.0', 'F361'),
((SELECT id FROM l2_subcategories WHERE code='L2-0501'), 'L3-050102', '水資源管理',       'Water Resource Management',    '36.0', '22131','36.0', 'F362'),
((SELECT id FROM l2_subcategories WHERE code='L2-0502'), 'L3-050201', '生活污水處理',     'Domestic Wastewater Treatment','37.0', '22132','37.0', 'E881'),
((SELECT id FROM l2_subcategories WHERE code='L2-0502'), 'L3-050202', '工業廢水處理',     'Industrial Wastewater Treatment','37.0','22132','37.0','E882'),
((SELECT id FROM l2_subcategories WHERE code='L2-0503'), 'L3-050301', '一般廢棄物清理',   'General Waste Collection',     '38.1', '56211','38.1', 'E883'),
((SELECT id FROM l2_subcategories WHERE code='L2-0503'), 'L3-050302', '有害廢棄物處理',   'Hazardous Waste Treatment',    '38.2', '56221','38.2', 'E884'),
((SELECT id FROM l2_subcategories WHERE code='L2-0504'), 'L3-050401', '土壤及地下水整治', 'Soil & Groundwater Remediation','39.0','56291','39.0', 'E891'),
((SELECT id FROM l2_subcategories WHERE code='L2-0504'), 'L3-050402', '環境監測及檢測',   'Environmental Monitoring & Testing','39.0','56291','39.0','E892'),

-- === L1-06 營建工程業 ===
((SELECT id FROM l2_subcategories WHERE code='L2-0601'), 'L3-060101', '住宅建築',         'Residential Building',         '41.1', '2361', '41.1', 'D061'),
((SELECT id FROM l2_subcategories WHERE code='L2-0601'), 'L3-060102', '商業建築',         'Commercial Building',          '41.2', '2362', '41.2', 'D062'),
((SELECT id FROM l2_subcategories WHERE code='L2-0601'), 'L3-060103', '工業建築',         'Industrial Building',          '41.2', '2362', '41.2', 'D063'),
((SELECT id FROM l2_subcategories WHERE code='L2-0602'), 'L3-060201', '道路及橋梁工程',   'Road & Bridge Engineering',    '42.1', '2371', '42.1', 'D064'),
((SELECT id FROM l2_subcategories WHERE code='L2-0602'), 'L3-060202', '水利工程',         'Hydraulic Engineering',        '42.2', '2373', '42.2', 'D065'),
((SELECT id FROM l2_subcategories WHERE code='L2-0602'), 'L3-060203', '管線工程',         'Pipeline Engineering',         '42.2', '2371', '42.2', 'D066'),
((SELECT id FROM l2_subcategories WHERE code='L2-0603'), 'L3-060301', '水電及管線安裝',   'Plumbing & Electrical Installation','43.2','2382','43.2','D081'),
((SELECT id FROM l2_subcategories WHERE code='L2-0603'), 'L3-060302', '裝潢及室內裝修',   'Interior Finishing',           '43.3', '2383', '43.3', 'D082'),
((SELECT id FROM l2_subcategories WHERE code='L2-0603'), 'L3-060303', '拆除及整地',       'Demolition & Site Preparation','43.1', '2381', '43.1', 'D083'),

-- === L1-07 批發及零售業 ===
((SELECT id FROM l2_subcategories WHERE code='L2-0701'), 'L3-070101', '農產原料批發',     'Agricultural Raw Material Wholesale','46.2','4245','46.2','I501'),
((SELECT id FROM l2_subcategories WHERE code='L2-0701'), 'L3-070102', '工業用品批發',     'Industrial Goods Wholesale',   '46.6', '4234', '46.6', 'I531'),
((SELECT id FROM l2_subcategories WHERE code='L2-0701'), 'L3-070103', '消費品批發',       'Consumer Goods Wholesale',     '46.4', '4244', '46.4', 'I511'),
((SELECT id FROM l2_subcategories WHERE code='L2-0702'), 'L3-070201', '綜合商品零售',     'General Merchandise Retail',   '47.1', '4521', '47.1', 'I561'),
((SELECT id FROM l2_subcategories WHERE code='L2-0702'), 'L3-070202', '食品及日用品零售', 'Food & Daily Goods Retail',    '47.2', '4451', '47.2', 'I571'),
((SELECT id FROM l2_subcategories WHERE code='L2-0702'), 'L3-070203', '專賣店零售',       'Specialty Retail',             '47.7', '4481', '47.7', 'I581'),
((SELECT id FROM l2_subcategories WHERE code='L2-0703'), 'L3-070301', '汽車銷售',         'Motor Vehicle Sales',          '45.1', '4411', '45.1', 'I591'),
((SELECT id FROM l2_subcategories WHERE code='L2-0703'), 'L3-070302', '汽機車維修',       'Motor Vehicle Repair',         '45.2', '8111', '45.2', 'I592'),
((SELECT id FROM l2_subcategories WHERE code='L2-0704'), 'L3-070401', 'B2C 網路零售',     'B2C Online Retail',            '47.91','45411','47.91','I571'),
((SELECT id FROM l2_subcategories WHERE code='L2-0704'), 'L3-070402', 'B2B 電子商務',     'B2B E-commerce',               '47.91','45411','47.91','I531'),
((SELECT id FROM l2_subcategories WHERE code='L2-0704'), 'L3-070403', '跨境電商',         'Cross-border E-commerce',      '47.91','45411','47.91','I571'),

-- === L1-08 運輸及倉儲業 ===
((SELECT id FROM l2_subcategories WHERE code='L2-0801'), 'L3-080101', '公路客運',         'Road Passenger Transport',     '49.3', '4851', '49.3', 'H421'),
((SELECT id FROM l2_subcategories WHERE code='L2-0801'), 'L3-080102', '公路貨運',         'Road Freight Transport',       '49.4', '4841', '49.4', 'H441'),
((SELECT id FROM l2_subcategories WHERE code='L2-0801'), 'L3-080103', '鐵路運輸',         'Railway Transport',            '49.1', '4821', '49.1', 'H421'),
((SELECT id FROM l2_subcategories WHERE code='L2-0802'), 'L3-080201', '遠洋運輸',         'Ocean Transport',              '50.1', '4831', '50.1', 'H451'),
((SELECT id FROM l2_subcategories WHERE code='L2-0802'), 'L3-080202', '內河及近海運輸',   'Inland & Coastal Transport',   '50.3', '4831', '50.3', 'H452'),
((SELECT id FROM l2_subcategories WHERE code='L2-0803'), 'L3-080301', '航空客運',         'Air Passenger Transport',      '51.1', '4811', '51.1', 'H461'),
((SELECT id FROM l2_subcategories WHERE code='L2-0803'), 'L3-080302', '航空貨運',         'Air Freight Transport',        '51.2', '4812', '51.2', 'H462'),
((SELECT id FROM l2_subcategories WHERE code='L2-0804'), 'L3-080401', '倉儲服務',         'Warehousing Services',         '52.1', '4931', '52.1', 'H471'),
((SELECT id FROM l2_subcategories WHERE code='L2-0804'), 'L3-080402', '貨運承攬及報關',   'Freight Forwarding & Customs Brokerage','52.2','4885','52.2','H472'),
((SELECT id FROM l2_subcategories WHERE code='L2-0804'), 'L3-080403', '港埠及機場營運',   'Port & Airport Operations',    '52.2', '4881', '52.2', 'H473'),
((SELECT id FROM l2_subcategories WHERE code='L2-0805'), 'L3-080501', '郵政服務',         'Postal Services',              '53.1', '4911', '53.1', 'H491'),
((SELECT id FROM l2_subcategories WHERE code='L2-0805'), 'L3-080502', '快遞及宅配服務',   'Express & Delivery Services',  '53.2', '4921', '53.2', 'H492'),

-- === L1-09 住宿及餐飲業 ===
((SELECT id FROM l2_subcategories WHERE code='L2-0901'), 'L3-090101', '觀光旅館',         'Tourist Hotels',               '55.1', '7211', '55.1', 'M751'),
((SELECT id FROM l2_subcategories WHERE code='L2-0901'), 'L3-090102', '一般旅館及民宿',   'General Hotels & B&B',         '55.2', '7211', '55.2', 'M752'),
((SELECT id FROM l2_subcategories WHERE code='L2-0902'), 'L3-090201', '餐廳及小吃店',     'Restaurants & Eateries',       '56.1', '7221', '56.1', 'M761'),
((SELECT id FROM l2_subcategories WHERE code='L2-0902'), 'L3-090202', '飲料店',           'Beverage Shops',               '56.3', '7224', '56.3', 'M762'),
((SELECT id FROM l2_subcategories WHERE code='L2-0902'), 'L3-090203', '餐飲外送服務',     'Food Delivery Services',       '56.1', '7225', '56.1', 'M763'),
((SELECT id FROM l2_subcategories WHERE code='L2-0903'), 'L3-090301', '團膳供應',         'Institutional Catering',       '56.29','72232','56.29','M771'),
((SELECT id FROM l2_subcategories WHERE code='L2-0903'), 'L3-090302', '外燴辦席服務',     'Event Catering',               '56.21','72232','56.21','M772'),

-- === L1-10 出版影音及資通訊業 ===
((SELECT id FROM l2_subcategories WHERE code='L2-1001'), 'L3-100101', '書籍及雜誌出版',   'Book & Magazine Publishing',   '58.1', '5111', '58.1', 'G411'),
((SELECT id FROM l2_subcategories WHERE code='L2-1001'), 'L3-100102', '數位出版',         'Digital Publishing',           '58.2', '5112', '58.2', 'G412'),
((SELECT id FROM l2_subcategories WHERE code='L2-1002'), 'L3-100201', '電影製作及發行',   'Film Production & Distribution','59.1','5121', '59.1', 'G411'),
((SELECT id FROM l2_subcategories WHERE code='L2-1002'), 'L3-100202', '音樂製作及發行',   'Music Production & Distribution','59.2','5122','59.2', 'G412'),
((SELECT id FROM l2_subcategories WHERE code='L2-1003'), 'L3-100301', '廣播節目製播',     'Radio Broadcasting',           '60.1', '5151', '60.1', 'G381'),
((SELECT id FROM l2_subcategories WHERE code='L2-1003'), 'L3-100302', '電視節目製播',     'Television Broadcasting',      '60.2', '5152', '60.2', 'G382'),
((SELECT id FROM l2_subcategories WHERE code='L2-1003'), 'L3-100303', '串流影音平台',     'Streaming Media Platforms',    '60.2', '5191', '60.2', 'G383'),
((SELECT id FROM l2_subcategories WHERE code='L2-1004'), 'L3-100401', '有線電信',         'Wired Telecommunications',     '61.1', '5171', '61.1', 'G371'),
((SELECT id FROM l2_subcategories WHERE code='L2-1004'), 'L3-100402', '無線電信',         'Wireless Telecommunications',  '61.2', '5172', '61.2', 'G372'),
((SELECT id FROM l2_subcategories WHERE code='L2-1004'), 'L3-100403', '衛星通訊',         'Satellite Communications',     '61.3', '5174', '61.3', 'G373'),
((SELECT id FROM l2_subcategories WHERE code='L2-1005'), 'L3-100501', '軟體開發及設計',   'Software Development & Design','62.0', '5112', '62.0', 'G391'),
((SELECT id FROM l2_subcategories WHERE code='L2-1005'), 'L3-100502', '系統整合服務',     'System Integration Services',  '62.0', '5415', '62.0', 'G392'),
((SELECT id FROM l2_subcategories WHERE code='L2-1005'), 'L3-100503', '資訊安全服務',     'Cybersecurity Services',       '63.1', '5182', '63.1', 'G393'),

-- === L1-11 金融及保險業 ===
((SELECT id FROM l2_subcategories WHERE code='L2-1101'), 'L3-110101', '商業銀行業務',     'Commercial Banking',           '64.1', '5221', '64.1', 'J621'),
((SELECT id FROM l2_subcategories WHERE code='L2-1101'), 'L3-110102', '信用合作及儲蓄',   'Credit Unions & Savings',      '64.1', '5222', '64.1', 'J622'),
((SELECT id FROM l2_subcategories WHERE code='L2-1101'), 'L3-110103', '投資銀行業務',     'Investment Banking',           '64.2', '5231', '64.2', 'J623'),
((SELECT id FROM l2_subcategories WHERE code='L2-1102'), 'L3-110201', '人壽保險',         'Life Insurance',               '65.1', '5241', '65.1', 'J631'),
((SELECT id FROM l2_subcategories WHERE code='L2-1102'), 'L3-110202', '產物保險',         'Property & Casualty Insurance','65.2', '5242', '65.2', 'J632'),
((SELECT id FROM l2_subcategories WHERE code='L2-1102'), 'L3-110203', '再保險',           'Reinsurance',                  '65.3', '5242', '65.3', 'J633'),
((SELECT id FROM l2_subcategories WHERE code='L2-1103'), 'L3-110301', '證券經紀及自營',   'Securities Brokerage & Dealing','66.1','5231', '66.1', 'J641'),
((SELECT id FROM l2_subcategories WHERE code='L2-1103'), 'L3-110302', '期貨及衍生性商品', 'Futures & Derivatives',        '66.1', '5231', '66.1', 'J642'),
((SELECT id FROM l2_subcategories WHERE code='L2-1103'), 'L3-110303', '基金管理',         'Fund Management',              '66.3', '5239', '66.3', 'J643'),
((SELECT id FROM l2_subcategories WHERE code='L2-1104'), 'L3-110401', '數位支付',         'Digital Payments',             '64.19','52219','64.19','J621'),
((SELECT id FROM l2_subcategories WHERE code='L2-1104'), 'L3-110402', '網路借貸及群募',   'Online Lending & Crowdfunding','64.19','52229','64.19','J622'),
((SELECT id FROM l2_subcategories WHERE code='L2-1104'), 'L3-110403', '區塊鏈及加密資產', 'Blockchain & Crypto Assets',   '64.19','52399','64.19','J629'),

-- === L1-12 不動產業 ===
((SELECT id FROM l2_subcategories WHERE code='L2-1201'), 'L3-120101', '住宅開發',         'Residential Development',      '68.1', '5311', '68.1', 'K651'),
((SELECT id FROM l2_subcategories WHERE code='L2-1201'), 'L3-120102', '商辦及工業區開發', 'Commercial & Industrial Development','68.1','5311','68.1','K652'),
((SELECT id FROM l2_subcategories WHERE code='L2-1202'), 'L3-120201', '物業管理',         'Property Management',          '68.2', '5311', '68.2', 'K681'),
((SELECT id FROM l2_subcategories WHERE code='L2-1202'), 'L3-120202', '不動產租賃',       'Real Estate Leasing',          '68.2', '5311', '68.2', 'K682'),
((SELECT id FROM l2_subcategories WHERE code='L2-1203'), 'L3-120301', '不動產買賣仲介',   'Real Estate Brokerage',        '68.3', '5312', '68.3', 'K691'),
((SELECT id FROM l2_subcategories WHERE code='L2-1203'), 'L3-120302', '不動產估價',       'Real Estate Appraisal',        '68.3', '5312', '68.3', 'K692'),

-- === L1-13 專業科學及技術服務業 ===
((SELECT id FROM l2_subcategories WHERE code='L2-1301'), 'L3-130101', '法律服務',         'Legal Services',               '69.1', '5411', '69.1', 'L721'),
((SELECT id FROM l2_subcategories WHERE code='L2-1301'), 'L3-130102', '會計及審計服務',   'Accounting & Auditing',        '69.2', '5412', '69.2', 'L722'),
((SELECT id FROM l2_subcategories WHERE code='L2-1301'), 'L3-130103', '稅務服務',         'Tax Services',                 '69.2', '5412', '69.2', 'L723'),
((SELECT id FROM l2_subcategories WHERE code='L2-1302'), 'L3-130201', '企業管理顧問',     'Business Management Consulting','70.2','5416', '70.2', 'L721'),
((SELECT id FROM l2_subcategories WHERE code='L2-1302'), 'L3-130202', '資訊技術顧問',     'IT Consulting',                '70.2', '5415', '70.2', 'L722'),
((SELECT id FROM l2_subcategories WHERE code='L2-1302'), 'L3-130203', '人力資源顧問',     'HR Consulting',                '70.2', '5416', '70.2', 'L723'),
((SELECT id FROM l2_subcategories WHERE code='L2-1303'), 'L3-130301', '建築設計',         'Architectural Design',         '71.1', '5413', '71.1', 'L741'),
((SELECT id FROM l2_subcategories WHERE code='L2-1303'), 'L3-130302', '工程技術顧問',     'Engineering Consulting',       '71.1', '5413', '71.1', 'L742'),
((SELECT id FROM l2_subcategories WHERE code='L2-1303'), 'L3-130303', '測量及檢測服務',   'Surveying & Inspection',       '71.2', '5413', '71.2', 'L743'),
((SELECT id FROM l2_subcategories WHERE code='L2-1304'), 'L3-130401', '自然科學研發',     'Natural Science R&D',          '72.1', '5417', '72.1', 'L711'),
((SELECT id FROM l2_subcategories WHERE code='L2-1304'), 'L3-130402', '工程及技術研發',   'Engineering & Technology R&D', '72.1', '5417', '72.1', 'L712'),
((SELECT id FROM l2_subcategories WHERE code='L2-1304'), 'L3-130403', '社會科學研究',     'Social Science Research',      '72.2', '5417', '72.2', 'L713'),
((SELECT id FROM l2_subcategories WHERE code='L2-1305'), 'L3-130501', '廣告服務',         'Advertising Services',         '73.1', '5418', '73.1', 'L731'),
((SELECT id FROM l2_subcategories WHERE code='L2-1305'), 'L3-130502', '市場研究及民調',   'Market Research & Polling',    '73.2', '5419', '73.2', 'L732'),
((SELECT id FROM l2_subcategories WHERE code='L2-1305'), 'L3-130503', '公關及品牌顧問',   'PR & Brand Consulting',        '73.1', '5418', '73.1', 'L733'),

-- === L1-14 支援服務業 ===
((SELECT id FROM l2_subcategories WHERE code='L2-1401'), 'L3-140101', '機械設備租賃',     'Machinery & Equipment Rental', '77.3', '5324', '77.3', 'K701'),
((SELECT id FROM l2_subcategories WHERE code='L2-1401'), 'L3-140102', '運輸工具租賃',     'Vehicle Rental',               '77.1', '5321', '77.1', 'K702'),
((SELECT id FROM l2_subcategories WHERE code='L2-1401'), 'L3-140103', '個人用品租賃',     'Personal Goods Rental',        '77.2', '5322', '77.2', 'K703'),
((SELECT id FROM l2_subcategories WHERE code='L2-1402'), 'L3-140201', '人力仲介',         'Employment Placement',         '78.1', '56131','78.1', 'R911'),
((SELECT id FROM l2_subcategories WHERE code='L2-1402'), 'L3-140202', '人力派遣',         'Temporary Staffing',           '78.2', '56132','78.2', 'R912'),
((SELECT id FROM l2_subcategories WHERE code='L2-1403'), 'L3-140301', '旅行社及訂房服務', 'Travel Agency & Reservation',  '79.1', '5615', '79.1', 'N791'),
((SELECT id FROM l2_subcategories WHERE code='L2-1403'), 'L3-140302', '導遊及領隊服務',   'Tour Guide Services',          '79.9', '5615', '79.9', 'N792'),
((SELECT id FROM l2_subcategories WHERE code='L2-1404'), 'L3-140401', '保全服務',         'Security Guard Services',      '80.1', '5616', '80.1', 'R921'),
((SELECT id FROM l2_subcategories WHERE code='L2-1404'), 'L3-140402', '電子監控服務',     'Electronic Surveillance',      '80.2', '5616', '80.2', 'R922'),
((SELECT id FROM l2_subcategories WHERE code='L2-1405'), 'L3-140501', '清潔服務',         'Cleaning Services',            '81.2', '5617', '81.2', 'R921'),
((SELECT id FROM l2_subcategories WHERE code='L2-1405'), 'L3-140502', '景觀維護',         'Landscape Maintenance',        '81.3', '5617', '81.3', 'R922'),

-- === L1-15 公共行政及國防 ===
((SELECT id FROM l2_subcategories WHERE code='L2-1501'), 'L3-150101', '一般行政管理',     'General Public Administration','84.1', '9211', '84.1', 'S971'),
((SELECT id FROM l2_subcategories WHERE code='L2-1501'), 'L3-150102', '財政及經濟行政',   'Fiscal & Economic Administration','84.1','9211','84.1','S972'),
((SELECT id FROM l2_subcategories WHERE code='L2-1502'), 'L3-150201', '軍事國防',         'Military Defence',             '84.2', '9281', '84.2', 'S973'),
((SELECT id FROM l2_subcategories WHERE code='L2-1502'), 'L3-150202', '國防採購及後勤',   'Defence Procurement & Logistics','84.2','9281','84.2', 'S974'),
((SELECT id FROM l2_subcategories WHERE code='L2-1503'), 'L3-150301', '警政及消防',       'Police & Fire Services',       '84.2', '9221', '84.2', 'S975'),
((SELECT id FROM l2_subcategories WHERE code='L2-1503'), 'L3-150302', '司法及矯正',       'Justice & Corrections',        '84.2', '9221', '84.2', 'S976'),

-- === L1-16 教育業 ===
((SELECT id FROM l2_subcategories WHERE code='L2-1601'), 'L3-160101', '幼兒園教育',       'Kindergarten Education',       '85.1', '6111', '85.1', 'O811'),
((SELECT id FROM l2_subcategories WHERE code='L2-1601'), 'L3-160102', '國小教育',         'Primary School Education',     '85.1', '6111', '85.1', 'O812'),
((SELECT id FROM l2_subcategories WHERE code='L2-1602'), 'L3-160201', '國中教育',         'Junior High Education',        '85.2', '6112', '85.2', 'O821'),
((SELECT id FROM l2_subcategories WHERE code='L2-1602'), 'L3-160202', '高中職教育',       'Senior High & Vocational Education','85.3','6112','85.3','O822'),
((SELECT id FROM l2_subcategories WHERE code='L2-1603'), 'L3-160301', '大學教育',         'University Education',         '85.4', '6113', '85.4', 'O831'),
((SELECT id FROM l2_subcategories WHERE code='L2-1603'), 'L3-160302', '研究所教育',       'Graduate Education',           '85.4', '6113', '85.4', 'O832'),
((SELECT id FROM l2_subcategories WHERE code='L2-1604'), 'L3-160401', '技職教育',         'Technical & Vocational Education','85.5','6115','85.5','O821'),
((SELECT id FROM l2_subcategories WHERE code='L2-1604'), 'L3-160402', '專業證照訓練',     'Professional Certification Training','85.5','6114','85.5','O822'),
((SELECT id FROM l2_subcategories WHERE code='L2-1605'), 'L3-160501', '線上課程平台',     'Online Course Platforms',      '85.6', '6114', '85.6', 'O824'),
((SELECT id FROM l2_subcategories WHERE code='L2-1605'), 'L3-160502', '教育軟體及工具',   'Educational Software & Tools', '85.6', '5112', '85.6', 'O825'),

-- === L1-17 醫療保健及社會工作 ===
((SELECT id FROM l2_subcategories WHERE code='L2-1701'), 'L3-170101', '綜合醫院',         'General Hospitals',            '86.1', '6221', '86.1', 'P831'),
((SELECT id FROM l2_subcategories WHERE code='L2-1701'), 'L3-170102', '專科診所',         'Specialized Clinics',          '86.2', '6211', '86.2', 'P832'),
((SELECT id FROM l2_subcategories WHERE code='L2-1702'), 'L3-170201', '牙醫服務',         'Dental Services',              '86.2', '6212', '86.2', 'P833'),
((SELECT id FROM l2_subcategories WHERE code='L2-1702'), 'L3-170202', '中醫及替代醫療',   'Traditional & Alternative Medicine','86.9','6213','86.9','P839'),
((SELECT id FROM l2_subcategories WHERE code='L2-1703'), 'L3-170301', '護理之家',         'Nursing Homes',                '87.1', '6231', '87.1', 'P851'),
((SELECT id FROM l2_subcategories WHERE code='L2-1703'), 'L3-170302', '長照機構',         'Long-term Care Facilities',    '87.3', '6233', '87.3', 'P852'),
((SELECT id FROM l2_subcategories WHERE code='L2-1704'), 'L3-170401', '兒少及家庭福利',   'Child & Family Welfare',       '88.9', '6241', '88.9', 'P861'),
((SELECT id FROM l2_subcategories WHERE code='L2-1704'), 'L3-170402', '身障及老人福利',   'Disability & Elderly Welfare', '88.1', '6243', '88.1', 'P862'),

-- === L1-18 藝術娛樂及休閒服務業 ===
((SELECT id FROM l2_subcategories WHERE code='L2-1801'), 'L3-180101', '表演藝術',         'Performing Arts',              '90.0', '7111', '90.0', 'N801'),
((SELECT id FROM l2_subcategories WHERE code='L2-1801'), 'L3-180102', '視覺藝術及工藝',   'Visual Arts & Crafts',         '90.0', '7115', '90.0', 'N802'),
((SELECT id FROM l2_subcategories WHERE code='L2-1802'), 'L3-180201', '博物館及展覽',     'Museums & Exhibitions',        '91.0', '7121', '91.0', 'N803'),
((SELECT id FROM l2_subcategories WHERE code='L2-1802'), 'L3-180202', '文化資產修復及保存','Cultural Heritage Conservation','91.0','7121','91.0', 'N804'),
((SELECT id FROM l2_subcategories WHERE code='L2-1803'), 'L3-180301', '賭場營運',         'Casino Operations',            '92.0', '7132', '92.0', 'N805'),
((SELECT id FROM l2_subcategories WHERE code='L2-1803'), 'L3-180302', '運動彩券及彩券',   'Sports Lottery & Lottery',     '92.0', '7132', '92.0', 'N806'),
((SELECT id FROM l2_subcategories WHERE code='L2-1804'), 'L3-180401', '運動場館營運',     'Sports Facility Operations',   '93.1', '7131', '93.1', 'N811'),
((SELECT id FROM l2_subcategories WHERE code='L2-1804'), 'L3-180402', '遊樂園及主題樂園', 'Amusement & Theme Parks',      '93.2', '7131', '93.2', 'N812'),
((SELECT id FROM l2_subcategories WHERE code='L2-1804'), 'L3-180403', '休閒健身服務',     'Fitness & Wellness Services',  '93.1', '7139', '93.1', 'N813'),

-- === L1-19 其他服務業 ===
((SELECT id FROM l2_subcategories WHERE code='L2-1901'), 'L3-190101', '商業及專業公會',   'Business & Professional Associations','94.1','8131','94.1','R941'),
((SELECT id FROM l2_subcategories WHERE code='L2-1901'), 'L3-190102', '社會倡議及非營利', 'Social Advocacy & Non-profit', '94.9', '8134', '94.9', 'R942'),
((SELECT id FROM l2_subcategories WHERE code='L2-1902'), 'L3-190201', '電子產品維修',     'Electronics Repair',           '95.1', '8112', '95.1', 'R901'),
((SELECT id FROM l2_subcategories WHERE code='L2-1902'), 'L3-190202', '家具及家庭用品維修','Furniture & Household Repair', '95.2', '8114', '95.2', 'R902'),
((SELECT id FROM l2_subcategories WHERE code='L2-1903'), 'L3-190301', '美髮及美容',       'Hair & Beauty Services',       '96.0', '8121', '96.0', 'N781'),
((SELECT id FROM l2_subcategories WHERE code='L2-1903'), 'L3-190302', 'SPA 及身體保養',   'SPA & Body Care',              '96.0', '8121', '96.0', 'N782'),

-- === L1-20 人工智慧及數位平台業 ===
((SELECT id FROM l2_subcategories WHERE code='L2-2001'), 'L3-200101', '大型語言模型訓練', 'LLM Training',                 '63.11','51121','63.11','G391'),
((SELECT id FROM l2_subcategories WHERE code='L2-2001'), 'L3-200102', '模型推理及部署',   'Model Inference & Deployment', '63.11','51121','63.11','G392'),
((SELECT id FROM l2_subcategories WHERE code='L2-2001'), 'L3-200103', '模型微調及客製化', 'Model Fine-tuning & Customization','63.11','51121','63.11','G393'),
((SELECT id FROM l2_subcategories WHERE code='L2-2002'), 'L3-200201', 'SaaS 平台營運',    'SaaS Platform Operations',     '63.11','51913','63.11','G401'),
((SELECT id FROM l2_subcategories WHERE code='L2-2002'), 'L3-200202', 'API 市集及服務仲介','API Marketplace & Service Brokerage','63.11','51913','63.11','G402'),
((SELECT id FROM l2_subcategories WHERE code='L2-2002'), 'L3-200203', '社群平台營運',     'Social Platform Operations',   '63.12','51913','63.12','G403'),
((SELECT id FROM l2_subcategories WHERE code='L2-2003'), 'L3-200301', '雲端基礎設施',     'Cloud Infrastructure (IaaS)',  '63.11','51821','63.11','G401'),
((SELECT id FROM l2_subcategories WHERE code='L2-2003'), 'L3-200302', '資料倉儲及分析',   'Data Warehousing & Analytics', '63.11','51821','63.11','G402'),
((SELECT id FROM l2_subcategories WHERE code='L2-2003'), 'L3-200303', '邊緣運算服務',     'Edge Computing Services',      '63.11','51821','63.11','G403'),
((SELECT id FROM l2_subcategories WHERE code='L2-2004'), 'L3-200401', '智慧客服及對話',   'AI Chatbot & Conversational AI','62.01','51121','62.01','G391'),
((SELECT id FROM l2_subcategories WHERE code='L2-2004'), 'L3-200402', '電腦視覺應用',     'Computer Vision Applications', '62.01','51121','62.01','G392'),
((SELECT id FROM l2_subcategories WHERE code='L2-2004'), 'L3-200403', 'AI SEO 及行銷自動化','AI SEO & Marketing Automation','62.01','51121','62.01','G393'),

-- === L1-21 能源轉型及永續產業 ===
((SELECT id FROM l2_subcategories WHERE code='L2-2101'), 'L3-210101', '太陽能發電',       'Solar Power Generation',       '35.11','22111','35.11','F331'),
((SELECT id FROM l2_subcategories WHERE code='L2-2101'), 'L3-210102', '風力發電',         'Wind Power Generation',        '35.11','22111','35.11','F332'),
((SELECT id FROM l2_subcategories WHERE code='L2-2101'), 'L3-210103', '水力及地熱發電',   'Hydro & Geothermal Power',     '35.11','22111','35.11','F333'),
((SELECT id FROM l2_subcategories WHERE code='L2-2102'), 'L3-210201', '電池儲能系統',     'Battery Energy Storage Systems','35.11','22111','35.11','F334'),
((SELECT id FROM l2_subcategories WHERE code='L2-2102'), 'L3-210202', '智慧電網管理',     'Smart Grid Management',        '35.13','22112','35.13','F335'),
((SELECT id FROM l2_subcategories WHERE code='L2-2103'), 'L3-210301', '碳盤查及認證',     'Carbon Auditing & Certification','39.0','56291','39.0','E891'),
((SELECT id FROM l2_subcategories WHERE code='L2-2103'), 'L3-210302', '碳權交易',         'Carbon Credit Trading',        '66.1', '52391','66.1', 'J649'),
((SELECT id FROM l2_subcategories WHERE code='L2-2104'), 'L3-210401', '資源回收及再利用', 'Resource Recovery & Reuse',     '38.3', '56292','38.3', 'E885'),
((SELECT id FROM l2_subcategories WHERE code='L2-2104'), 'L3-210402', '綠色產品設計及認證','Green Product Design & Certification','71.2','54138','71.2','L749')
ON CONFLICT (code) DO NOTHING;

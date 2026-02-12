-- ============================================================
-- L2 種子資料：次產業分類
-- 基於 ISIC Rev.4 + SEOBAIKE 自定義擴充
-- 四國代碼對齊：TSIC / NAICS / NACE / JSIC
-- ============================================================

INSERT INTO l2_subcategories (l1_id, code, name_zh, name_en, tsic_code, naics_code, nace_code, jsic_code) VALUES
-- L1-01 農林漁牧業
((SELECT id FROM l1_categories WHERE code='L1-01'), 'L2-0101', '農作物栽培業',       'Crop Production',             '01',  '111',  '01',  'A01'),
((SELECT id FROM l1_categories WHERE code='L1-01'), 'L2-0102', '畜牧業',             'Animal Production',           '01',  '112',  '01',  'A01'),
((SELECT id FROM l1_categories WHERE code='L1-01'), 'L2-0103', '林業',               'Forestry & Logging',          '02',  '113',  '02',  'A02'),
((SELECT id FROM l1_categories WHERE code='L1-01'), 'L2-0104', '漁業及水產養殖業',   'Fishing & Aquaculture',       '03',  '114',  '03',  'B03'),
-- L1-02 礦業及土石採取業
((SELECT id FROM l1_categories WHERE code='L1-02'), 'L2-0201', '石油及天然氣礦業',   'Oil & Gas Extraction',        '06',  '211',  '06',  'C05'),
((SELECT id FROM l1_categories WHERE code='L1-02'), 'L2-0202', '金屬礦業',           'Metal Ore Mining',            '07',  '212',  '07',  'C05'),
((SELECT id FROM l1_categories WHERE code='L1-02'), 'L2-0203', '非金屬礦業及土石採取','Non-metallic Mining & Quarrying','08','212',  '08',  'C05'),
((SELECT id FROM l1_categories WHERE code='L1-02'), 'L2-0204', '礦業支援服務業',     'Mining Support Activities',   '09',  '213',  '09',  'C05'),
-- L1-03 製造業
((SELECT id FROM l1_categories WHERE code='L1-03'), 'L2-0301', '食品及飲料製造業',   'Food & Beverage Manufacturing','10-11','311-312','10-11','E09'),
((SELECT id FROM l1_categories WHERE code='L1-03'), 'L2-0302', '紡織成衣及皮革製造業','Textile, Apparel & Leather Manufacturing','13-15','313-316','13-15','E11'),
((SELECT id FROM l1_categories WHERE code='L1-03'), 'L2-0303', '化學及石化製造業',   'Chemical & Petrochemical Manufacturing','19-20','324-325','19-20','E16'),
((SELECT id FROM l1_categories WHERE code='L1-03'), 'L2-0304', '金屬及機械製造業',   'Metal & Machinery Manufacturing','24-28','331-333','24-28','E24'),
((SELECT id FROM l1_categories WHERE code='L1-03'), 'L2-0305', '電子及光學製造業',   'Electronics & Optical Manufacturing','26','334',  '26',  'E28'),
((SELECT id FROM l1_categories WHERE code='L1-03'), 'L2-0306', '汽車及運輸工具製造業','Motor Vehicle & Transport Equipment','29-30','336','29-30','E31'),
-- L1-04 電力及燃氣供應業
((SELECT id FROM l1_categories WHERE code='L1-04'), 'L2-0401', '電力供應業',         'Electric Power Generation & Distribution','35.1','2211','35.1','F33'),
((SELECT id FROM l1_categories WHERE code='L1-04'), 'L2-0402', '燃氣供應業',         'Gas Supply & Distribution',   '35.2','2212','35.2','F34'),
((SELECT id FROM l1_categories WHERE code='L1-04'), 'L2-0403', '蒸汽及空調供應業',   'Steam & Air Conditioning Supply','35.3','2213','35.3','F34'),
-- L1-05 用水供應及污染整治業
((SELECT id FROM l1_categories WHERE code='L1-05'), 'L2-0501', '用水供應業',         'Water Collection & Supply',   '36',  '2213', '36',  'F35'),
((SELECT id FROM l1_categories WHERE code='L1-05'), 'L2-0502', '污水處理業',         'Sewerage & Wastewater Treatment','37','2213', '37',  'E88'),
((SELECT id FROM l1_categories WHERE code='L1-05'), 'L2-0503', '廢棄物處理業',       'Waste Collection & Treatment','38',  '5621', '38',  'E88'),
((SELECT id FROM l1_categories WHERE code='L1-05'), 'L2-0504', '環境整治及復原業',   'Remediation & Environmental Services','39','5629','39',  'E88'),
-- L1-06 營建工程業
((SELECT id FROM l1_categories WHERE code='L1-06'), 'L2-0601', '建築工程業',         'Building Construction',       '41',  '236',  '41',  'D06'),
((SELECT id FROM l1_categories WHERE code='L1-06'), 'L2-0602', '土木工程業',         'Civil Engineering',           '42',  '237',  '42',  'D06'),
((SELECT id FROM l1_categories WHERE code='L1-06'), 'L2-0603', '專門營造業',         'Specialized Construction',    '43',  '238',  '43',  'D08'),
-- L1-07 批發及零售業
((SELECT id FROM l1_categories WHERE code='L1-07'), 'L2-0701', '批發業',             'Wholesale Trade',             '46',  '42',   '46',  'I50'),
((SELECT id FROM l1_categories WHERE code='L1-07'), 'L2-0702', '零售業',             'Retail Trade',                '47',  '44-45','47',  'I56'),
((SELECT id FROM l1_categories WHERE code='L1-07'), 'L2-0703', '汽機車批發零售及維修','Motor Vehicle Trade & Repair','45',  '441',  '45',  'I59'),
((SELECT id FROM l1_categories WHERE code='L1-07'), 'L2-0704', '電子商務及網路零售業','E-commerce & Online Retail',  '47.91','4541','47.91','I57'),
-- L1-08 運輸及倉儲業
((SELECT id FROM l1_categories WHERE code='L1-08'), 'L2-0801', '陸上運輸業',         'Land Transport',              '49',  '484-485','49', 'H42'),
((SELECT id FROM l1_categories WHERE code='L1-08'), 'L2-0802', '水上運輸業',         'Water Transport',             '50',  '483',  '50',  'H45'),
((SELECT id FROM l1_categories WHERE code='L1-08'), 'L2-0803', '航空運輸業',         'Air Transport',               '51',  '481',  '51',  'H46'),
((SELECT id FROM l1_categories WHERE code='L1-08'), 'L2-0804', '倉儲及運輸輔助業',   'Warehousing & Transport Support','52','488-493','52', 'H47'),
((SELECT id FROM l1_categories WHERE code='L1-08'), 'L2-0805', '郵政及快遞業',       'Postal & Courier Activities', '53',  '491-492','53', 'H49'),
-- L1-09 住宿及餐飲業
((SELECT id FROM l1_categories WHERE code='L1-09'), 'L2-0901', '住宿服務業',         'Accommodation',               '55',  '721',  '55',  'M75'),
((SELECT id FROM l1_categories WHERE code='L1-09'), 'L2-0902', '餐飲業',             'Food & Beverage Service',     '56',  '722',  '56',  'M76'),
((SELECT id FROM l1_categories WHERE code='L1-09'), 'L2-0903', '外燴及團膳業',       'Catering & Food Contractors', '56.2','7223','56.2',  'M77'),
-- L1-10 出版影音及資通訊業
((SELECT id FROM l1_categories WHERE code='L1-10'), 'L2-1001', '出版業',             'Publishing Activities',       '58',  '511',  '58',  'G41'),
((SELECT id FROM l1_categories WHERE code='L1-10'), 'L2-1002', '影片及音樂製作業',   'Motion Picture, Video & Music Production','59','512','59','G41'),
((SELECT id FROM l1_categories WHERE code='L1-10'), 'L2-1003', '廣播及電視業',       'Broadcasting & Programming',  '60',  '515',  '60',  'G38'),
((SELECT id FROM l1_categories WHERE code='L1-10'), 'L2-1004', '電信業',             'Telecommunications',          '61',  '517',  '61',  'G37'),
((SELECT id FROM l1_categories WHERE code='L1-10'), 'L2-1005', '軟體及資訊服務業',   'Software & IT Services',      '62-63','5112-5182','62-63','G39'),
-- L1-11 金融及保險業
((SELECT id FROM l1_categories WHERE code='L1-11'), 'L2-1101', '銀行及金融中介業',   'Banking & Financial Intermediation','64','522','64','J62'),
((SELECT id FROM l1_categories WHERE code='L1-11'), 'L2-1102', '保險業',             'Insurance',                   '65',  '524',  '65',  'J63'),
((SELECT id FROM l1_categories WHERE code='L1-11'), 'L2-1103', '證券期貨及金融輔助業','Securities, Futures & Financial Support','66','523','66','J64'),
((SELECT id FROM l1_categories WHERE code='L1-11'), 'L2-1104', '金融科技服務業',     'FinTech Services',            '64.19','5221','64.19','J62'),
-- L1-12 不動產業
((SELECT id FROM l1_categories WHERE code='L1-12'), 'L2-1201', '不動產開發業',       'Real Estate Development',     '68',  '531', '68.1', 'K65'),
((SELECT id FROM l1_categories WHERE code='L1-12'), 'L2-1202', '不動產經營及管理業', 'Real Estate Management',      '68',  '531', '68.2', 'K68'),
((SELECT id FROM l1_categories WHERE code='L1-12'), 'L2-1203', '不動產仲介及代銷業', 'Real Estate Brokerage',       '68',  '5312','68.3', 'K69'),
-- L1-13 專業科學及技術服務業
((SELECT id FROM l1_categories WHERE code='L1-13'), 'L2-1301', '法律及會計服務業',   'Legal & Accounting Services', '69',  '5411', '69',  'L72'),
((SELECT id FROM l1_categories WHERE code='L1-13'), 'L2-1302', '管理顧問業',         'Management Consultancy',      '70',  '5416', '70',  'L72'),
((SELECT id FROM l1_categories WHERE code='L1-13'), 'L2-1303', '建築及工程技術服務業','Architectural & Engineering Services','71','5413','71','L74'),
((SELECT id FROM l1_categories WHERE code='L1-13'), 'L2-1304', '科學研究及發展服務業','Scientific R&D',              '72',  '5417', '72',  'L71'),
((SELECT id FROM l1_categories WHERE code='L1-13'), 'L2-1305', '廣告及市場研究業',   'Advertising & Market Research','73', '5418', '73',  'L73'),
-- L1-14 支援服務業
((SELECT id FROM l1_categories WHERE code='L1-14'), 'L2-1401', '租賃業',             'Rental & Leasing',            '77',  '532',  '77',  'K70'),
((SELECT id FROM l1_categories WHERE code='L1-14'), 'L2-1402', '人力仲介及供應業',   'Employment & HR Services',    '78',  '5613', '78',  'R91'),
((SELECT id FROM l1_categories WHERE code='L1-14'), 'L2-1403', '旅行及相關服務業',   'Travel Agency & Tour Operator','79', '5615', '79',  'N79'),
((SELECT id FROM l1_categories WHERE code='L1-14'), 'L2-1404', '保全及偵探業',       'Security & Investigation',    '80',  '5616', '80',  'R92'),
((SELECT id FROM l1_categories WHERE code='L1-14'), 'L2-1405', '建物及景觀維護業',   'Facility & Landscape Services','81', '5617', '81',  'R92'),
-- L1-15 公共行政及國防
((SELECT id FROM l1_categories WHERE code='L1-15'), 'L2-1501', '政府行政機關',       'Government Administration',   '84',  '921', '84.1', 'S97'),
((SELECT id FROM l1_categories WHERE code='L1-15'), 'L2-1502', '國防事務',           'Defence Activities',          '84',  '928', '84.2', 'S97'),
((SELECT id FROM l1_categories WHERE code='L1-15'), 'L2-1503', '社會安全及司法行政', 'Public Order, Safety & Justice','84', '922', '84.2', 'S97'),
-- L1-16 教育業
((SELECT id FROM l1_categories WHERE code='L1-16'), 'L2-1601', '學前及初等教育',     'Pre-primary & Primary Education','85.1','6111','85.1','O81'),
((SELECT id FROM l1_categories WHERE code='L1-16'), 'L2-1602', '中等教育',           'Secondary Education',         '85.2','6112','85.2', 'O82'),
((SELECT id FROM l1_categories WHERE code='L1-16'), 'L2-1603', '高等教育',           'Higher Education',            '85.4','6113','85.4', 'O82'),
((SELECT id FROM l1_categories WHERE code='L1-16'), 'L2-1604', '技職及專業訓練',     'Vocational & Professional Training','85.5','6114-6115','85.5','O82'),
((SELECT id FROM l1_categories WHERE code='L1-16'), 'L2-1605', '數位學習及教育科技', 'EdTech & Digital Learning',   '85.6','6114','85.6', 'O82'),
-- L1-17 醫療保健及社會工作
((SELECT id FROM l1_categories WHERE code='L1-17'), 'L2-1701', '醫院及診所',         'Hospital & Clinic Services',  '86',  '622',  '86',  'P83'),
((SELECT id FROM l1_categories WHERE code='L1-17'), 'L2-1702', '醫療專科服務業',     'Specialist Medical Services', '86',  '6211', '86',  'P83'),
((SELECT id FROM l1_categories WHERE code='L1-17'), 'L2-1703', '護理及照護機構',     'Nursing & Residential Care',  '87',  '623',  '87',  'P85'),
((SELECT id FROM l1_categories WHERE code='L1-17'), 'L2-1704', '社會工作服務業',     'Social Work Services',        '88',  '624',  '88',  'P85'),
-- L1-18 藝術娛樂及休閒服務業
((SELECT id FROM l1_categories WHERE code='L1-18'), 'L2-1801', '創作及藝術表演業',   'Creative Arts & Performing Arts','90','711',  '90',  'N80'),
((SELECT id FROM l1_categories WHERE code='L1-18'), 'L2-1802', '博物館及文化資產保存','Museums & Cultural Heritage', '91',  '712',  '91',  'N80'),
((SELECT id FROM l1_categories WHERE code='L1-18'), 'L2-1803', '博弈業',             'Gambling & Betting',          '92',  '7132', '92',  'N80'),
((SELECT id FROM l1_categories WHERE code='L1-18'), 'L2-1804', '運動及休閒服務業',   'Sports & Recreation',         '93',  '713',  '93',  'N80'),
-- L1-19 其他服務業
((SELECT id FROM l1_categories WHERE code='L1-19'), 'L2-1901', '公會及社會團體',     'Membership Organizations',    '94',  '813',  '94',  'R94'),
((SELECT id FROM l1_categories WHERE code='L1-19'), 'L2-1902', '個人及家庭用品維修業','Repair of Personal & Household Goods','95','811','95','R90'),
((SELECT id FROM l1_categories WHERE code='L1-19'), 'L2-1903', '美容及個人服務業',   'Personal Care & Beauty Services','96','8121', '96',  'N78'),
-- L1-20 人工智慧及數位平台業
((SELECT id FROM l1_categories WHERE code='L1-20'), 'L2-2001', 'AI 模型訓練及推理服務','AI Model Training & Inference','63.1','5112','63.1','G39'),
((SELECT id FROM l1_categories WHERE code='L1-20'), 'L2-2002', '數位平台及市集營運', 'Digital Platform & Marketplace Operations','63.1','5191','63.1','G40'),
((SELECT id FROM l1_categories WHERE code='L1-20'), 'L2-2003', '資料處理及雲端服務', 'Data Processing & Cloud Services','63.1','5182','63.1','G40'),
((SELECT id FROM l1_categories WHERE code='L1-20'), 'L2-2004', 'AI 應用及解決方案',  'AI Applications & Solutions', '62',  '5112', '62',  'G39'),
-- L1-21 能源轉型及永續產業
((SELECT id FROM l1_categories WHERE code='L1-21'), 'L2-2101', '再生能源發電',       'Renewable Energy Generation', '35.1','2211','35.1', 'F33'),
((SELECT id FROM l1_categories WHERE code='L1-21'), 'L2-2102', '儲能及智慧電網',     'Energy Storage & Smart Grid', '35.1','2211','35.1', 'F33'),
((SELECT id FROM l1_categories WHERE code='L1-21'), 'L2-2103', '碳管理及碳交易',     'Carbon Management & Trading', '39',  '5629', '39',  'E88'),
((SELECT id FROM l1_categories WHERE code='L1-21'), 'L2-2104', '循環經濟及資源回收', 'Circular Economy & Recycling','38.3','5629','38.3', 'E88')
ON CONFLICT (code) DO NOTHING;

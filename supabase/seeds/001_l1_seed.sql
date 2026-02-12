-- ============================================================
-- L1 種子資料：宏觀產業類別
-- 基於 ISIC Rev.4 + SEOBAIKE 自定義擴充
-- 四國代碼對齊：TSIC / NAICS / NACE / JSIC
-- ============================================================

INSERT INTO l1_categories (code, name_zh, name_en, tsic_code, naics_code, nace_code, jsic_code) VALUES
('L1-01', '農林漁牧業',           'Agriculture, Forestry & Fishing',               'A',  '11',    'A',  'A'),
('L1-02', '礦業及土石採取業',     'Mining & Quarrying',                             'B',  '21',    'B',  'C'),
('L1-03', '製造業',               'Manufacturing',                                  'C',  '31-33', 'C',  'E'),
('L1-04', '電力及燃氣供應業',     'Electricity, Gas & Steam Supply',                'D',  '22',    'D',  'F'),
('L1-05', '用水供應及污染整治業', 'Water Supply, Sewerage & Waste Management',      'E',  '22',    'E',  'F'),
('L1-06', '營建工程業',           'Construction',                                   'F',  '23',    'F',  'D'),
('L1-07', '批發及零售業',         'Wholesale & Retail Trade',                       'G',  '42-45', 'G',  'I'),
('L1-08', '運輸及倉儲業',         'Transportation & Storage',                       'H',  '48-49', 'H',  'H'),
('L1-09', '住宿及餐飲業',         'Accommodation & Food Service',                   'I',  '72',    'I',  'M'),
('L1-10', '出版影音及資通訊業',   'Information & Communication',                    'J',  '51',    'J',  'G'),
('L1-11', '金融及保險業',         'Financial & Insurance Activities',               'K',  '52',    'K',  'J'),
('L1-12', '不動產業',             'Real Estate Activities',                         'L',  '53',    'L',  'K'),
('L1-13', '專業科學及技術服務業', 'Professional, Scientific & Technical Services',  'M',  '54',    'M',  'L'),
('L1-14', '支援服務業',           'Administrative & Support Services',              'N',  '56',    'N',  'R'),
('L1-15', '公共行政及國防',       'Public Administration & Defence',                'O',  '92',    'O',  'S'),
('L1-16', '教育業',               'Education',                                      'P',  '61',    'P',  'O'),
('L1-17', '醫療保健及社會工作',   'Human Health & Social Work',                     'Q',  '62',    'Q',  'P'),
('L1-18', '藝術娛樂及休閒服務業', 'Arts, Entertainment & Recreation',               'R',  '71',    'R',  'N'),
('L1-19', '其他服務業',           'Other Service Activities',                       'S',  '81',    'S',  'R'),
('L1-20', '人工智慧及數位平台業', 'AI & Digital Platform Services',                 'J63','5112',  'J63','G40'),
('L1-21', '能源轉型及永續產業',   'Energy Transition & Sustainability',             'D35','2211',  'D35','F34')
ON CONFLICT (code) DO NOTHING;

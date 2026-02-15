/**
 * SEOBAIKE i18n - 國際化語言切換模組（v2 - 自動偵測版）
 * 支援：繁體中文（預設）、English、日本語、한국어
 * 語言偵測優先順序：
 *   1. localStorage 手動選擇 (seobaike_lang_manual)
 *   2. Cloudflare 國家碼 (html[data-cf-country])
 *   3. navigator.language / navigator.languages
 *   4. 預設 zh-TW
 * 小路光有限公司 (c) 2026
 */
window.SEOBAIKE_I18N = {
  current: 'zh-TW',
  supportedLangs: ['zh-TW', 'en', 'ja', 'ko'],

  translations: {
    'zh-TW': {
      'nav.home': '首頁',
      'nav.features': '功能',
      'nav.marketplace': '市集',
      'nav.pricing': '方案',
      'nav.docs': '文件',
      'nav.about': '關於',
      'nav.login': '登入',
      'hero.title.prefix': '',
      'hero.title.highlight': '一句話',
      'hero.title.suffix': '，搞定一切',
      'hero.subtitle': '不用選工具、不用懂 AI。你說，SEOBAIKE 做。',
      'hero.cta1': '開始使用',
      'hero.cta2': '了解更多',
      'demo.title': '看一次就懂',
      'demo.subtitle': '你說話，我們幫你找到最好的 AI 引擎來完成',
      'video.title': '60 秒看懂 SEOBAIKE',
      'video.subtitle': '完整產品展示，從提問到回答，全流程體驗',
      'pillars.title': '為什麼選 SEOBAIKE？',
      'pillars.subtitle': '三個理由，讓你不用再猶豫',
      'pillar.1.title': '零選擇障礙',
      'pillar.1.desc': '別人要你做一堆選擇。我們？你只要說話。',
      'pillar.2.title': '自動匹配',
      'pillar.2.desc': '1,000+ 個 AI 引擎，SEOBAIKE 自動幫你選最快、最準、最省的。',
      'pillar.3.title': '安全保護',
      'pillar.3.desc': '你的資料、你的對話，全程安全加密保護。',
      'cap.title': '能做什麼？',
      'cap.subtitle': '八大能力，一個入口。滑鼠移上去看範例。',
      'cap.chat': '對話',
      'cap.chat.desc': '跟 AI 聊天，像跟朋友一樣',
      'cap.code': '程式碼',
      'cap.code.desc': '寫程式、除錯、最佳化',
      'cap.vision': '視覺',
      'cap.vision.desc': '看圖說故事、分析圖片',
      'cap.reasoning': '推理',
      'cap.reasoning.desc': '數學、邏輯、複雜分析',
      'cap.search': '搜尋',
      'cap.search.desc': '即時搜尋最新資訊',
      'cap.embed': '嵌入',
      'cap.embed.desc': '文件分析、語意理解',
      'cap.image': '圖像',
      'cap.image.desc': 'AI 繪圖、設計',
      'cap.voice': '語音',
      'cap.voice.desc': '語音轉文字、文字轉語音',
      'pricing.title': '選擇適合你的方式',
      'pricing.subtitle': '不管你在哪個階段，我們都有適合你的方案',
      'pricing.free': '體驗版',
      'pricing.personal': '個人版',
      'pricing.pro': '專業版',
      'pricing.enterprise': '企業版',
      'pricing.recommended': '推薦',
      'pricing.more': '了解更多方案',
      'trust.title': '值得信賴',
      'trust.tw': '台灣公司',
      'trust.tw.desc': '合法立案經營',
      'trust.legal': '合法公司',
      'trust.engines': '1,000+ AI 引擎',
      'trust.engines.desc': '自動選最佳方案',
      'trust.privacy': '零第三方干擾',
      'trust.privacy.desc': '你的資料只屬於你',
      'cta.title': '讓 SEOBAIKE 幫你走對的路',
      'cta.subtitle': '不綁卡、不綁約，找到適合你的方式。',
      'cta.btn': '開始你的旅程',
      'footer.company': '小路光有限公司',
      'footer.product': '產品',
      'footer.product.features': '功能總覽',
      'footer.product.pricing': '方案與定價',
      'footer.product.docs': '使用說明',
      'footer.product.changelog': '更新日誌',
      'footer.corp': '公司',
      'footer.corp.about': '關於我們',
      'footer.corp.contact': '聯繫我們',
      'footer.corp.privacy': '隱私權政策',
      'footer.corp.terms': '服務條款',
      'footer.support': '支援',
      'footer.support.start': '快速開始',
      'footer.support.faq': '常見問題',
      'footer.support.contact': '聯繫客服',
      'footer.support.status': '服務狀態',
      // 市集翻譯鍵
      'marketplace_hero': '你的東西，賣到全世界',
      'marketplace_sell': '我要賣',
      'marketplace_buy': '我要買',
      'marketplace_list': '上架商品',
      'marketplace_countries': '賣到哪裡？',
      'global_reach': '全球零距離',
      'auto_translate': 'AI 自動翻譯',
      'seller_dashboard': '賣家後台',
      'buyer_browse': '逛市集',
      'list_success': '上架成功！'
    },
    'en': {
      'nav.home': 'Home',
      'nav.features': 'Features',
      'nav.marketplace': 'Marketplace',
      'nav.pricing': 'Pricing',
      'nav.docs': 'Docs',
      'nav.about': 'About',
      'nav.login': 'Sign In',
      'hero.title.prefix': '',
      'hero.title.highlight': 'One sentence',
      'hero.title.suffix': '. Everything done.',
      'hero.subtitle': 'No tools to choose. No AI to learn. You speak, SEOBAIKE does.',
      'hero.cta1': 'Get Started',
      'hero.cta2': 'Learn More',
      'demo.title': 'See it once, get it',
      'demo.subtitle': 'You speak, we find the best AI engine to get it done',
      'video.title': 'SEOBAIKE in 60 seconds',
      'video.subtitle': 'Full product demo, from question to answer',
      'pillars.title': 'Why SEOBAIKE?',
      'pillars.subtitle': 'Three reasons to stop hesitating',
      'pillar.1.title': 'Zero choice overload',
      'pillar.1.desc': 'Others make you choose. Us? Just speak.',
      'pillar.2.title': 'Auto-matching',
      'pillar.2.desc': '1,000+ AI engines. SEOBAIKE picks the fastest, most accurate, and most cost-effective one.',
      'pillar.3.title': 'Security first',
      'pillar.3.desc': 'Your data, your conversations, fully encrypted and protected.',
      'cap.title': 'What can it do?',
      'cap.subtitle': 'Eight capabilities, one entry point. Hover to see examples.',
      'cap.chat': 'Chat',
      'cap.chat.desc': 'Talk to AI like talking to a friend',
      'cap.code': 'Code',
      'cap.code.desc': 'Write, debug, and optimize code',
      'cap.vision': 'Vision',
      'cap.vision.desc': 'Describe and analyze images',
      'cap.reasoning': 'Reasoning',
      'cap.reasoning.desc': 'Math, logic, complex analysis',
      'cap.search': 'Search',
      'cap.search.desc': 'Real-time information search',
      'cap.embed': 'Embeddings',
      'cap.embed.desc': 'Document analysis, semantic understanding',
      'cap.image': 'Image',
      'cap.image.desc': 'AI art and design',
      'cap.voice': 'Voice',
      'cap.voice.desc': 'Speech-to-text and text-to-speech',
      'pricing.title': 'Choose your plan',
      'pricing.subtitle': 'Whatever stage you are at, we have a plan for you',
      'pricing.free': 'Free',
      'pricing.personal': 'Personal',
      'pricing.pro': 'Professional',
      'pricing.enterprise': 'Enterprise',
      'pricing.recommended': 'Recommended',
      'pricing.more': 'See all plans',
      'trust.title': 'Trusted',
      'trust.tw': 'Based in Taiwan',
      'trust.tw.desc': 'Legally registered company',
      'trust.legal': 'Legal entity',
      'trust.engines': '1,000+ AI Engines',
      'trust.engines.desc': 'Auto-selects the best option',
      'trust.privacy': 'Zero third-party access',
      'trust.privacy.desc': 'Your data belongs to you',
      'cta.title': 'Let SEOBAIKE guide you right',
      'cta.subtitle': 'No credit card. No contract. Find what works for you.',
      'cta.btn': 'Start your journey',
      'footer.company': 'Hsiao Lu Guang Co., Ltd.',
      'footer.product': 'PRODUCT',
      'footer.product.features': 'Feature Overview',
      'footer.product.pricing': 'Plans & Pricing',
      'footer.product.docs': 'Documentation',
      'footer.product.changelog': 'Changelog',
      'footer.corp': 'COMPANY',
      'footer.corp.about': 'About Us',
      'footer.corp.contact': 'Contact Us',
      'footer.corp.privacy': 'Privacy Policy',
      'footer.corp.terms': 'Terms of Service',
      'footer.support': 'SUPPORT',
      'footer.support.start': 'Quick Start',
      'footer.support.faq': 'FAQ',
      'footer.support.contact': 'Contact Support',
      'footer.support.status': 'Service Status',
      // Marketplace translation keys
      'marketplace_hero': 'Your products, sold worldwide',
      'marketplace_sell': 'Sell',
      'marketplace_buy': 'Buy',
      'marketplace_list': 'List Product',
      'marketplace_countries': 'Sell where?',
      'global_reach': 'Global Zero Distance',
      'auto_translate': 'AI Auto-Translate',
      'seller_dashboard': 'Seller Dashboard',
      'buyer_browse': 'Browse',
      'list_success': 'Listed!'
    },
    'ja': {
      'nav.home': 'ホーム',
      'nav.features': '機能',
      'nav.marketplace': 'マーケット',
      'nav.pricing': '料金',
      'nav.docs': 'ドキュメント',
      'nav.about': '会社概要',
      'nav.login': 'ログイン',
      'hero.title.prefix': '',
      'hero.title.highlight': '一言で',
      'hero.title.suffix': '、すべて完了',
      'hero.subtitle': 'ツールを選ぶ必要なし。AIを学ぶ必要なし。あなたが話し、SEOBAIKEが実行。',
      'hero.cta1': '始める',
      'hero.cta2': '詳しく見る',
      'demo.title': '一度見ればわかる',
      'demo.subtitle': 'あなたが話すと、最適なAIエンジンが対応します',
      'video.title': '60秒でわかるSEOBAIKE',
      'video.subtitle': '質問から回答まで、製品の全体験をご覧ください',
      'pillars.title': 'なぜSEOBAIKE？',
      'pillars.subtitle': '迷う必要のない3つの理由',
      'pillar.1.title': '選択の悩みゼロ',
      'pillar.1.desc': '他社は選択を強いる。私たちは？話すだけ。',
      'pillar.2.title': '自動マッチング',
      'pillar.2.desc': '1,000以上のAIエンジン。SEOBAIKEが最速・最正確・最安のものを自動選択。',
      'pillar.3.title': 'セキュリティ保護',
      'pillar.3.desc': 'あなたのデータ、会話、すべて暗号化で保護。',
      'cap.title': '何ができる？',
      'cap.subtitle': '8つの能力、1つの入口。マウスオーバーで例を表示。',
      'cap.chat': 'チャット',
      'cap.chat.desc': 'AIと友達のように会話',
      'cap.code': 'コード',
      'cap.code.desc': 'コーディング、デバッグ、最適化',
      'cap.vision': 'ビジョン',
      'cap.vision.desc': '画像の分析と説明',
      'cap.reasoning': '推論',
      'cap.reasoning.desc': '数学、ロジック、複雑な分析',
      'cap.search': '検索',
      'cap.search.desc': 'リアルタイム情報検索',
      'cap.embed': '埋め込み',
      'cap.embed.desc': '文書分析、意味理解',
      'cap.image': '画像生成',
      'cap.image.desc': 'AI描画・デザイン',
      'cap.voice': '音声',
      'cap.voice.desc': '音声テキスト変換',
      'pricing.title': 'あなたに合ったプランを',
      'pricing.subtitle': 'どのステージでも、最適なプランをご用意',
      'pricing.free': '無料プラン',
      'pricing.personal': '個人プラン',
      'pricing.pro': 'プロプラン',
      'pricing.enterprise': '企業プラン',
      'pricing.recommended': 'おすすめ',
      'pricing.more': 'すべてのプランを見る',
      'trust.title': '信頼の証',
      'trust.tw': '台湾企業',
      'trust.tw.desc': '正規登録企業',
      'trust.legal': '法人企業',
      'trust.engines': '1,000+ AIエンジン',
      'trust.engines.desc': '最適なものを自動選択',
      'trust.privacy': '第三者アクセスゼロ',
      'trust.privacy.desc': 'あなたのデータはあなたのもの',
      'cta.title': 'SEOBAIKEで正しい道を',
      'cta.subtitle': 'クレジットカード不要。契約不要。あなたに合った方法を。',
      'cta.btn': '旅を始める',
      'footer.company': '小路光有限会社',
      'footer.product': '製品',
      'footer.product.features': '機能一覧',
      'footer.product.pricing': 'プラン・料金',
      'footer.product.docs': 'ドキュメント',
      'footer.product.changelog': '更新履歴',
      'footer.corp': '会社',
      'footer.corp.about': '会社概要',
      'footer.corp.contact': 'お問い合わせ',
      'footer.corp.privacy': 'プライバシーポリシー',
      'footer.corp.terms': '利用規約',
      'footer.support': 'サポート',
      'footer.support.start': 'クイックスタート',
      'footer.support.faq': 'よくある質問',
      'footer.support.contact': 'サポート連絡',
      'footer.support.status': 'サービス状態',
      // マーケットプレイス翻訳キー
      'marketplace_hero': 'あなたの商品を世界へ',
      'marketplace_sell': '販売する',
      'marketplace_buy': '購入する',
      'marketplace_list': '出品する',
      'marketplace_countries': 'どこに売る？',
      'global_reach': '世界とゼロ距離',
      'auto_translate': 'AI自動翻訳',
      'seller_dashboard': 'セラーダッシュボード',
      'buyer_browse': 'マーケットを見る',
      'list_success': '出品完了！'
    },
    'ko': {
      'nav.home': '홈',
      'nav.features': '기능',
      'nav.marketplace': '마켓플레이스',
      'nav.pricing': '요금제',
      'nav.docs': '문서',
      'nav.about': '소개',
      'nav.login': '로그인',
      'hero.title.prefix': '',
      'hero.title.highlight': '한마디로',
      'hero.title.suffix': ', 모든 것을 해결',
      'hero.subtitle': '도구를 고를 필요 없고, AI를 배울 필요도 없습니다. 당신이 말하면, SEOBAIKE가 실행합니다.',
      'hero.cta1': '시작하기',
      'hero.cta2': '더 알아보기',
      'demo.title': '한 번 보면 이해됩니다',
      'demo.subtitle': '당신이 말하면, 최적의 AI 엔진이 처리합니다',
      'video.title': '60초 만에 이해하는 SEOBAIKE',
      'video.subtitle': '질문부터 답변까지, 전체 제품 체험을 확인하세요',
      'pillars.title': '왜 SEOBAIKE인가요?',
      'pillars.subtitle': '더 이상 고민할 필요 없는 세 가지 이유',
      'pillar.1.title': '선택 장애 제로',
      'pillar.1.desc': '다른 곳은 복잡한 선택을 강요합니다. 우리는? 그냥 말씀만 하세요.',
      'pillar.2.title': '자동 매칭',
      'pillar.2.desc': '1,000개 이상의 AI 엔진 중에서 가장 빠르고, 정확하고, 경제적인 것을 SEOBAIKE가 자동 선택합니다.',
      'pillar.3.title': '보안 보호',
      'pillar.3.desc': '당신의 데이터와 대화, 모두 암호화로 안전하게 보호됩니다.',
      'cap.title': '무엇을 할 수 있나요?',
      'cap.subtitle': '8가지 기능, 하나의 입구. 마우스를 올려 예시를 확인하세요.',
      'cap.chat': '채팅',
      'cap.chat.desc': '친구와 대화하듯 AI와 소통하세요',
      'cap.code': '코드',
      'cap.code.desc': '코딩, 디버깅, 최적화',
      'cap.vision': '비전',
      'cap.vision.desc': '이미지 분석 및 설명',
      'cap.reasoning': '추론',
      'cap.reasoning.desc': '수학, 논리, 복잡한 분석',
      'cap.search': '검색',
      'cap.search.desc': '실시간 최신 정보 검색',
      'cap.embed': '임베딩',
      'cap.embed.desc': '문서 분석, 의미 이해',
      'cap.image': '이미지 생성',
      'cap.image.desc': 'AI 그림 및 디자인',
      'cap.voice': '음성',
      'cap.voice.desc': '음성-텍스트 변환, 텍스트-음성 변환',
      'pricing.title': '나에게 맞는 요금제를 선택하세요',
      'pricing.subtitle': '어떤 단계에 있든, 최적의 요금제가 준비되어 있습니다',
      'pricing.free': '체험판',
      'pricing.personal': '개인판',
      'pricing.pro': '프로판',
      'pricing.enterprise': '기업판',
      'pricing.recommended': '추천',
      'pricing.more': '모든 요금제 보기',
      'trust.title': '신뢰할 수 있는 파트너',
      'trust.tw': '대만 기업',
      'trust.tw.desc': '정식 등록 법인',
      'trust.legal': '합법 법인',
      'trust.engines': '1,000+ AI 엔진',
      'trust.engines.desc': '최적의 엔진을 자동 선택',
      'trust.privacy': '제3자 접근 제로',
      'trust.privacy.desc': '당신의 데이터는 오직 당신의 것입니다',
      'cta.title': 'SEOBAIKE와 함께 올바른 길을 걸어보세요',
      'cta.subtitle': '신용카드 불필요. 계약 불필요. 나에게 맞는 방법을 찾아보세요.',
      'cta.btn': '여정을 시작하세요',
      'footer.company': '소로광유한공사 (小路光有限公司)',
      'footer.product': '제품',
      'footer.product.features': '기능 총람',
      'footer.product.pricing': '요금제 및 가격',
      'footer.product.docs': '사용 설명서',
      'footer.product.changelog': '업데이트 기록',
      'footer.corp': '회사',
      'footer.corp.about': '회사 소개',
      'footer.corp.contact': '문의하기',
      'footer.corp.privacy': '개인정보 보호정책',
      'footer.corp.terms': '이용약관',
      'footer.support': '지원',
      'footer.support.start': '빠른 시작',
      'footer.support.faq': '자주 묻는 질문',
      'footer.support.contact': '고객 지원 문의',
      'footer.support.status': '서비스 상태',
      // 마켓플레이스 번역 키
      'marketplace_hero': '당신의 상품을 전 세계로',
      'marketplace_sell': '판매하기',
      'marketplace_buy': '구매하기',
      'marketplace_list': '상품 등록',
      'marketplace_countries': '어디에 팔까요?',
      'global_reach': '글로벌 제로 디스턴스',
      'auto_translate': 'AI 자동 번역',
      'seller_dashboard': '판매자 대시보드',
      'buyer_browse': '마켓 둘러보기',
      'list_success': '등록 완료!'
    }
  },

  /**
   * 國家碼 → 語言對應表（Cloudflare Workers 設定 data-cf-country）
   */
  countryToLang: {
    'TW': 'zh-TW', 'HK': 'zh-TW', 'MO': 'zh-TW',
    'KR': 'ko',
    'JP': 'ja',
    'US': 'en', 'GB': 'en', 'AU': 'en', 'CA': 'en', 'NZ': 'en',
    'IE': 'en', 'SG': 'en', 'PH': 'en', 'IN': 'en'
  },

  /**
   * 從 navigator.language 偵測對應的支援語言
   * @returns {string} 偵測到的語言代碼
   */
  _detectFromNavigator: function() {
    var langs = [];
    try {
      if (navigator.languages && navigator.languages.length) {
        langs = Array.prototype.slice.call(navigator.languages);
      } else if (navigator.language) {
        langs = [navigator.language];
      }
    } catch(e) {}

    for (var i = 0; i < langs.length; i++) {
      var tag = langs[i].toLowerCase();
      // 繁體中文系列
      if (tag === 'zh-tw' || tag === 'zh-hant' || tag === 'zh-hant-tw' || tag === 'zh-hant-hk') {
        return 'zh-TW';
      }
      // 簡體中文也歸到 zh-TW（SEOBAIKE 不另設簡體，繁體可讀）
      if (tag === 'zh' || tag === 'zh-cn' || tag === 'zh-hans' || tag === 'zh-sg') {
        return 'zh-TW';
      }
      // 韓文
      if (tag === 'ko' || tag.indexOf('ko-') === 0) {
        return 'ko';
      }
      // 日文
      if (tag === 'ja' || tag.indexOf('ja-') === 0) {
        return 'ja';
      }
      // 英文
      if (tag === 'en' || tag.indexOf('en-') === 0) {
        return 'en';
      }
    }
    // 預設
    return 'en';
  },

  /**
   * 從 Cloudflare 國家碼偵測語言
   * Workers 會在 <html data-cf-country="TW"> 設定此屬性
   * @returns {string|null} 偵測到的語言代碼，或 null
   */
  _detectFromCloudflare: function() {
    try {
      var country = document.documentElement.getAttribute('data-cf-country');
      if (country && this.countryToLang[country.toUpperCase()]) {
        return this.countryToLang[country.toUpperCase()];
      }
    } catch(e) {}
    return null;
  },

  /**
   * 完整的語言偵測邏輯（依優先順序）
   * 1. 手動選擇 (seobaike_lang_manual)
   * 2. Cloudflare 國家碼
   * 3. navigator.language
   * 4. 預設 zh-TW
   * @returns {string} 最終決定的語言代碼
   */
  detectLanguage: function() {
    // 1. 手動選擇最優先
    var manual = null;
    try { manual = localStorage.getItem('seobaike_lang_manual'); } catch(e) {}
    if (manual && this.translations[manual]) {
      return manual;
    }

    // 2. Cloudflare 國家碼
    var cfLang = this._detectFromCloudflare();
    if (cfLang) return cfLang;

    // 3. navigator.language
    return this._detectFromNavigator();
  },

  /**
   * 取得翻譯文字
   * @param {string} key - 翻譯鍵值
   * @returns {string} 翻譯後的文字
   */
  t: function(key) {
    return (this.translations[this.current] && this.translations[this.current][key])
      || (this.translations['zh-TW'] && this.translations['zh-TW'][key])
      || key;
  },

  /**
   * 注入淡入淡出動畫所需的 CSS（只注入一次）
   */
  _injectTransitionCSS: function() {
    if (document.getElementById('seobaike-i18n-transition-css')) return;
    var style = document.createElement('style');
    style.id = 'seobaike-i18n-transition-css';
    style.textContent =
      '.seobaike-lang-fade { transition: opacity 0.25s ease; }' +
      '.seobaike-lang-fade-out { opacity: 0 !important; }';
    document.head.appendChild(style);
  },

  /**
   * 切換語言（含淡入淡出動畫）
   * @param {string} lang - 目標語言代碼 ('zh-TW' | 'en' | 'ja' | 'ko')
   * @param {object} [options] - 選項
   * @param {boolean} [options.manual] - 是否為使用者手動切換
   * @param {boolean} [options.skipAnimation] - 是否跳過動畫（初始化時用）
   */
  switchLang: function(lang, options) {
    if (!this.translations[lang]) return;
    var opts = options || {};
    var self = this;

    // 儲存語言選擇
    this.current = lang;
    try { localStorage.setItem('seobaike_lang', lang); } catch(e) {}

    // 如果是手動切換，額外存一個 manual 標記，之後優先使用
    if (opts.manual) {
      try { localStorage.setItem('seobaike_lang_manual', lang); } catch(e) {}
    }

    var applyTranslations = function() {
      // 設定 html lang 屬性
      document.documentElement.lang = lang;

      // 更新所有有 data-i18n 屬性的元素
      document.querySelectorAll('[data-i18n]').forEach(function(el) {
        el.textContent = self.t(el.dataset.i18n);
      });

      // 更新所有有 data-i18n-html 屬性的元素（支援 innerHTML）
      document.querySelectorAll('[data-i18n-html]').forEach(function(el) {
        var keys = el.dataset.i18nHtml.split(',');
        if (keys.length === 3) {
          el.innerHTML = self.t(keys[0]) + '<em>' + self.t(keys[1]) + '</em>' + self.t(keys[2]);
        }
      });

      // 更新語言切換按鈕的 active 狀態
      document.querySelectorAll('.lang-btn').forEach(function(b) {
        if (b.dataset.lang === lang) {
          b.classList.add('active');
        } else {
          b.classList.remove('active');
        }
      });

      // 觸發自訂事件，方便其他元件監聽
      try {
        document.dispatchEvent(new CustomEvent('seobaike:langchange', { detail: { lang: lang } }));
      } catch(e) {}
    };

    // 動畫邏輯
    if (opts.skipAnimation || !document.body) {
      applyTranslations();
      return;
    }

    this._injectTransitionCSS();
    document.body.classList.add('seobaike-lang-fade');
    document.body.classList.add('seobaike-lang-fade-out');

    setTimeout(function() {
      applyTranslations();
      document.body.classList.remove('seobaike-lang-fade-out');
      // 動畫結束後移除 transition class，避免影響其他動畫
      setTimeout(function() {
        document.body.classList.remove('seobaike-lang-fade');
      }, 300);
    }, 250);
  },

  /**
   * 初始化 — 自動偵測語言 + 載入上次選擇
   * 偵測優先順序：手動選擇 > Cloudflare 國家碼 > navigator.language > 預設
   */
  init: function() {
    var detectedLang = this.detectLanguage();
    // 首次載入跳過動畫，直接套用
    this.switchLang(detectedLang, { skipAnimation: true });
  }
};

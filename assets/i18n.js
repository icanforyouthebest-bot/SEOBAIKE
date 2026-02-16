/**
 * SEOBAIKE i18n - 國際化多語言翻譯系統（v3 - 全球市集版）
 * 支援：繁體中文（預設）、English、日本語、한국어
 * 語言偵測優先順序：
 *   1. localStorage 手動選擇 (seobaike_lang_manual)
 *   2. Cloudflare 國家碼 (html[data-cf-country])
 *   3. navigator.language / navigator.languages
 *   4. 預設 zh-TW
 * 小路光有限公司 (c) 2025-2026
 */
window.SEOBAIKE_I18N = {
  currentLang: 'zh-TW',
  supportedLangs: ['zh-TW', 'en', 'ja', 'ko'],

  translations: {

    /* ================================================================
     *  繁體中文 (zh-TW) — 預設語言
     * ================================================================ */
    'zh-TW': {
      // ── 導航 (nav) ──
      nav: {
        home: '首頁',
        features: '功能',
        marketplace: '市集',
        pricing: '方案',
        about: '關於',
        login: '登入'
      },

      // ── Hero 區域 ──
      hero: {
        eyebrow: 'SEOBAIKE Global Marketplace',
        title: '<span class="gradient">AI 驅動的</span><br>全球市集',
        subtitle: '你的產品，全世界都能買到。上架商品，AI 自動翻譯、行銷、配對買家。',
        cta1: '逛市集',
        cta2: '我要上架',
        scroll: 'SCROLL'
      },

      // ── Stats 統計 ──
      stats: {
        categories: '商品類別',
        countries: '佈局國家',
        uptime: '全天候運作',
        engines: 'AI 引擎'
      },

      // ── 全球節點 (global) ──
      global: {
        badge: 'LIVE NETWORK',
        title: '全球節點<span class="text-gold">即時連線</span>',
        subtitle: '從亞洲到全球，SEOBAIKE 市集正在擴展中',
        taiwan: '台灣',
        korea: '韓國',
        japan: '日本',
        singapore: '新加坡',
        usa: '美國',
        australia: '澳洲',
        uk: '英國',
        thailand: '泰國',
        vietnam: '越南',
        indonesia: '印尼',
        statusLive: '營運中',
        statusSoon: '即將開放',
        tickerLive: '市場營運中',
        tickerPreparing: '市場準備中',
        tickerNodes: '全球節點'
      },

      // ── 如何開始 (howItWorks) ──
      howItWorks: {
        badge: 'HOW IT WORKS',
        title: '如何開始',
        subtitle: '從上架到成交，AI 全程協助',
        step1Title: '上架商品',
        step1Desc: '填寫商品資訊，上傳圖片。支援數位商品與實體商品。',
        step2Title: 'AI 翻譯行銷',
        step2Desc: 'AI 自動翻譯商品描述、生成多語言行銷文案，觸及全球買家。',
        step3Title: '全球買家下單',
        step3Desc: '來自各國的買家瀏覽你的商品，直接下單購買。'
      },

      // ── Demo 展示 ──
      demo: {
        badge: 'LIVE DEMO',
        title: 'AI <span class="text-gold">即時運作</span>',
        subtitle: '看 SEOBAIKE 的 AI 引擎如何處理你的商品'
      },

      // ── 三大優勢 (pillars) ──
      pillars: {
        badge: 'WHY SEOBAIKE',
        title: '為什麼選 <span class="text-gold">SEOBAIKE</span>',
        subtitle: '三大核心優勢，讓你的商品走向世界',
        pillar1Title: '全球市集',
        pillar1Desc: '多國市場同步上架，AI 自動適配各地語言與消費習慣。從亞洲到歐美，一站式觸及全球買家。',
        pillar2Title: 'AI 全自動',
        pillar2Desc: '從翻譯、SEO 優化、行銷文案到客服回覆，AI 引擎全程自動化運作，賣家專注做好產品。',
        pillar3Title: '安全收款',
        pillar3Desc: '多幣種結算，安全支付通道。資金流向透明，交易記錄完整可查。'
      },

      // ── AI 能力 (capabilities) ──
      capabilities: {
        badge: 'AI CAPABILITIES',
        title: 'AI <span class="text-gold">能力矩陣</span>',
        subtitle: '內建多種 AI 引擎，覆蓋電商營運全流程',
        seoTitle: 'SEO 分析',
        seoDesc: '自動分析關鍵字、競品排名，產出最佳化建議。',
        chatTitle: 'AI 對話',
        chatDesc: '智能客服，多語言即時回覆買家問題。',
        imageTitle: '圖片生成',
        imageDesc: 'AI 生成商品展示圖、行銷素材、社群貼文圖。',
        translateTitle: '多語翻譯',
        translateDesc: '商品描述、評論、客服對話，即時翻譯多國語言。',
        analyticsTitle: '數據分析',
        analyticsDesc: '銷售趨勢、買家行為、市場洞察，數據一目了然。',
        supportTitle: '智能客服',
        supportDesc: '全天候 AI 客服，處理訂單查詢、退換貨、常見問題。',
        contentTitle: '內容生成',
        contentDesc: '自動生成商品文案、部落格文章、社群行銷內容。',
        researchTitle: '市場研究',
        researchDesc: 'AI 分析各國市場趨勢、消費偏好、定價策略。'
      },

      // ── CTA 行動號召 ──
      cta: {
        badge: 'GET STARTED',
        title: '讓你的產品<br><span class="text-gold">被全世界看見</span>',
        subtitle: '加入 SEOBAIKE 全球市集，AI 幫你打開國際市場。',
        primary: '立即開始',
        secondary: '了解更多'
      },

      // ── Footer 頁尾 ──
      footer: {
        brand: 'AI 驅動的全球市集。小路光有限公司出品。',
        legal: '統編 60475510 | 台灣專利 115100981',
        productHeading: '產品',
        productMarketplace: '市集',
        productFeatures: '功能',
        productPricing: '方案',
        productEcosystem: '生態系統',
        resourceHeading: '資源',
        resourceDocs: '文件',
        resourceBlog: '部落格',
        resourceChangelog: '更新日誌',
        resourceStatus: '系統狀態',
        companyHeading: '公司',
        companyAbout: '關於我們',
        companyContact: '聯絡',
        companyPrivacy: '隱私政策',
        companyTerms: '服務條款',
        copyright: '\u00a9 2025 SEOBAIKE. 小路光有限公司 版權所有。',
        privacyShort: '隱私',
        termsShort: '條款',
        disclaimer: '本平台由小路光有限公司（統編 60475510）營運。AI 服務結果僅供參考，不構成任何形式之保證或承諾。使用本服務即表示同意<a href="/terms">服務條款</a>及<a href="/privacy">隱私權政策</a>。台灣專利申請案號 115100981。'
      },

      // ── 通用按鈕 (buttons) ──
      buttons: {
        getStarted: '開始使用',
        learnMore: '了解更多',
        freeTrial: '免費體驗',
        contactUs: '聯繫我們',
        exploreMarket: '探索市集'
      },

      // ── 舊版平面鍵（向後相容） ──
      'nav.home': '首頁',
      'nav.features': '功能',
      'nav.marketplace': '市集',
      'nav.pricing': '方案',
      'nav.docs': '文件',
      'nav.about': '關於',
      'nav.login': '登入',
      'hero.title.prefix': '',
      'hero.title.highlight': 'AI 驅動的',
      'hero.title.suffix': '全球市集',
      'hero.subtitle': '你的產品，全世界都能買到。上架商品，AI 自動翻譯、行銷、配對買家。',
      'hero.cta1': '逛市集',
      'hero.cta2': '我要上架',
      'footer.company': '小路光有限公司',
      'footer.product': '產品',
      'footer.product.features': '功能',
      'footer.product.pricing': '方案',
      'footer.product.docs': '文件',
      'footer.product.changelog': '更新日誌',
      'footer.corp': '公司',
      'footer.corp.about': '關於我們',
      'footer.corp.contact': '聯絡',
      'footer.corp.privacy': '隱私政策',
      'footer.corp.terms': '服務條款',
      'footer.support': '支援',
      'footer.support.start': '快速開始',
      'footer.support.faq': '常見問題',
      'footer.support.contact': '聯繫客服',
      'footer.support.status': '服務狀態',
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

    /* ================================================================
     *  English (en) — Silicon Valley SaaS style
     * ================================================================ */
    'en': {
      // ── Navigation ──
      nav: {
        home: 'Home',
        features: 'Features',
        marketplace: 'Marketplace',
        pricing: 'Pricing',
        about: 'About',
        login: 'Sign In'
      },

      // ── Hero ──
      hero: {
        eyebrow: 'SEOBAIKE Global Marketplace',
        title: '<span class="gradient">AI-Powered</span><br>Global Marketplace',
        subtitle: 'Your products, available to buyers worldwide. List once — AI handles translation, marketing, and buyer matching.',
        cta1: 'Browse Market',
        cta2: 'Start Selling',
        scroll: 'SCROLL'
      },

      // ── Stats ──
      stats: {
        categories: 'Product Categories',
        countries: 'Countries Covered',
        uptime: 'Always-On Service',
        engines: 'AI Engines'
      },

      // ── Global Reach ──
      global: {
        badge: 'LIVE NETWORK',
        title: 'Global Nodes <span class="text-gold">Connected Live</span>',
        subtitle: 'From Asia to the world — the SEOBAIKE marketplace is expanding',
        taiwan: 'Taiwan',
        korea: 'South Korea',
        japan: 'Japan',
        singapore: 'Singapore',
        usa: 'United States',
        australia: 'Australia',
        uk: 'United Kingdom',
        thailand: 'Thailand',
        vietnam: 'Vietnam',
        indonesia: 'Indonesia',
        statusLive: 'Live',
        statusSoon: 'Coming Soon',
        tickerLive: 'Markets Live',
        tickerPreparing: 'Markets in Progress',
        tickerNodes: 'Global Nodes'
      },

      // ── How It Works ──
      howItWorks: {
        badge: 'HOW IT WORKS',
        title: 'Get Started',
        subtitle: 'From listing to sale — AI assists every step of the way',
        step1Title: 'List Your Product',
        step1Desc: 'Add product details and upload images. Supports both digital and physical goods.',
        step2Title: 'AI Translates & Markets',
        step2Desc: 'AI auto-translates product descriptions, generates multilingual marketing copy, and reaches global buyers.',
        step3Title: 'Global Buyers Order',
        step3Desc: 'Buyers from around the world browse your products and place orders directly.'
      },

      // ── Demo ──
      demo: {
        badge: 'LIVE DEMO',
        title: 'AI <span class="text-gold">in Action</span>',
        subtitle: 'See how the SEOBAIKE AI engine processes your products'
      },

      // ── Three Pillars ──
      pillars: {
        badge: 'WHY SEOBAIKE',
        title: 'Why Choose <span class="text-gold">SEOBAIKE</span>',
        subtitle: 'Three core advantages to take your products global',
        pillar1Title: 'Global Marketplace',
        pillar1Desc: 'List across multiple markets simultaneously. AI auto-adapts language and consumer preferences. One platform to reach buyers from Asia to the Americas.',
        pillar2Title: 'Fully Automated AI',
        pillar2Desc: 'From translation and SEO optimization to marketing copy and customer support — AI engines run the entire operation so sellers can focus on their products.',
        pillar3Title: 'Secure Payments',
        pillar3Desc: 'Multi-currency settlement with secure payment channels. Transparent fund flows and complete transaction records.'
      },

      // ── AI Capabilities ──
      capabilities: {
        badge: 'AI CAPABILITIES',
        title: 'AI <span class="text-gold">Capability Matrix</span>',
        subtitle: 'Built-in AI engines covering the entire e-commerce workflow',
        seoTitle: 'SEO Analytics',
        seoDesc: 'Automated keyword analysis, competitor ranking insights, and optimization recommendations.',
        chatTitle: 'AI Conversations',
        chatDesc: 'Intelligent customer service with real-time multilingual buyer support.',
        imageTitle: 'Image Generation',
        imageDesc: 'AI-generated product showcase images, marketing assets, and social media visuals.',
        translateTitle: 'Multilingual Translation',
        translateDesc: 'Product descriptions, reviews, and support conversations — translated instantly across languages.',
        analyticsTitle: 'Data Analytics',
        analyticsDesc: 'Sales trends, buyer behavior, and market intelligence — all at a glance.',
        supportTitle: 'Smart Support',
        supportDesc: 'Around-the-clock AI support handling order inquiries, returns, and FAQs.',
        contentTitle: 'Content Generation',
        contentDesc: 'Auto-generated product copy, blog articles, and social marketing content.',
        researchTitle: 'Market Research',
        researchDesc: 'AI-driven analysis of regional market trends, consumer preferences, and pricing strategies.'
      },

      // ── CTA ──
      cta: {
        badge: 'GET STARTED',
        title: 'Put Your Products<br><span class="text-gold">in Front of the World</span>',
        subtitle: 'Join the SEOBAIKE global marketplace. Let AI unlock international markets for you.',
        primary: 'Get Started Now',
        secondary: 'Learn More'
      },

      // ── Footer ──
      footer: {
        brand: 'AI-powered global marketplace. Built by Hsiao Lu Guang Co., Ltd.',
        legal: 'Tax ID 60475510 | Taiwan Patent 115100981',
        productHeading: 'Product',
        productMarketplace: 'Marketplace',
        productFeatures: 'Features',
        productPricing: 'Pricing',
        productEcosystem: 'Ecosystem',
        resourceHeading: 'Resources',
        resourceDocs: 'Documentation',
        resourceBlog: 'Blog',
        resourceChangelog: 'Changelog',
        resourceStatus: 'System Status',
        companyHeading: 'Company',
        companyAbout: 'About Us',
        companyContact: 'Contact',
        companyPrivacy: 'Privacy Policy',
        companyTerms: 'Terms of Service',
        copyright: '\u00a9 2025 SEOBAIKE. Hsiao Lu Guang Co., Ltd. All rights reserved.',
        privacyShort: 'Privacy',
        termsShort: 'Terms',
        disclaimer: 'This platform is operated by Hsiao Lu Guang Co., Ltd. (Tax ID 60475510). AI-generated results are for reference only and do not constitute any form of guarantee or commitment. By using this service, you agree to the <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>. Taiwan Patent Application No. 115100981.'
      },

      // ── Common Buttons ──
      buttons: {
        getStarted: 'Get Started',
        learnMore: 'Learn More',
        freeTrial: 'Free Trial',
        contactUs: 'Contact Us',
        exploreMarket: 'Explore Marketplace'
      },

      // ── Legacy flat keys (backward compatibility) ──
      'nav.home': 'Home',
      'nav.features': 'Features',
      'nav.marketplace': 'Marketplace',
      'nav.pricing': 'Pricing',
      'nav.docs': 'Docs',
      'nav.about': 'About',
      'nav.login': 'Sign In',
      'hero.title.prefix': '',
      'hero.title.highlight': 'AI-Powered',
      'hero.title.suffix': 'Global Marketplace',
      'hero.subtitle': 'Your products, available to buyers worldwide. List once — AI handles translation, marketing, and buyer matching.',
      'hero.cta1': 'Browse Market',
      'hero.cta2': 'Start Selling',
      'footer.company': 'Hsiao Lu Guang Co., Ltd.',
      'footer.product': 'Product',
      'footer.product.features': 'Features',
      'footer.product.pricing': 'Pricing',
      'footer.product.docs': 'Documentation',
      'footer.product.changelog': 'Changelog',
      'footer.corp': 'Company',
      'footer.corp.about': 'About Us',
      'footer.corp.contact': 'Contact Us',
      'footer.corp.privacy': 'Privacy Policy',
      'footer.corp.terms': 'Terms of Service',
      'footer.support': 'Support',
      'footer.support.start': 'Quick Start',
      'footer.support.faq': 'FAQ',
      'footer.support.contact': 'Contact Support',
      'footer.support.status': 'Service Status',
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

    /* ================================================================
     *  日本語 (ja) — です/ます體，企業級禮貌用語
     * ================================================================ */
    'ja': {
      // ── ナビゲーション ──
      nav: {
        home: 'ホーム',
        features: '機能',
        marketplace: 'マーケット',
        pricing: '料金プラン',
        about: '会社概要',
        login: 'ログイン'
      },

      // ── ヒーロー ──
      hero: {
        eyebrow: 'SEOBAIKE Global Marketplace',
        title: '<span class="gradient">AIが動かす</span><br>グローバルマーケット',
        subtitle: 'あなたの商品を、世界中のお客様へ。出品するだけで、AIが翻訳・マーケティング・バイヤーマッチングを自動で行います。',
        cta1: 'マーケットを見る',
        cta2: '出品する',
        scroll: 'SCROLL'
      },

      // ── 統計 ──
      stats: {
        categories: '商品カテゴリ',
        countries: '展開国数',
        uptime: '24時間稼働',
        engines: 'AIエンジン'
      },

      // ── グローバル展開 ──
      global: {
        badge: 'LIVE NETWORK',
        title: 'グローバルノード<span class="text-gold">リアルタイム接続</span>',
        subtitle: 'アジアから世界へ — SEOBAIKEマーケットは拡大を続けています',
        taiwan: '台湾',
        korea: '韓国',
        japan: '日本',
        singapore: 'シンガポール',
        usa: 'アメリカ',
        australia: 'オーストラリア',
        uk: 'イギリス',
        thailand: 'タイ',
        vietnam: 'ベトナム',
        indonesia: 'インドネシア',
        statusLive: '運営中',
        statusSoon: '近日公開',
        tickerLive: 'マーケット運営中',
        tickerPreparing: 'マーケット準備中',
        tickerNodes: 'グローバルノード'
      },

      // ── 始め方 ──
      howItWorks: {
        badge: 'HOW IT WORKS',
        title: 'ご利用の流れ',
        subtitle: '出品から成約まで、AIが全工程をサポートいたします',
        step1Title: '商品を出品する',
        step1Desc: '商品情報を入力し、画像をアップロードしてください。デジタル商品・実体商品の両方に対応しております。',
        step2Title: 'AIが翻訳・販促',
        step2Desc: 'AIが商品説明を自動翻訳し、多言語のマーケティングコピーを生成して、世界中のバイヤーにリーチいたします。',
        step3Title: '世界中のバイヤーが注文',
        step3Desc: '各国のバイヤーがあなたの商品を閲覧し、直接注文いたします。'
      },

      // ── デモ ──
      demo: {
        badge: 'LIVE DEMO',
        title: 'AI <span class="text-gold">リアルタイム動作</span>',
        subtitle: 'SEOBAIKEのAIエンジンがあなたの商品をどのように処理するかご覧ください'
      },

      // ── 3つの強み ──
      pillars: {
        badge: 'WHY SEOBAIKE',
        title: '<span class="text-gold">SEOBAIKE</span>が選ばれる理由',
        subtitle: '3つのコアアドバンテージで、あなたの商品を世界へ',
        pillar1Title: 'グローバルマーケット',
        pillar1Desc: '複数国のマーケットへ同時出品。AIが各地域の言語と消費傾向に自動対応いたします。アジアから欧米まで、ワンストップで世界中のバイヤーにリーチできます。',
        pillar2Title: 'AI完全自動化',
        pillar2Desc: '翻訳、SEO最適化、マーケティングコピーからカスタマーサポートまで、AIエンジンが全工程を自動運用。セラーの皆様は商品づくりに専念いただけます。',
        pillar3Title: '安全な決済',
        pillar3Desc: '多通貨対応の安全な決済チャネル。資金の流れは透明で、取引記録はすべて確認可能です。'
      },

      // ── AI能力 ──
      capabilities: {
        badge: 'AI CAPABILITIES',
        title: 'AI <span class="text-gold">ケイパビリティ</span>',
        subtitle: '複数のAIエンジンを内蔵し、EC運営の全工程をカバーいたします',
        seoTitle: 'SEO分析',
        seoDesc: 'キーワード分析、競合ランキング調査、最適化提案を自動で実施いたします。',
        chatTitle: 'AI対話',
        chatDesc: 'インテリジェントなカスタマーサービスで、多言語のバイヤー対応をリアルタイムで行います。',
        imageTitle: '画像生成',
        imageDesc: 'AIが商品展示画像、マーケティング素材、SNS投稿画像を生成いたします。',
        translateTitle: '多言語翻訳',
        translateDesc: '商品説明、レビュー、カスタマーサポート対話を多言語へ即時翻訳いたします。',
        analyticsTitle: 'データ分析',
        analyticsDesc: '売上トレンド、バイヤー行動、マーケットインサイトを一目で把握できます。',
        supportTitle: 'スマートサポート',
        supportDesc: '24時間AIサポートが注文照会、返品対応、よくあるご質問に対応いたします。',
        contentTitle: 'コンテンツ生成',
        contentDesc: '商品コピー、ブログ記事、SNSマーケティングコンテンツを自動生成いたします。',
        researchTitle: '市場調査',
        researchDesc: 'AIが各国の市場トレンド、消費者嗜好、価格戦略を分析いたします。'
      },

      // ── CTA ──
      cta: {
        badge: 'GET STARTED',
        title: 'あなたの商品を<br><span class="text-gold">世界中に届けましょう</span>',
        subtitle: 'SEOBAIKEグローバルマーケットに参加して、AIで国際市場を開拓しましょう。',
        primary: '今すぐ始める',
        secondary: '詳しく見る'
      },

      // ── フッター ──
      footer: {
        brand: 'AIが動かすグローバルマーケット。小路光有限会社が運営しております。',
        legal: '統一編號 60475510 | 台湾特許 115100981',
        productHeading: '製品',
        productMarketplace: 'マーケット',
        productFeatures: '機能',
        productPricing: '料金プラン',
        productEcosystem: 'エコシステム',
        resourceHeading: 'リソース',
        resourceDocs: 'ドキュメント',
        resourceBlog: 'ブログ',
        resourceChangelog: '更新履歴',
        resourceStatus: 'システム状態',
        companyHeading: '会社',
        companyAbout: '会社概要',
        companyContact: 'お問い合わせ',
        companyPrivacy: 'プライバシーポリシー',
        companyTerms: '利用規約',
        copyright: '\u00a9 2025 SEOBAIKE. 小路光有限会社 All rights reserved.',
        privacyShort: 'プライバシー',
        termsShort: '利用規約',
        disclaimer: '本プラットフォームは小路光有限会社（統一編號 60475510）が運営しております。AIサービスの結果は参考情報であり、いかなる形式の保証または約束を構成するものではございません。本サービスのご利用により、<a href="/terms">利用規約</a>および<a href="/privacy">プライバシーポリシー</a>に同意したものとみなされます。台湾特許出願番号 115100981。'
      },

      // ── 共通ボタン ──
      buttons: {
        getStarted: '始める',
        learnMore: '詳しく見る',
        freeTrial: '無料体験',
        contactUs: 'お問い合わせ',
        exploreMarket: 'マーケットを探す'
      },

      // ── レガシーフラットキー（下位互換性） ──
      'nav.home': 'ホーム',
      'nav.features': '機能',
      'nav.marketplace': 'マーケット',
      'nav.pricing': '料金プラン',
      'nav.docs': 'ドキュメント',
      'nav.about': '会社概要',
      'nav.login': 'ログイン',
      'hero.title.prefix': '',
      'hero.title.highlight': 'AIが動かす',
      'hero.title.suffix': 'グローバルマーケット',
      'hero.subtitle': 'あなたの商品を、世界中のお客様へ。出品するだけで、AIが翻訳・マーケティング・バイヤーマッチングを自動で行います。',
      'hero.cta1': 'マーケットを見る',
      'hero.cta2': '出品する',
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
      'footer.support.faq': 'よくあるご質問',
      'footer.support.contact': 'サポートへのお問い合わせ',
      'footer.support.status': 'サービス状態',
      'marketplace_hero': 'あなたの商品を世界へ',
      'marketplace_sell': '販売する',
      'marketplace_buy': '購入する',
      'marketplace_list': '出品する',
      'marketplace_countries': 'どこに売りますか？',
      'global_reach': '世界とゼロ距離',
      'auto_translate': 'AI自動翻訳',
      'seller_dashboard': 'セラーダッシュボード',
      'buyer_browse': 'マーケットを見る',
      'list_success': '出品完了！'
    },

    /* ================================================================
     *  한국어 (ko) — 正式公司體，韓國科技公司風格
     * ================================================================ */
    'ko': {
      // ── 내비게이션 ──
      nav: {
        home: '홈',
        features: '기능',
        marketplace: '마켓플레이스',
        pricing: '요금제',
        about: '소개',
        login: '로그인'
      },

      // ── 히어로 ──
      hero: {
        eyebrow: 'SEOBAIKE Global Marketplace',
        title: '<span class="gradient">AI 기반</span><br>글로벌 마켓플레이스',
        subtitle: '당신의 상품을 전 세계 고객에게. 상품을 등록하면 AI가 번역, 마케팅, 바이어 매칭을 자동으로 처리합니다.',
        cta1: '마켓 둘러보기',
        cta2: '판매 시작하기',
        scroll: 'SCROLL'
      },

      // ── 통계 ──
      stats: {
        categories: '상품 카테고리',
        countries: '진출 국가',
        uptime: '연중무휴 운영',
        engines: 'AI 엔진'
      },

      // ── 글로벌 네트워크 ──
      global: {
        badge: 'LIVE NETWORK',
        title: '글로벌 노드 <span class="text-gold">실시간 연결</span>',
        subtitle: '아시아에서 전 세계로 — SEOBAIKE 마켓플레이스가 확장되고 있습니다',
        taiwan: '대만',
        korea: '한국',
        japan: '일본',
        singapore: '싱가포르',
        usa: '미국',
        australia: '호주',
        uk: '영국',
        thailand: '태국',
        vietnam: '베트남',
        indonesia: '인도네시아',
        statusLive: '운영 중',
        statusSoon: '출시 예정',
        tickerLive: '마켓 운영 중',
        tickerPreparing: '마켓 준비 중',
        tickerNodes: '글로벌 노드'
      },

      // ── 이용 방법 ──
      howItWorks: {
        badge: 'HOW IT WORKS',
        title: '시작하는 방법',
        subtitle: '등록부터 판매까지, AI가 모든 과정을 지원합니다',
        step1Title: '상품 등록',
        step1Desc: '상품 정보를 입력하고 이미지를 업로드하세요. 디지털 상품과 실물 상품 모두 지원됩니다.',
        step2Title: 'AI 번역 및 마케팅',
        step2Desc: 'AI가 상품 설명을 자동 번역하고, 다국어 마케팅 카피를 생성하여 전 세계 바이어에게 도달합니다.',
        step3Title: '글로벌 바이어 주문',
        step3Desc: '전 세계의 바이어가 당신의 상품을 확인하고 직접 주문합니다.'
      },

      // ── 데모 ──
      demo: {
        badge: 'LIVE DEMO',
        title: 'AI <span class="text-gold">실시간 작동</span>',
        subtitle: 'SEOBAIKE AI 엔진이 상품을 처리하는 과정을 확인해 보세요'
      },

      // ── 3대 장점 ──
      pillars: {
        badge: 'WHY SEOBAIKE',
        title: '<span class="text-gold">SEOBAIKE</span>를 선택하는 이유',
        subtitle: '세 가지 핵심 강점으로 상품을 세계로 진출시키세요',
        pillar1Title: '글로벌 마켓플레이스',
        pillar1Desc: '여러 국가의 마켓에 동시 등록됩니다. AI가 각 지역의 언어와 소비 성향에 자동으로 대응합니다. 아시아에서 미주까지 원스톱으로 전 세계 바이어에게 도달할 수 있습니다.',
        pillar2Title: 'AI 완전 자동화',
        pillar2Desc: '번역, SEO 최적화, 마케팅 카피부터 고객 응대까지 AI 엔진이 전 과정을 자동 운영합니다. 셀러는 상품 제작에만 집중하실 수 있습니다.',
        pillar3Title: '안전한 결제',
        pillar3Desc: '다중 통화 정산과 안전한 결제 채널을 지원합니다. 자금 흐름이 투명하며, 거래 기록을 완벽하게 조회할 수 있습니다.'
      },

      // ── AI 역량 ──
      capabilities: {
        badge: 'AI CAPABILITIES',
        title: 'AI <span class="text-gold">역량 매트릭스</span>',
        subtitle: '다수의 AI 엔진이 내장되어 이커머스 운영 전 과정을 지원합니다',
        seoTitle: 'SEO 분석',
        seoDesc: '키워드 분석, 경쟁사 순위 조사, 최적화 제안을 자동으로 수행합니다.',
        chatTitle: 'AI 대화',
        chatDesc: '지능형 고객 서비스로, 다국어 바이어 문의에 실시간 응대합니다.',
        imageTitle: '이미지 생성',
        imageDesc: 'AI가 상품 전시 이미지, 마케팅 소재, SNS 게시물 이미지를 생성합니다.',
        translateTitle: '다국어 번역',
        translateDesc: '상품 설명, 리뷰, 고객 응대 대화를 다국어로 즉시 번역합니다.',
        analyticsTitle: '데이터 분석',
        analyticsDesc: '판매 트렌드, 바이어 행동, 시장 인사이트를 한눈에 파악할 수 있습니다.',
        supportTitle: '스마트 지원',
        supportDesc: '24시간 AI 지원이 주문 문의, 반품 처리, 자주 묻는 질문에 대응합니다.',
        contentTitle: '콘텐츠 생성',
        contentDesc: '상품 카피, 블로그 기사, SNS 마케팅 콘텐츠를 자동으로 생성합니다.',
        researchTitle: '시장 조사',
        researchDesc: 'AI가 각국의 시장 트렌드, 소비자 선호, 가격 전략을 분석합니다.'
      },

      // ── CTA ──
      cta: {
        badge: 'GET STARTED',
        title: '당신의 상품을<br><span class="text-gold">전 세계에 알리세요</span>',
        subtitle: 'SEOBAIKE 글로벌 마켓플레이스에 참여하여 AI로 해외 시장을 개척하세요.',
        primary: '지금 시작하기',
        secondary: '자세히 알아보기'
      },

      // ── 푸터 ──
      footer: {
        brand: 'AI 기반 글로벌 마켓플레이스. 소로광유한공사(小路光有限公司)가 운영합니다.',
        legal: '통일편호 60475510 | 대만 특허 115100981',
        productHeading: '제품',
        productMarketplace: '마켓플레이스',
        productFeatures: '기능',
        productPricing: '요금제',
        productEcosystem: '에코시스템',
        resourceHeading: '리소스',
        resourceDocs: '문서',
        resourceBlog: '블로그',
        resourceChangelog: '업데이트 기록',
        resourceStatus: '시스템 상태',
        companyHeading: '회사',
        companyAbout: '회사 소개',
        companyContact: '문의하기',
        companyPrivacy: '개인정보 보호정책',
        companyTerms: '이용약관',
        copyright: '\u00a9 2025 SEOBAIKE. 소로광유한공사(小路光有限公司) All rights reserved.',
        privacyShort: '개인정보',
        termsShort: '이용약관',
        disclaimer: '본 플랫폼은 소로광유한공사(小路光有限公司, 통일편호 60475510)가 운영합니다. AI 서비스 결과는 참고용이며, 어떠한 형태의 보증이나 약속을 구성하지 않습니다. 본 서비스 이용 시 <a href="/terms">이용약관</a> 및 <a href="/privacy">개인정보 보호정책</a>에 동의하신 것으로 간주됩니다. 대만 특허 출원번호 115100981.'
      },

      // ── 공통 버튼 ──
      buttons: {
        getStarted: '시작하기',
        learnMore: '자세히 알아보기',
        freeTrial: '무료 체험',
        contactUs: '문의하기',
        exploreMarket: '마켓 탐색하기'
      },

      // ── 레거시 플랫 키（하위 호환성） ──
      'nav.home': '홈',
      'nav.features': '기능',
      'nav.marketplace': '마켓플레이스',
      'nav.pricing': '요금제',
      'nav.docs': '문서',
      'nav.about': '소개',
      'nav.login': '로그인',
      'hero.title.prefix': '',
      'hero.title.highlight': 'AI 기반',
      'hero.title.suffix': '글로벌 마켓플레이스',
      'hero.subtitle': '당신의 상품을 전 세계 고객에게. 상품을 등록하면 AI가 번역, 마케팅, 바이어 매칭을 자동으로 처리합니다.',
      'hero.cta1': '마켓 둘러보기',
      'hero.cta2': '판매 시작하기',
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
      'marketplace_hero': '당신의 상품을 전 세계로',
      'marketplace_sell': '판매하기',
      'marketplace_buy': '구매하기',
      'marketplace_list': '상품 등록',
      'marketplace_countries': '어디에 판매하시겠습니까?',
      'global_reach': '글로벌 제로 디스턴스',
      'auto_translate': 'AI 자동 번역',
      'seller_dashboard': '판매자 대시보드',
      'buyer_browse': '마켓 둘러보기',
      'list_success': '등록 완료!'
    }
  },

  /* ================================================================
   *  國家碼 → 語言對應表（Cloudflare Workers 設定 data-cf-country）
   * ================================================================ */
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
    // 非支援語言的使用者預設看英文
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
   * 1. 手動選擇 (seobaike_lang_manual / seobaike-lang)
   * 2. Cloudflare 國家碼
   * 3. navigator.language
   * 4. 預設 zh-TW
   * @returns {string} 最終決定的語言代碼
   */
  detectLanguage: function() {
    // 1. 手動選擇最優先（同時檢查新舊兩個 key）
    var manual = null;
    try {
      manual = localStorage.getItem('seobaike_lang_manual') || localStorage.getItem('seobaike-lang');
    } catch(e) {}
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
   * 取得翻譯文字 — 支援巢狀鍵 (dot notation) 與平面鍵
   * @param {string} key - 翻譯鍵值，例如 'nav.home' 或 'hero.subtitle'
   * @returns {string} 翻譯後的文字
   */
  t: function(key) {
    var langData = this.translations[this.currentLang];
    var fallback = this.translations['zh-TW'];

    // 先嘗試平面鍵查找
    if (langData && typeof langData[key] === 'string') {
      return langData[key];
    }

    // 再嘗試巢狀鍵查找 (dot notation)
    var keys = key.split('.');
    var val = langData;
    for (var i = 0; i < keys.length; i++) {
      if (val && typeof val === 'object') {
        val = val[keys[i]];
      } else {
        val = undefined;
        break;
      }
    }
    if (typeof val === 'string') return val;

    // 找不到就用繁體中文 fallback（平面鍵）
    if (fallback && typeof fallback[key] === 'string') {
      return fallback[key];
    }

    // 繁體中文 fallback（巢狀鍵）
    val = fallback;
    for (var j = 0; j < keys.length; j++) {
      if (val && typeof val === 'object') {
        val = val[keys[j]];
      } else {
        val = undefined;
        break;
      }
    }
    if (typeof val === 'string') return val;

    // 都找不到就回傳 key 本身
    return key;
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

    // 更新目前語言
    this.currentLang = lang;
    // 向後相容：也設定 current 屬性
    this.current = lang;

    // 儲存語言選擇
    try { localStorage.setItem('seobaike_lang', lang); } catch(e) {}

    // 如果是手動切換，額外存一個 manual 標記，之後優先使用
    if (opts.manual) {
      try {
        localStorage.setItem('seobaike_lang_manual', lang);
        localStorage.setItem('seobaike-lang', lang);
      } catch(e) {}
    }

    var applyTranslations = function() {
      // 設定 html lang 屬性
      var htmlLang = lang;
      if (lang === 'zh-TW') htmlLang = 'zh-Hant';
      document.documentElement.lang = htmlLang;

      // 更新所有有 data-i18n 屬性的元素（textContent）
      document.querySelectorAll('[data-i18n]').forEach(function(el) {
        var key = el.getAttribute('data-i18n');
        var translated = self.t(key);
        if (translated && translated !== key) {
          el.textContent = translated;
        }
      });

      // 更新所有有 data-i18n-html 屬性的元素（innerHTML）
      document.querySelectorAll('[data-i18n-html]').forEach(function(el) {
        var key = el.getAttribute('data-i18n-html');

        // 情況 1: 逗號分隔的三段式 key（例如 hero title: prefix,highlight,suffix）
        if (key.indexOf(',') !== -1) {
          var keys = key.split(',');
          if (keys.length === 3) {
            var prefix = self.t(keys[0].trim());
            var highlight = self.t(keys[1].trim());
            var suffix = self.t(keys[2].trim());
            // prefix 如果等於 key 本身表示找不到，視為空字串
            if (prefix === keys[0].trim()) prefix = '';
            el.innerHTML = prefix + '<span class="gradient">' + highlight + '</span><br>' + suffix;
          }
        } else {
          // 情況 2: 單一 key，直接用 innerHTML
          var translated = self.t(key);
          if (translated && translated !== key) {
            el.innerHTML = translated;
          }
        }
      });

      // 更新語言切換按鈕的 active 狀態
      document.querySelectorAll('.lang-btn').forEach(function(btn) {
        if (btn.dataset.lang === lang) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
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

// 若 DOMContentLoaded 尚未觸發，等待它；否則立即 init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    window.SEOBAIKE_I18N.init();
  });
}

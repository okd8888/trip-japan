/* =========================================================================
 *  目的地預設檔 — 給「設定」分頁的下拉選單使用
 *  選了目的地就會自動帶入幣別，並提供該地的建議景點清單可一鍵加入行程。
 *  要新增目的地，照著格式往 DESTINATIONS 裡加即可。
 * ========================================================================= */
window.PRESETS = {

  /* 幣別下拉選單用 */
  currencies: [
    { code: "TWD", symbol: "NT$", name: "台幣" },
    { code: "JPY", symbol: "¥",   name: "日圓" },
    { code: "KRW", symbol: "₩",   name: "韓元" },
    { code: "USD", symbol: "US$", name: "美元" },
    { code: "EUR", symbol: "€",   name: "歐元" },
    { code: "HKD", symbol: "HK$", name: "港幣" },
    { code: "SGD", symbol: "S$",  name: "新加坡幣" },
    { code: "THB", symbol: "฿",   name: "泰銖" },
    { code: "VND", symbol: "₫",   name: "越南盾" },
    { code: "MYR", symbol: "RM",  name: "馬幣" },
    { code: "PHP", symbol: "₱",   name: "披索" },
    { code: "CNY", symbol: "¥",   name: "人民幣" },
    { code: "GBP", symbol: "£",   name: "英鎊" },
    { code: "AUD", symbol: "A$",  name: "澳幣" }
  ],

  /* 常用花費分類（可在設定裡改） */
  categories: ["餐飲", "交通", "購物", "門票", "住宿", "加油停車", "其他"],

  destinations: [
    {
      id: "okinawa", name: "沖繩", eyebrow: "OKINAWA",
      currency: { code: "JPY", symbol: "¥", name: "日圓" },
      tips: "自駕最方便；冬季 18–22°C，海邊風大。國際駕照不通用，需備駕照日文譯本。",
      checklist: ["護照", "駕照日文譯本 ＋ 台灣駕照正本", "租車確認信", "Visit Japan Web", "防風外套", "折疊傘", "車用充電線與手機支架"],
      spots: [
        { name: "美麗海水族館", desc: "黑潮之海鯨鯊，15:00 餵食解說；園區內海豚秀免費。", tag: "門票", cost: 2180 },
        { name: "古宇利大橋", desc: "2 公里跨海大橋，橋前展望停車場最好拍。", tag: "必拍" },
        { name: "古宇利島 心形岩", desc: "退潮時可走到岩石前。", tag: "" },
        { name: "萬座毛", desc: "象鼻岩斷崖，早上人最少。", tag: "門票", cost: 100 },
        { name: "殘波岬燈塔", desc: "2 公里長斷崖與白色燈塔，可付費登塔。", cost: 300 },
        { name: "美國村", desc: "摩天輪、Depot Island、Sunset Beach，町營停車場免費。", tag: "" },
        { name: "海中道路", desc: "橫跨海面 4.7 公里的筆直大道，沖繩最好開的一段路。", tag: "自駕" },
        { name: "勝連城跡", desc: "世界遺產高台城跡，可俯瞰中城灣。", tag: "門票", cost: 600 },
        { name: "今歸仁城跡", desc: "世界遺產山城，蜿蜒石牆與海景。", tag: "門票", cost: 600 },
        { name: "備瀨福木林道", desc: "百年福木林蔭道，傍晚光線最美。", tag: "" },
        { name: "大石林山", desc: "沖繩最北端奇岩步道，4 條難易路線。", tag: "門票", cost: 1200 },
        { name: "邊戶岬", desc: "本島最北端斷崖，風非常大。", tag: "" },
        { name: "玉泉洞・沖繩世界文化王國", desc: "890 公尺鐘乳石洞與 Eisa 太鼓舞，約需 2.5 小時。", tag: "門票", cost: 2000 },
        { name: "齋場御嶽", desc: "琉球最高聖地，需先到南城市地域物產館購票。", tag: "門票", cost: 300 },
        { name: "知念岬公園", desc: "免費，三面環海的草地岬角。", tag: "" },
        { name: "瀨長島 Umikaji Terrace", desc: "白色階梯商店街，看飛機低空降落與夕陽。", tag: "夕陽" },
        { name: "國際通", desc: "那霸主街，藥妝與伴手禮一次買齊。", tag: "購物" },
        { name: "第一牧志公設市場", desc: "樓下買、樓上煮，旁邊接平和通商店街。", tag: "" },
        { name: "道之驛 許田", desc: "北部門戶休息站，水族館門票在此買較便宜。", tag: "折扣" },
        { name: "真榮田岬・青之洞窟", desc: "浮潛名點，冬季水溫約 22°C 需防寒衣。", tag: "" },
        { name: "御菓子御殿 讀谷本店", desc: "紅芋塔大本營，可宅配。", tag: "伴手禮" },
        { name: "東南植物樂園", desc: "冬季限定夜間燈飾，出發前確認點燈期間。", tag: "冬季限定", cost: 1900 }
      ]
    },
    {
      id: "tokyo", name: "東京", eyebrow: "TOKYO",
      currency: { code: "JPY", symbol: "¥", name: "日圓" },
      tips: "地鐵為主，建議 Suica／PASMO 感應卡。市區塞車嚴重，不建議自駕。",
      checklist: ["護照", "Suica／PASMO 或手機錢包", "Visit Japan Web", "好走的鞋", "折疊傘"],
      spots: [
        { name: "淺草寺・雷門", desc: "仲見世通商店街，早上人最少。", tag: "" },
        { name: "東京晴空塔", desc: "展望台需預約，日落時段最搶手。", tag: "門票", cost: 2100 },
        { name: "澀谷 SCRAMBLE SQUARE", desc: "SHIBUYA SKY 露天展望台，需線上預約。", tag: "門票", cost: 2200 },
        { name: "新宿御苑", desc: "都心大庭園，春櫻秋楓。", tag: "門票", cost: 500 },
        { name: "明治神宮", desc: "原宿站旁的森林參道。", tag: "" },
        { name: "築地場外市場", desc: "海鮮早餐，多數店家中午前收攤。", tag: "早餐" },
        { name: "teamLab", desc: "數位藝術展館，務必先線上購票。", tag: "門票", cost: 3800 },
        { name: "上野公園・博物館群", desc: "國立博物館、動物園、美術館集中區。", tag: "" },
        { name: "台場", desc: "海濱購物與夜景，百合海鷗號沿線。", tag: "" },
        { name: "鎌倉一日", desc: "江之電沿線、大佛、由比濱，從新宿約 1 小時。", tag: "一日行程" }
      ]
    },
    {
      id: "osaka", name: "大阪・京都", eyebrow: "KANSAI",
      currency: { code: "JPY", symbol: "¥", name: "日圓" },
      tips: "大阪住宿＋京都當日來回最省錢；關西周遊卡可涵蓋多數景點。",
      checklist: ["護照", "ICOCA 或手機錢包", "Visit Japan Web", "好走的鞋", "折疊傘"],
      spots: [
        { name: "大阪城公園", desc: "天守閣可登頂，公園免費。", tag: "門票", cost: 600 },
        { name: "道頓堀・心齋橋", desc: "固力果看板、藥妝與美食街。", tag: "購物" },
        { name: "環球影城 USJ", desc: "建議線上買快速通關，開園前 30 分鐘到。", tag: "門票", cost: 8600 },
        { name: "伏見稻荷大社", desc: "千本鳥居，清晨 7 點前幾乎無人。", tag: "" },
        { name: "清水寺・二年坂", desc: "京都經典路線，可順走祇園。", tag: "門票", cost: 400 },
        { name: "嵐山・竹林小徑", desc: "順走渡月橋與天龍寺。", tag: "" },
        { name: "金閣寺", desc: "晴天反射最漂亮。", tag: "門票", cost: 500 },
        { name: "奈良公園・東大寺", desc: "餵鹿與大佛殿，從大阪約 45 分鐘。", tag: "一日行程" },
        { name: "神戶北野異人館", desc: "可順道吃神戶牛。", tag: "" },
        { name: "黑門市場", desc: "海鮮與水果現吃。", tag: "美食" }
      ]
    },
    {
      id: "hokkaido", name: "北海道", eyebrow: "HOKKAIDO",
      currency: { code: "JPY", symbol: "¥", name: "日圓" },
      tips: "冬季自駕需雪胎與四驅，新手建議搭 JR；夏季自駕最舒服。",
      checklist: ["護照", "駕照日文譯本（自駕）", "Visit Japan Web", "保暖衣物與防滑鞋", "護唇膏與乳液"],
      spots: [
        { name: "小樽運河", desc: "傍晚點燈最美，玻璃工房與音樂盒堂。", tag: "" },
        { name: "札幌大通公園", desc: "電視塔、時計台，冬季雪祭場地。", tag: "" },
        { name: "二条市場", desc: "海鮮丼早餐。", tag: "早餐" },
        { name: "登別地獄谷", desc: "火山地形與溫泉區。", tag: "" },
        { name: "洞爺湖", desc: "湖景與溫泉飯店。", tag: "" },
        { name: "美瑛 青池", desc: "冬季有夜間點燈。", tag: "" },
        { name: "富良野 富田農場", desc: "夏季薰衣草，7 月最盛。", tag: "季節限定" },
        { name: "函館山夜景", desc: "纜車上山，日落前 30 分鐘到最好。", tag: "夜景" },
        { name: "旭山動物園", desc: "冬季企鵝散步為招牌。", tag: "門票", cost: 1000 }
      ]
    },
    {
      id: "seoul", name: "首爾", eyebrow: "SEOUL",
      currency: { code: "KRW", symbol: "₩", name: "韓元" },
      tips: "地鐵便宜方便，T-money 卡可搭車與便利商店消費。",
      checklist: ["護照", "K-ETA（依規定確認）", "T-money 卡", "好走的鞋", "轉接頭（圓形雙孔）"],
      spots: [
        { name: "景福宮", desc: "穿韓服可免門票，守門將換崗表演。", tag: "門票", cost: 3000 },
        { name: "北村韓屋村", desc: "住宅區，請降低音量。", tag: "" },
        { name: "明洞", desc: "美妝與街頭小吃。", tag: "購物" },
        { name: "弘大", desc: "年輕商圈與街頭表演，夜生活。", tag: "" },
        { name: "N 首爾塔", desc: "南山纜車上山看夜景。", tag: "門票", cost: 21000 },
        { name: "廣藏市場", desc: "綠豆煎餅、生牛肉拌飯。", tag: "美食" },
        { name: "梨泰院・經理團路", desc: "咖啡廳與異國餐廳。", tag: "" },
        { name: "南怡島", desc: "從首爾約 1.5 小時，秋季銀杏最美。", tag: "一日行程" }
      ]
    },
    {
      id: "bangkok", name: "曼谷", eyebrow: "BANGKOK",
      currency: { code: "THB", symbol: "฿", name: "泰銖" },
      tips: "BTS／MRT 搭配 Grab 最有效率；曼谷塞車嚴重，尖峰時段避開叫車。",
      checklist: ["護照", "防曬與帽子", "薄外套（冷氣很強）", "腸胃藥", "Grab App"],
      spots: [
        { name: "大皇宮・玉佛寺", desc: "服裝需過膝且不露肩。", tag: "門票", cost: 500 },
        { name: "臥佛寺 Wat Pho", desc: "可順便體驗泰式按摩本店。", tag: "門票", cost: 300 },
        { name: "鄭王廟 Wat Arun", desc: "傍晚對岸拍最美。", tag: "門票", cost: 200 },
        { name: "洽圖洽週末市集", desc: "只有週末營業，早上去較涼。", tag: "購物" },
        { name: "ICONSIAM", desc: "河濱百貨，樓下有水上市場美食街。", tag: "" },
        { name: "考山路", desc: "背包客街區，夜間熱鬧。", tag: "" },
        { name: "大城 Ayutthaya", desc: "古都遺跡，從曼谷約 1.5 小時。", tag: "一日行程" },
        { name: "Asiatique 河濱夜市", desc: "摩天輪與河景。", tag: "夜市" }
      ]
    },
    {
      id: "danang", name: "峴港・會安", eyebrow: "DA NANG",
      currency: { code: "VND", symbol: "₫", name: "越南盾" },
      tips: "包車一日遊便宜且省事；金額後面零很多，換算要小心。",
      checklist: ["護照（效期 6 個月）", "電子簽證", "防蚊液", "防曬", "現金小鈔"],
      spots: [
        { name: "巴拿山 佛手黃金橋", desc: "纜車上山，山上溫度低 10°C。", tag: "門票", cost: 900000 },
        { name: "會安古鎮", desc: "傍晚點燈與放水燈。", tag: "" },
        { name: "五行山", desc: "石窟與觀景台，有電梯。", tag: "門票", cost: 40000 },
        { name: "美溪沙灘", desc: "日出很值得早起。", tag: "" },
        { name: "山茶半島 靈應寺", desc: "白色觀音像與海景。", tag: "" },
        { name: "粉紅教堂", desc: "市區地標，拍照點。", tag: "" },
        { name: "韓江龍橋", desc: "週末夜間噴火表演。", tag: "夜景" }
      ]
    },
    {
      id: "singapore", name: "新加坡", eyebrow: "SINGAPORE",
      currency: { code: "SGD", symbol: "S$", name: "新加坡幣" },
      tips: "地鐵可直接感應信用卡；全年濕熱，午後常雷陣雨。",
      checklist: ["護照", "SG Arrival Card（入境前 3 天填）", "折疊傘", "薄外套（冷氣強）", "防曬"],
      spots: [
        { name: "濱海灣花園", desc: "擎天樹燈光秀 19:45 與 20:45。", tag: "門票", cost: 28 },
        { name: "金沙空中花園", desc: "無邊際泳池限住客，觀景台需另購票。", tag: "門票", cost: 32 },
        { name: "聖淘沙・環球影城", desc: "建議一整天。", tag: "門票", cost: 82 },
        { name: "新加坡動物園", desc: "夜間動物園是另一張票。", tag: "門票", cost: 51 },
        { name: "牛車水", desc: "中國城，美食街便宜好吃。", tag: "美食" },
        { name: "小印度", desc: "彩色屋與香料市場。", tag: "" },
        { name: "克拉碼頭", desc: "河畔酒吧與夜遊船。", tag: "夜景" }
      ]
    },
    {
      id: "hongkong", name: "香港", eyebrow: "HONG KONG",
      currency: { code: "HKD", symbol: "HK$", name: "港幣" },
      tips: "八達通最方便；週末景點人潮很多，平日出遊差很多。",
      checklist: ["護照", "港簽或入境登記", "八達通", "好走的鞋", "薄外套"],
      spots: [
        { name: "太平山頂", desc: "山頂纜車需排隊，傍晚上山看夜景。", tag: "門票", cost: 148 },
        { name: "星光大道・維港", desc: "20:00 幻彩詠香江燈光秀。", tag: "夜景" },
        { name: "天壇大佛・寶蓮寺", desc: "昂坪 360 纜車。", tag: "門票", cost: 270 },
        { name: "旺角女人街", desc: "街市購物。", tag: "購物" },
        { name: "廟街夜市", desc: "夜間排檔。", tag: "夜市" },
        { name: "迪士尼樂園", desc: "全球最小但排隊也最短。", tag: "門票", cost: 639 },
        { name: "南丫島", desc: "從中環搭船約 30 分鐘，海鮮與步道。", tag: "一日行程" }
      ]
    },
    {
      id: "custom", name: "其他（自行輸入）", eyebrow: "TRIP",
      currency: { code: "JPY", symbol: "¥", name: "日圓" },
      tips: "",
      checklist: ["護照", "簽證／入境登記", "機票與訂房確認信", "網卡或漫遊", "轉接頭", "常用藥品"],
      spots: []
    }
  ]
};

/* ============================================================
 * data-holland.js · 霍兰德职业兴趣（O*NET Interest Profiler 双版本）v1
 * ------------------------------------------------------------
 * 依据：U.S. Department of Labor, Employment & Training
 *   Administration — O*NET Career Exploration Tools：
 *   - Interest Profiler Short Form（60 题，每型 10 题）paper-and-pencil
 *   - Mini Interest Profiler（Mini-IP，30 题，每型 5 题；Rounds et al., 2016）
 *   两者均与 Holland（RIASEC）六型职业兴趣结构一致。
 *
 * 许可与署名（重要）：
 *   O*NET Career Exploration Tools 并非公共领域，其再分发/改编按官方
 *   Career Exploration Tools License（含 Creative Commons 选项）授权：
 *   使用与再分发须保留版权与商标声明，遵循 O*NET® 商标使用规则，并标注
 *   来源（U.S. Department of Labor, Employment and Training Administration,
 *   O*NET Interest Profiler；https://www.onetcenter.org/IP.html）。
 *   本文件为中文忠实编译（官方题面为英文工作活动描述），未增删题项：
 *   quick（精简版 30 题）= 官方 Mini-IP 全集
 *   full （完整版 60 题）= 官方 Short Form 全集
 * 作答：5 点"喜欢程度"（1 很不喜欢 → 5 非常喜欢），计分按六型求和。
 * ============================================================ */
(function (global) {
  'use strict';

  var LIKE5 = [
    { v: 1, label: '很不喜欢' }, { v: 2, label: '不太喜欢' }, { v: 3, label: '一般 · 不确定' },
    { v: 4, label: '比较喜欢' }, { v: 5, label: '非常喜欢' }
  ];
  var o = { o: 2 }; // o=2：喜欢程度题（UI 显示"喜欢程度 · 1–5 分"）

  /* ---- 六型各自 10 题（印刷版官方顺序；前 5 条即 Mini-IP 该型题集） ---- */
  var SCALE = {
    R: [
      '制作橱柜等木质家具', '砌砖或铺贴瓷砖', '维修家用电器', '在养鱼场养殖鱼类', '组装电子元件',
      '开货车为办公楼和住宅送包裹', '在产品出厂前检验部件质量', '安装并维修门锁', '设置并操作机器生产产品', '扑救森林火灾'
    ],
    I: [
      '研发一种新药', '调查一场火灾的起因', '研究减少水污染的方法', '开发更准确的天气预报方法', '开展化学实验',
      '在生物学实验室做研究', '研究行星的运动', '发明糖的替代品', '用显微镜检查血液样本', '做实验室检测以诊断疾病'
    ],
    A: [
      '写书或剧本', '为舞台剧绘制布景', '演奏一种乐器', '为电影或电视剧撰写剧本', '作曲或编曲',
      '表演爵士舞或踢踏舞', '画画', '在乐队里唱歌', '为电影制作特效', '剪辑电影'
    ],
    S: [
      '带一个人做健身操', '帮助他人处理个人或情绪困扰', '为他人提供职业方向指导', '从事康复理疗工作', '教儿童体育运动',
      '教听障人士手语', '协助主持团体心理治疗', '在日托中心照顾孩子', '在非营利组织做志愿服务', '给高中生上课'
    ],
    E: [
      '买卖股票和债券', '谈判商业合同', '经营一家零售门店', '代理客户出庭应诉', '经营美容院或理发店',
      '为新一季服装做市场推广', '管理大型公司中的一个部门', '在百货商场销售商品', '创办自己的公司', '管理一家服装店'
    ],
    C: [
      '用电脑软件制作电子表格', '核算员工工资', '校对记录或表单', '用手持设备盘点库存', '为大型网络统一安装软件',
      '登记租金收款', '用计算器处理数据', '维护库存台账', '记录货运与收发信息', '为单位分拣、盖章并分发邮件'
    ]
  };
  /* Mini-IP 官方 30 题在各型印刷顺序中的题位（Appendix A） */
  var MINI_POS = {
    R: [0, 2, 4, 5, 6], // Build / Repair household / Assemble / Drive truck / Test quality
    I: [0, 2, 4, 8, 3], // Develop medicine / Pollution / Chem / Blood / Predict weather
    A: [0, 4, 8, 1, 3], // Books / Compose / SFX / Paint sets / Scripts
    S: [1, 2, 3, 8, 9], // Help problems / Career / Rehab / Volunteer / High-school
    E: [6, 8, 1, 5, 7], // Manage dept / Start / Negotiate / Market / Sell
    C: [4, 6, 8, 3, 9]  // Install software / Calculator / Shipping / Handheld / Stamp mail
  };
  var ORDER = ['R', 'I', 'A', 'S', 'E', 'C'];

  function item(k, idx) {
    return { id: 'h' + String(k) + String(idx + 1), g: k, o: 2, r: 0, q: SCALE[k][idx], p: LIKE5 };
  }
  /* quick：官方 Mini-IP 全集（RIASEC 轮转的官方建议顺序） */
  function buildQuick() {
    var bank = [];
    for (var i = 0; i < 30; i++) {
      var k = ORDER[i % 6];
      bank.push(item(k, MINI_POS[k][Math.floor(i / 6)]));
    }
    return bank;
  }
  /* full：官方 Short Form 全集（按印刷版各型顺序 + RIASEC 轮转呈现） */
  function buildFull() {
    var bank = [];
    for (var r = 0; r < 10; r++) {
      for (var s = 0; s < 6; s++) bank.push(item(ORDER[s], r));
    }
    return bank;
  }
  var bankQuick = buildQuick();
  var bankFull = buildFull();
  bankQuick.variant = 'quick';
  bankFull.variant = 'full';

  var typeNames = {
    R: '现实型', I: '研究型', A: '艺术型', S: '社会型', E: '企业型', C: '常规型'
  };

  global.Innerway = global.Innerway || {};
  global.Innerway.holland = {
    variants: {
      quick: { key: 'quick', label: '快速测试 · 精简版 30 题', en: 'Mini-IP · 30', duration: '约 4–6 分钟', total: 30, hint: '以下都是具体的工作活动。请凭第一感觉判断你对它的喜欢程度（不是能力，也不是收入）：越靠右越喜欢。', bank: bankQuick },
      full: { key: 'full', label: '完整测试 · 标准版 60 题', en: 'Short Form · 60', duration: '约 8–12 分钟', total: 60, hint: '以下都是具体的工作活动。请凭第一感觉判断你对它的喜欢程度（不是能力，也不是收入）：越靠右越喜欢。', bank: bankFull }
    },
    typeNames: typeNames
  };
})(window);

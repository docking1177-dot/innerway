/* ============================================================
 * data.js · 测评门类 / 演示题库 / 解读素材
 * ------------------------------------------------------------
 * 重要：当前题库为「演示题库·结构样例」，用于跑通完整交互链路，
 * 不构成任何正式心理测量量表。正式题目需由内容与心理测量团队
 * 依照 docs/测评数据与算法说明.md 中的 schema 补充后替换。
 * ============================================================ */
(function (global) {
  'use strict';

  const CATEGORIES = [
    {
      id: 'tat',
      name: '意象叙事 · TAT',
      en: 'Storytelling · Thematic Apperception',
      icon: 'book-user',
      tint: '#7C8A9B',           // 雾蓝灰（安静内省）
      tintSoft: '#E3E7EC',
      engine: 'tat',
      open: true,
      demo: true,
      featured: true,            // 首推门类：置顶展示并加金色徽章（文案用邀请式表述，避免商业化口吻）
      bankVersion: 1,
      duration: '10 幅意象 · 每题约 2–3 分钟 · 写满 2 幅即可提交',
      tag: '故事写作 · 写 2 幅即可提交',
      desc: '受主题统觉测验（Morgan & Murray 的投射方法）启发：给你十幅原创多义意象图，请凭第一直觉为想写的画面讲一个“有前因、有当下、有结局”的故事，每题约 2–3 分钟，写下 2 幅以上即可提前提交，再由 AI 温柔回看故事里的你。图版为本站原创，无计分常模、非诊断。'
    },
    {
      id: 'mbti',
      name: 'MBTI 性格类型',
      en: 'Type Indicator · 自研题本',
      icon: 'compass',
      tint: '#9A7B60',           // 陶土
      tintSoft: '#F0E4D3',
      engine: 'mbti',
      open: true,
      demo: true,
      bankVersion: 2,            // v2 = 48 题原创题本（基于荣格《心理类型》四维框架，非官方 MBTI® 量表）
      duration: '48 题 · 约 8–12 分钟',
      tag: '48 题 · 5 点量表',
      desc: '以左右成对的场景化描述，从精力、认知、决策与生活方式四维探测你的偏好强度与四字母类型代码。自研 48 题题本，非 MBTI® 官方测评，与 The Myers-Briggs Company 无关联。'
    },
    {
      id: 'holland',
      name: '霍兰德职业兴趣',
      en: 'O*NET Interest Profiler',
      icon: 'briefcase',
      tint: '#77836B',           // 鼠尾草绿
      tintSoft: '#E4E7D9',
      engine: 'holland',
      open: true,
      demo: true,
      bankVersion: 1,            // v1 = O*NET Interest Profiler（按 Career Exploration Tools License 许可使用/改编，须保留版权与商标声明）
      duration: '60 题 · 约 8–12 分钟',
      tag: '60 题 · 5 点量表',
      desc: '依据美国劳工部（US DOL）O*NET® Interest Profiler（Holland RIASEC 六型模型）编译的完整版 60 题，每型 10 题。O*NET® 为美国劳工部商标。'
    },
    {
      id: 'darktriad',
      name: '暗黑人格 Dark Triad',
      en: 'Short Dark Triad · SD3',
      icon: 'eye',
      tint: '#8A6E8C',           // 低饱和紫灰
      tintSoft: '#EAE2EA',
      engine: 'darktriad',
      open: true,
      demo: false,
      duration: '27 题 · 约 5 分钟',
      tag: 'SD3 · 27 题',
      scale: 'sd3',
      desc: '基于 Jones & Paulhus (2014) 开发的 Short Dark Triad（SD3）完整 27 题：从马基雅维利主义、自恋与精神病态三个维度评估"暗黑三特质"（亚临床、非诊断）。'
    },
    {
      id: 'mhealth',
      name: '心理健康自评',
      en: 'PHQ-9 · GAD-7 · Mental Health',
      icon: 'activity',
      tint: '#6E8B7A',           // 鼠尾草绿（沉静治愈）
      tintSoft: '#DFE8E1',
      engine: 'mhealth',
      open: true,
      demo: false,
      duration: '16 题 · 约 3 分钟',
      tag: 'PHQ-9 + GAD-7 · 16 题',
      scale: 'main',
      desc: '完整收录公共领域量表 PHQ-9（抑郁筛查 9 题）与 GAD-7（焦虑筛查 7 题）的中文官方译版，逐题未增删，用于回顾「过去两周」的抑郁与焦虑症状频率。属筛查工具，不构成临床诊断。'
    },
    {
      id: 'bigfive',
      name: '大五人格 · 完整版',
      en: 'IPIP-NEO-120 · Big Five',
      icon: 'feather',
      tint: '#B08D57',           // 金
      tintSoft: '#F1E7CE',
      engine: 'bigfive',
      open: true,
      demo: false,
      duration: '120 题 · 约 15–20 分钟',
      tag: '120 题 · 5 点量表',
      desc: 'IPIP-NEO-120 完整版：在开放性、尽责性、外向性、宜人性、神经质五域下的 30 个子维度上描绘你的人格剖面（公共领域量表，中文译制）。'
    },
    {
      id: 'repression',
      name: '性压抑心理评估',
      en: 'Sexual Repression Index',
      icon: 'shield',
      tint: '#A9826A',           // 沙陶
      tintSoft: '#F0E3D6',
      engine: 'repression',
      open: true,
      demo: true,
      bankVersion: 1,
      duration: '126 题 · 约 25–40 分钟',
      tag: '18+ 评估',
      desc: '改编自开源 SRI 项目（SIS/SES、Mosher、KISS-9、SOS 等公开量表），从回避、内疚、羞耻与抑制四个维度，输出 0–100 压抑指数。'
    },
    {
      id: 'control',
      name: '控制欲心理评估',
      en: 'Desire for Control & Relationship Control',
      icon: 'shield-check',
      tint: '#8C7AA6',           // 紫灰
      tintSoft: '#EFEAF5',
      engine: 'control',
      open: true,
      demo: true,
      bankVersion: 1,
      duration: '47 题 · 约 12–18 分钟',
      tag: '动机 + 行为 · 47 题',
      desc: '基于公开量表构念的本土化改编，一次作答含两卷：控制欲动机（20 题，测「想要掌控」的内在倾向）与亲密关系控制行为（27 题，测实际实施控制行为的频率），交卷后分别给出两份剖面（非原版量表、非诊断）。'
    },
    {
      id: 'spatial',
      name: '空间偏好',
      en: 'Hotspot Scene Preference',
      icon: 'map-pin',
      tint: '#6E8B7A',           // 沉静绿
      tintSoft: '#DFE8E1',
      engine: 'spatial',
      open: true,
      demo: true,
      bankVersion: 1,
      duration: '4 场景 · 约 1–2 分钟',
      tag: '热区情境 · 体验',
      desc: '在咖啡馆、图书馆、聚会与旅行四种场景图上直接点击你“最可能待的位置”。以空间站位反映你对人际接近与独处的偏好方向（探索性参考，非正式量表）。'
    }
  ];

  /* 平台概况（首页统计条，演示版数据随门类动态计算） */
  const PLATFORM_NOTE = [
    { label: '在架测评门类', icon: 'layers' },
    { label: '即刻可测（演示题库）', icon: 'sparkles' },
    { label: '本设备已存报告', icon: 'file-text' }
  ];

  /* ---------- 霍兰德 RIASEC 解读素材 ---------- */
  const HOLLAND_DIM = {
    R: { name: '现实型 Realistic', trait: '偏好与物打交道，动手解决具体问题，踏实务实。', career: ['工程技术', '制造运维', '农林园艺'] },
    I: { name: '研究型 Investigative', trait: '偏好观察分析与理性探究，享受钻研抽象问题。', career: ['科学研究', '数据分析', '医疗与研发'] },
    A: { name: '艺术型 Artistic', trait: '偏好自由表达与创新，重视美感与独特性。', career: ['创意设计', '内容创作', '艺术传媒'] },
    S: { name: '社会型 Social', trait: '偏好助人互动与团队协作，关注他人成长。', career: ['教育咨询', '心理辅导', '公共服务'] },
    E: { name: '企业型 Enterprising', trait: '偏好影响说服与目标驱动，享受组织与竞争。', career: ['经营管理', '市场销售', '创业'] },
    C: { name: '常规型 Conventional', trait: '偏好规则秩序与数据整理，细致可靠有条理。', career: ['财务管理', '行政管理', '运营支持'] }
  };

  global.Innerway = global.Innerway || {};
  global.Innerway.data = {
    CATEGORIES: CATEGORIES,
    PLATFORM_NOTE: PLATFORM_NOTE,
    getCategory: function (id) { return CATEGORIES.find(function (c) { return c.id === id; }) || null; },
    // 题库统一入口：mbti 固定题库；多版本门类按 variant 取（holland: quick/full；repression: quick/full；control: doc/cbs；darktriad: sd3）
    getBank: function (id, variant) {
      if (id === 'mbti') return (global.Innerway.bankMBTI || []); // 正式版题库见 js/data-mbti48.js
      const info = this.getVariantInfo(id, variant);
      return info ? info.bank : [];
    },
    getVariantInfo: function (id, variant) {
      let src = null;
      if (id === 'holland') src = (global.Innerway.holland && global.Innerway.holland.variants) || null;
      if (id === 'repression') src = (global.Innerway.repression && global.Innerway.repression.variants) || null;
      if (id === 'control') src = (global.Innerway.control && global.Innerway.control.variants) || null;
      if (id === 'darktriad') src = (global.Innerway.darktriad && global.Innerway.darktriad.variants) || null;
      if (id === 'bigfive') src = (global.Innerway.bigfive && global.Innerway.bigfive.variants) || null;
      if (id === 'mhealth') src = (global.Innerway.mhealth && global.Innerway.mhealth.variants) || null;
      if (id === 'spatial') src = (global.Innerway.spatial && global.Innerway.spatial.variants) || null;
      if (id === 'tat') src = (global.Innerway.tat && global.Innerway.tat.variants) || null;
      if (!src) return null;
      const first = Object.keys(src)[0];
      const key = (variant && src[variant]) ? variant : (first || null);
      return key ? src[key] : null;
    },
    HOLLAND_DIM: HOLLAND_DIM
  };
})(window);

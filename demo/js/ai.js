/*
 * ai.js · AI 深度解读接入层（OpenAI 兼容接口）
 * ------------------------------------------------------------
 * 双模式：
 * - 代理模式（默认）：接口地址留空 → 请求同域 /ai/chat/completions，
 *   由服务端（Cloudflare Worker / Nginx 等，见仓库 ai-proxy/）持有 API Key
 *   并转发 DeepSeek，访客无需填写 Key，Key 不出前端。
 * - 直连模式：在「AI 设置」填写完整接口地址与自己的 API Key，
 *   浏览器直连该接口（如官方 https://api.deepseek.com）。
 * 设计原则：
 * - 配置仅保存在本机 localStorage（iw.ai.cfg），不会上传到任何第三方。
 * - 安全提示：直连模式的 Key 请勿硬编码进文件或提交仓库；在「AI 设置」中填写。
 */
(function (global) {
  'use strict';

  var CFG_KEY = 'iw.ai.cfg';
  var CACHE_PREFIX = 'iw.ai.';

  // 全门类统一的 AI 解读小节（页面按“## 标题”自动排版）。
  // 正文第一段为「一句话总览」（不设标题）；命中风险题时在总览后、其余小节前追加风险模块。
  var UNI_SECTIONS = ['作答风格画像', '维度得分拆解', '立体画像描述', '核心建议', '说明与免责'];
  var RISK_SECTION = '⚠️ 风险提示（请认真对待）';

  // 各门类「特殊适配」：写法侧重 + 语言红线（写入 AI 角色设定，保证所有门类都有适配）
  var CAT_ADAPT = {
    mbti: {
      kind: '人格类型',
      note: '重点讲偏好（倾向）而非定论：把 MBTI 四个维度当作“你在哪些情境下更自然”的参考，讲清每个倾向在生活/工作/关系中的优势与盲区。建议聚焦“如何发挥优势 + 规避盲区”；若要提及职业，只给方向性提示并说明需与个人兴趣、能力组合判断，不做“你适合/不适合某职业”的绝对结论。'
    },
    bigfive: {
      kind: '大五人格特质',
      note: '展示五域与子维度的相对强弱，突出“特质 × 情境”的相互作用；把高分或低分讲成风格差异而非高低对错，不用单一维度给人定型。建议聚焦可观察的行为模式与自我调节。'
    },
    holland: {
      kind: '职业兴趣',
      note: '重点讲兴趣组合的独特性、天然的优势场景与可能的互补发展区。发展建议聚焦“下一步可以探索什么”（如课程、实践、访谈），避免“你只能做 XX / 你适合当 XX”等绝对化结论。'
    },
    repression: {
      kind: '性心理',
      note: '全程去道德化、去羞耻化：把差异讲成“差异而非异常”，不使用带评判或暗示对错的语言，不渲染、不猎奇。建议聚焦自我接纳、与伴侣/信任者的沟通、以及适度寻求专业帮助。'
    },
    control: {
      kind: '关系与动机',
      note: '区分“想要掌控的动机”（可以被理解的需求）与“实际发生的控制行为”（可改变的行为频率）；不给人贴“控制狂”一类标签。解读语气温和、不指责，建议聚焦关系沟通、边界与替代行为。'
    },
    darktriad: {
      kind: '人格暗面特质（亚临床自评）',
      note: '把得分当作亚临床的自评倾向而非诊断或人格定论；不渲染恐惧、不污名化，避免把马基雅维利/自恋/精神病态讲成“你就是这种人”。温和呈现其潜在影响（含对关系的代价），并给出可操作的自我观察方向。'
    },
    mhealth: {
      kind: '心理健康自评',
      note: '围绕“症状频率与功能影响”展开，不使用“你患有…”式诊断表述；建议聚焦可执行的行为调整与求助路径。若命中风险项，必须把风险模块放在靠前、单独的位置严肃处理（见风险要求）。'
    },
    spatial: {
      kind: '空间偏好（热区情境）',
      note: '本卷以咖啡馆、图书馆、聚会与旅行等场景中的“位置选择”观察你靠近人群或独处的倾向方向。解读要点：把它当作行为偏好的探索性证据而非人格定论，综合四张图的整体倾向说话，避免把单次位置选择过度解读；语言平和、不贴标签，建议聚焦自我观察。'
    },
    tat: {
      kind: '意象叙事（TAT）',
      note: '本卷不做选择题，而是请用户为多义意象图讲故事，再由你温柔回看。解读目标不是给出性格标签或分数，而是陪伴用户“看见自己”：温和地指出故事里反复出现的主题、人物处境、情绪基调与结局方式，把故事当作用户内心世界的一面镜子。'
    }
  };
  var CAT_ADAPT_DEFAULT = {
    kind: '心理测评',
    note: '结合该测评自身的主题与维度结构解读，先讲整体结论，再分维度展开；语言温和、克制，建议具体可执行。'
  };

  var DEFAULTS = {
    // baseUrl 为空 = 本站 /ai 代理（服务端持 Key，访客免填）；非空 = 直连该接口
    baseUrl: '',
    model: 'deepseek-v4-flash',
    apiKey: ''
  };

  function readJSON(key, fallback) {
    try {
      var v = global.localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) { return fallback; }
  }
  function writeJSON(key, obj) {
    try { global.localStorage.setItem(key, JSON.stringify(obj)); } catch (e) { /* ignore */ }
  }

  /* ---------- 设置 ---------- */
  function getSettings() {
    var cfg = readJSON(CFG_KEY, {});
    return {
      baseUrl: (cfg.baseUrl || DEFAULTS.baseUrl).trim().replace(/\/+$/, ''),
      model: (cfg.model || DEFAULTS.model).trim(),
      apiKey: cfg.apiKey || ''
    };
  }
  function saveSettings(cfg) {
    cfg = cfg || {};
    var next = {
      baseUrl: (cfg.baseUrl || '').trim().replace(/\/+$/, ''),
      model: (cfg.model || DEFAULTS.model).trim(),
      apiKey: (cfg.apiKey || '').trim()
    };
    if (next.baseUrl && !/^https?:\/\//.test(next.baseUrl)) throw new Error('直连接口地址需以 http(s):// 开头；使用本站代理请将接口地址留空');
    if (!next.model) throw new Error('请填写模型名称');
    if (next.baseUrl && !next.apiKey) throw new Error('直连模式需要填写 API Key；使用本站代理请将接口地址留空');
    writeJSON(CFG_KEY, next);
    return next;
  }

  /* ---------- AI 生成内容缓存（按结果 ID 存于本机） ---------- */
  function readCache(resultId) {
    if (!resultId) return null;
    return readJSON(CACHE_PREFIX + resultId, null);
  }
  function writeCache(resultId, text) {
    if (!resultId) return;
    writeJSON(CACHE_PREFIX + resultId, { text: text, at: Date.now() });
  }

  /* ---------- Chat Completions ---------- */
  function chat(messages) {
    var cfg = getSettings();
    var direct = !!cfg.baseUrl;
    if (direct && !cfg.apiKey) {
      return Promise.resolve({ ok: false, code: 'no-key', message: '直连模式尚未填写 API Key，请在「AI 设置」中填写或改回本站代理。' });
    }
    var isDeepseek = /deepseek/i.test(cfg.baseUrl) || /deepseek/i.test(cfg.model);
    // 代理地址优先级：站点配置 aiProxyBase（如 Worker 域名）> 同域 /ai
    var proxyBase = ((global.IW_CONFIG && global.IW_CONFIG.aiProxyBase) || '').replace(/\/+$/, '');
    var url = direct ? cfg.baseUrl + '/chat/completions' : (proxyBase ? proxyBase + '/chat/completions' : '/ai/chat/completions');
    var headers = { 'Content-Type': 'application/json' };
    if (direct) headers['Authorization'] = 'Bearer ' + cfg.apiKey; // 代理模式由服务端注入 Key，前端不携带
    return global.fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        model: cfg.model,
        messages: messages,
        temperature: 0.8,
        max_tokens: 3200, // 统一结构解读可能到 1500 字（含 ##/### 标题与列表），给足输出额度
        // DeepSeek-V4 默认开启思考模式：思考会占用同一份输出额度，额度用尽时正文为空。
        // 站点场景为"读题写解读"，无需深度推理，故对 DeepSeek 默认关闭思考模式以稳定拿正文。
        thinking: isDeepseek ? { type: 'disabled' } : undefined
      })
    }).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return null; }).then(function (body) {
          var brief = '';
          if (body && body.error && body.error.message) brief = String(body.error.message).slice(0, 220);
          if (!direct && (res.status === 404 || res.status === 405 || res.status === 501)) {
            return { ok: false, code: 'proxy-404', message: '本站 AI 代理未生效（/ai 无响应）：请确认已部署代理服务；或在「AI 设置」填写直连接口地址与 API Key。' };
          }
          if (res.status === 401) return { ok: false, code: 'http-401', message: '鉴权失败（401）：请检查 API Key 是否正确、是否有该模型权限或余额。' };
          if (res.status === 429) return { ok: false, code: 'http-429', message: '请求过于频繁或被限流（429），请稍后重试或检查额度。' };
          return { ok: false, code: 'http-' + res.status, message: '请求失败（HTTP ' + res.status + '）' + (brief ? '：' + brief : '') };
        });
      }
      return res.json();
    }).then(function (data) {
      // 错误映射对象直接透传（避免被误当作上游 JSON 覆盖为"空内容"）
      if (data && data.ok === false) return data;
      if (!data) return { ok: false, code: 'empty', message: '接口无返回内容。' };
      var choice = data.choices && data.choices[0];
      var msg = choice && choice.message;
      var c = msg && msg.content;
      var text = '';
      if (typeof c === 'string') text = c;
      else if (Array.isArray(c)) text = c.map(function (x) { return (x && x.text) || ''; }).join('');
      if (!text || !text.trim()) {
        if (choice && choice.finish_reason === 'length') {
          return { ok: false, code: 'empty-length', message: '本次输出额度被占用导致正文为空：已默认关闭 DeepSeek 思考模式，请点「重新生成」再试；若仍为空，可在 AI 设置中更换模型或调大输出额度。' };
        }
        if (msg && (msg.reasoning_content || (c && c.thinking))) {
          return { ok: false, code: 'empty-thinking', message: '模型只返回了思考过程、未返回正文（思考模式与输出额度冲突）。请点「重新生成」再试；仍失败可更换模型。' };
        }
        return { ok: false, code: 'empty', message: '模型未返回文本内容，请重试或更换模型。' };
      }
      return { ok: true, text: text.trim() };
    }).catch(function (err) {
      return { ok: false, code: 'net', message: '网络请求失败：' + ((err && err.message) || '无法连接接口') + '。请确认已联网、接口地址可达且允许跨域。' };
    });
  }

  /* ================================================================
   * 通用「逐题原文」作答整理（适配站点所有量表题项结构）
   * 支持的题项形态：
   *   1. SR 型：{ q, p:[{v,label}], ... } —— 性压抑/控制欲/霍兰德/SD3/大五/心理健康
   *   2. MBTI 极点型：{ d, l, r, rev? } —— 左右描述 + 5 档
   *   3. 兜底：{ t/opts:[{t}] }
   * ================================================================ */
  var POLAR_CAP = ['明显偏左', '偏左', '中间', '偏右', '明显偏右'];

  function describeAnswer(it, raw) {
    raw = Math.max(0, Math.min(raw, 5));
    // 说明：输入给模型的内容只使用“人话”，不带“第 N 档 / 题号”等内部坐标，
    // 避免模型在面向用户的解读里复述这些对用户无意义的系统字眼。
    if (it && it.l && it.r) {
      var cap = POLAR_CAP[raw] || '中间';
      return { stem: '左：「' + it.l + '」 / 右：「' + it.r + '」', answer: cap };
    }
    var p = (it && it.p) || (it && it.opts) || [];
    var q = (it && (it.q || it.t)) || '';
    if (p && p.length && p[raw] != null) {
      var o = p[raw];
      var label = (o && o.label != null) ? o.label : ((o && o.t != null) ? o.t : '');
      return { stem: q, answer: '选择「' + label + '」' };
    }
    return { stem: q, answer: '已作答' };
  }

  // 通用结果摘要：从 rep 中尽量抽取「代码 / 结论 / 维度得分」文本（多种量表结构兼容）
  function repDigest(rep) {
    if (!rep) return [];
    var lines = [];
    if (rep.typeCode) lines.push('结果代码：' + rep.typeCode + (rep.typeName ? '（' + rep.typeName + '）' : ''));
    if (rep.scaleLabel) lines.push('量表版本：' + rep.scaleLabel);
    if (rep.tagline) lines.push('一句话结论：' + rep.tagline);
    var dims = rep.dims || rep.axes || rep.facets || rep.domains || rep.scales || [];
    (Array.isArray(dims) ? dims : []).slice(0, 14).forEach(function (d) {
      var bits = [];
      var nm = d.name || d.label || d.key || d.short || '';
      if (d.fav && d.fav.name) bits.push('更偏向「' + d.fav.name + '」');
      if (typeof d.score === 'number') bits.push('得分 ' + d.score);
      if (d.band && d.band.label) bits.push('区间「' + d.band.label + '」');
      if (typeof d.total === 'number' && typeof d.max === 'number') bits.push('累计 ' + d.total + '/' + d.max);
      if (typeof d.mean === 'number') bits.push('均分 ' + d.mean);
      if (typeof d.value === 'number') bits.push('强度 ' + Math.round(d.value) + '%');
      if (typeof d.avg === 'number') bits.push('均分 ' + d.avg);
      if (d.raw != null) bits.push('原始分 ' + d.raw);
      if (d.level && d.level.label) bits.push('水平「' + d.level.label + '」');
      if (bits.length) lines.push('维度「' + nm + '」：' + bits.join('，'));
    });
    if (rep.summary && rep.summary.length) {
      lines.push('摘要：' + rep.summary.slice(0, 3).join(' '));
    }
    var joined = lines.join('\n');
    if (joined.length > 1000) joined = joined.slice(0, 1000) + '…';
    return joined.split('\n');
  }

  // 逐题原文模式：整卷作答转为逐题记录（含组别/题干/所选项）
  function buildQuizPayload(opts) {
    var cat = opts.cat || {};
    var rec = opts.rec || {};
    var answers = opts.answers || rec.answers || {};
    var bank = (opts.bank || []).slice();
    var rep = opts.rep || rec.report || {};
    var items = [];
    var riskHit = null; // 命中的风险题（下标+1），仅当题项带 risk 标记或心理健康第 9 题触发
    bank.forEach(function (it, qi) {
      if (typeof answers[qi] !== 'number') return;
      var v = answers[qi];
      if (it && it.risk && v > 0 && riskHit === null) riskHit = qi + 1;
      var d = describeAnswer(it, v);
      var grp = (it && (it.dl || it.g || it.d)) || '';
      items.push({ n: qi + 1, group: grp, question: d.stem, answer: d.answer });
    });
    // 心理健康（PHQ-9 第 9 题，即全卷第 9 题）：选择任何非“完全没有”档即触发风险
    if (cat.id === 'mhealth' && riskHit === null && (Number(answers[8]) || 0) > 0) riskHit = 9;
    if (riskHit === null && rep && rep.riskItem9) riskHit = 9;
    // 每题原文做长度保护，防止超长卷面拉高 token
    items.forEach(function (it) {
      if (it.question && it.question.length > 200) it.question = it.question.slice(0, 200) + '…';
    });
    return {
      quizName: cat.name || '心理测评',
      categoryId: cat.id || rec.categoryId || '',
      tag: cat.tag || '',
      itemCount: bank.length,
      answeredCount: items.length,
      answers: items,
      digest: repDigest(rep),
      format: UNI_SECTIONS.slice(),
      risk: riskHit !== null,
      riskNo: riskHit
    };
  }

  /* ---------- 深度解读提示词（全门类统一结构 · 依门类做特殊适配） ---------- */
  function quizMessages(payload) {
    var adapt = (payload.categoryId && CAT_ADAPT[payload.categoryId]) || CAT_ADAPT_DEFAULT;
    var risk = !!payload.risk;
    var riskNo = payload.riskNo || null;
    var isMental = payload.categoryId === 'mhealth';
    var headings = UNI_SECTIONS.map(function (t) { return '## ' + t; });
    if (risk) headings.unshift('## ' + RISK_SECTION);

    var sys = '你是一位温暖、细腻、有同理心的倾听者，同时具备专业的心理测评解读能力。用户做测评主要是为了“更了解自己”，而不是被分析或被教育——你的首要任务是让用户感到被真正理解、被接纳，把数据读回成对用户自己的理解；建议只作为克制的轻量参考，绝不喧宾夺主。'
      + '你像一个耐心的朋友在陪用户回看自己的作答，而不是一个考官在审阅答卷。明确认可用户感受的合理性，例如“在那种情况下会这样想是很自然的”，但不要只说“我理解你”。'
      + '不要评判用户的做法是对是错，不要使用“你应该”“你不该”“建议你”等说教表达。不要急于给解决方案或建议。语气温暖、平和、真诚，避免过度煽情或夸张共情。'
      + '你只依据本次给出的数据说话：不臆测作答数据之外的信息，不做临床诊断，不给人格定论，不评判用户的道德或人格。'
      + '语言要求：用第二人称“你”，保持直接对话感；温暖但不煽情，专业但不冰冷；不说教、不套话；肯定用户如实作答、主动了解自己的行为。'
      + '报告是写给普通用户看的：不要复述任何统计元信息——题量、作答数、档位、题号等一律不出现（如“共 20 题”“实际作答 20 题”“第 4 档”这类字眼都不允许出现在正文里）。'
      + '硬性红线：禁止“你患有…”“你就是 XX 型 / XX 的人”等诊断式或定论式表达；涉及具体题目时只允许用题干关键词指代（如“睡眠困难那一题”），禁止出现“第 X 题”等题号字眼，也禁止整句复制测评题目原文；'
      + '禁止在没有命中风险题时编造风险模块；核心建议最多 3 条、且全篇篇幅占比很低；'
      + '禁止直接罗列原始数据堆叠或任何统计元信息（例如“各档位的选择次数”“多少题里选了多少次”“全卷共多少题、实际作答多少题”这类清单都不允许出现在正文里），必须把数据翻译成有温度的行为模式描述（如“你大多时候选择温和的中间立场，只在极少数话题上明确表态”），数字仅作隐含支撑、不得以统计句形式出现；'
      + '\n\n【本次门类 · ' + (adapt.kind || '心理测评') + '】' + (adapt.note || '')
      + (payload.quizName ? '\n本次测评：' + payload.quizName + (payload.tag ? '（' + payload.tag + '）' : '') : '');

    var head = '下面是一次心理测评（' + payload.quizName
      + '）的完整作答数据：每题题干原文与用户所选内容，以及系统计算的各维度得分与等级摘要。请只把这些数据当作理解用户的内部依据，不要复述题量、作答数或档位计数。'
      + (risk
        ? '\n\n警告：本次作答命中了风险类题目（即下方作答数据中题干涉及“自伤/伤害自己/不如死了”等含义的那一题）。你必须把「' + RISK_SECTION + '」小节放在“一句话总览”之后、其余所有小节之前，单独、严肃、完整地输出，绝不能把它弱化或归入“缓冲点/保护因素”。'
        : '')
      + '\n\n请撰写一份不超过 1500 字的中文解读，严格满足以下结构与格式要求：\n'
      + '1) 正文第一段直接给出【一句话总览】：用 1–2 句话概括本次测评最核心的画像，不使用专业术语，让用户立刻有“被看见”的感觉；不寒暄，不以“以下是/好的”等开头；\n'
      + '2) 其后严格按下列标题顺序输出；每个标题独占一行、以“## ”开头，标题文字不得增删改：\n'
      + headings.join('\n') + '\n'
      + '3) 「作答风格画像」：分析作答模式（倾向极端或居中、前后一致性、可能的掩饰/惯性倾向、对认真程度的观察等），把数据翻译成有温度的行为模式和感受描述——例如写成“你大多时候选择温和的中间立场，不轻易把话说满，也很少完全否定什么”，而不出现任何档位计数、题量统计或“第几档几次”式的句子；'
      + '数字只作隐含支撑、不直接罗列；当提到具体题目时，只用题干关键词指代这道题（例如“你在睡眠困难那一题选了几乎每天”），说明该题的选择如何呼应了整体模式，禁止出现任何题号；'
      + '全篇避免使用“从数据来看”“统计显示”“分析表明”等审视性开头，改用“翻完你的作答”“读下来最明显的是”“你可能常常会发现”等陪伴式表达；\n'
      + '4) 「维度得分拆解」：每个维度独立成块，以“### 📊 维度名：分数/等级”开头；先给加粗的得分结论（一句话说明分数意味着什么、避免模糊表述），'
      + '再列出 2–4 条“主要贡献题”（以题干关键词指代题目，如「睡眠困难题」，格式：关键词 - 所选选项 - 分值，并说明为何拉高/拉低了该维度），'
      + '最后列出“缓冲/资源题”（该维度中得分较低、说明用户仍保有资源的部分）；\n'
      + '5) 「立体画像描述」：用 200–300 字把数据还原成一个具体、立体的人；必须同时包含优势面与困扰面，不偏废；'
      + '可用 1 个贴切的比喻（至多 1 个）；禁止“你就是一个 XX 的人”式贴标签，改用“你可能常常感到…”“在……场景下，你倾向于……”等描述性语言；\n'
      + '6) 「核心建议」是本篇最轻量的部分：给 1–3 条“可以试试的小方向”即可（没有把握时可只给 1 条或省略），每条以“### 🎯 一句话标题”开头，'
      + '正文只写一两句可立即执行的简短做法，不展开长段的适用场景/预期效果；建议部分合计不超过全文的约六分之一，不要把解读写成“建议清单”；\n'
      + '7) 「说明与免责」：说明本解读基于本次自我作答，反映测评指定时间范围内的状态，非终身判定；'
      + (isMental || risk
        ? '并强调：如为心理健康类内容，症状持续或加重时请寻求精神科/心理科专业人员评估，紧急情况拨打全国心理援助热线 12356 或 120。'
        : '并说明人格/特质类内容无好坏之分，关键在于如何理解并运用自身特点。')
      + '\n'
      + (risk
        ? '【风险模块强制内容】在「' + RISK_SECTION + '」中必须包含：①明确指出风险题及用户的选择（只准用该题的关键词指代，如「自伤念头」一题，禁止出现任何题号），不淡化；'
          + '②给出具体求助渠道（全国心理援助热线 12356、身边信任的人、学校心理中心或就近医院精神科，紧急时拨打 120）；'
          + '③说明何时需要立即就医（如念头变得更频繁、出现具体计划、感到难以自控等）；④语气严肃但不恐吓，传递“这是可以解决的、你不需要独自面对”的信息。\n'
        : '')
      + '8) 排版：关键分数、等级与结论一律用 **加粗**；列表项以“- ”开头并单独成行；段落尽量短、多用分块与列表，移动端友好；\n'
      + '9) 页面会自动渲染“## / ###”标题与加粗，但不会渲染“> 引用块”与“---”分割线：请勿输出这两种语法，需要强调的内容直接放进对应小节并用加粗表达；\n'
      + '10) 整体信息密度优先、避免冗余铺垫；把主要篇幅用于帮用户“看懂自己”（作答风格、维度拆解、立体画像），建议只作收尾点缀；结尾不需要任何寒暄或署名。'
      + (payload.quizName ? '\n\n（用户完成的门类：' + payload.quizName + '。请先按数据客观解读，再结合门类特点自然组织语言，不要复述本要求。）' : '');

    var user = head + '\n\n作答与结果数据：\n' + JSON.stringify(payload, null, 2);
    return [{ role: 'system', content: sys }, { role: 'user', content: user }];
  }

  /* ================================================================
   * 意象叙事（TAT）· 专属深度解读
   * ----------------------------------------------------------------
   * 与选择题不同：本卷作答是用户为原创多义意象图写下的「故事」。
   * 解读不是评分，而是把故事当作讲述者内心世界的一面镜子，
   * 以温柔、细腻、有同理心、专注倾听的姿态陪伴用户看见自己。
   * 注意：图版为本站原创（仅借鉴 Morgan & Murray 的投射方法），
   * 提示词不得诱导模型“复述/匹配”任何外部 TAT 卡片编号或原版图。
   * ================================================================ */
  var TAT_SECTIONS = ['你写下的故事，我听见了', '反复浮现的线索', '故事里的人，与故事外的你', '藏在情节下的情绪与需要', '关系里那些没说出口的部分', '可以温柔留意的方向', '说明与免责'];

  // 把用户写的故事整理给模型：每题 { 画面意象(标题+客观描述), 用户故事原文 }
  function buildTatPayload(opts) {
    var cat = opts.cat || {};
    var rec = opts.rec || {};
    var answers = opts.answers || rec.answers || {};
    var bank = (opts.bank || []).slice();
    var stories = [];
    bank.forEach(function (it, qi) {
      if (!it || it.type !== 'story') return;
      var raw = answers[qi];
      var txt = (typeof raw === 'string') ? raw.trim() : '';
      if (!txt) return;
      stories.push({
        fig: it.title || ('第 ' + (qi + 1) + ' 幅画面'),
        scene: it.scene || '',
        text: txt.length > 1200 ? txt.slice(0, 1200) + '…' : txt
      });
    });
    return {
      quizName: cat.name || '意象叙事',
      categoryId: (cat.id || 'tat'),
      title: '意象叙事 · 主题统觉式自我探索',
      figureCount: stories.length,
      stories: stories,
      format: TAT_SECTIONS.slice()
    };
  }

  // TAT 深度解读提示词：温柔、细腻、有同理心的分析师 × 专注的倾听者
  function tatMessages(payload) {
    var sys = '你是一位温柔、细腻、有同理心的心理测评分析师，同时也是一位专注的倾听者。你具备主题统觉测验（Thematic Apperception Test, TAT）的专业解读能力，能够通过来访者对模糊图片所编写的故事，温和地引导其探索内在的动机、情感模式、关系议题和心理冲突。'
      + '你的核心信念是：**每个故事都是讲述者内心世界的一面镜子，你的工作不是评判，而是帮助来访者看见自己。**'
      + '因此你从不居高临下、不贴标签、不做“你就是 XX 型的人”式的断言，也不把故事当作“症状”来拆解；你只带着好奇与善意，把故事里值得被看见的部分轻轻指出来，让来访者自己决定要不要接住。'
      + '你只依据本次给出的故事说话：不臆测故事之外的经历，不做临床诊断，不评判道德与对错。故事是投射与想象，可能与现实有关，也可能只是随性的创作——你始终用“也许、可能、隐隐觉得”这类不武断的措辞，把解读权交还给来访者本人。'
      + '语言要求：用第二人称“你”，语气如一位耐心的朋友在深夜陪你回看自己写下的文字；温暖但不煽情，细腻但不啰嗦，专业术语要化作日常的话说出来。'
      + '报告是写给普通用户看的：不要复述任何统计元信息（如“共 4 个故事”“写了多少字”等一律不出现）。'
      + '引用故事时只允许用画面意象指代（例如“在窗边那幅画的故事里”“关于那扇半开的门”），禁止出现“第 1 幅/第 2 幅、第 X 题”等编号字眼，也禁止大段整句复述用户的故事原文——你只提炼细节与氛围，让用户感到“被读懂”而不是“被抄写”。'
      + '硬性红线：禁止“你患有…”“你就是 XX 型的人”等诊断式或定论式表达；不制造耸人听闻的结论；如某个故事透出明显的痛苦或自我伤害意味，请用温和而郑重的语气在「说明与免责」前单独提醒：可以联系身边信任的人或拨打全国心理援助热线 12356，紧急时拨打 120。'
      + '你最重要的姿态是倾听与陪伴：先让用户感到被看见、被接纳，再谈理解；不给超出 3 条的建议，且建议要落在“可以留意的方向”而非“你应该怎么做”。'
      + '\n\n【本次门类 · ' + '意象叙事（TAT）' + '】'
      + '以下给出用户在「' + (payload.quizName || '意象叙事') + '」中为一组原创多义意象图写下的故事。请以 TAT 的精神去读：关注故事主角是谁、有什么渴望与恐惧、与故事中其他人物如何相处、困境如何被处理、故事走向怎样的结局，以及这些元素如何在多个故事间反复出现。然后把这些观察温柔地交还给用户。';

    var head = '下面是一位来访者刚为几幅意象图写下的故事（图版为本站原创意象，不涉及任何外部测验卡片的编号与图样）。请只把这些故事当作理解这位来访者的内部依据，不要复述故事数量或字数。'
      + '\n\n请撰写一份不超过 1500 字的中文回看，严格满足以下结构与格式要求：\n'
      + '1) 正文第一段直接给出【一句话总览】：用 1–2 句话说出读完这些故事你最深的感受，不使用术语，让来访者立刻有“被看见”的感觉；不寒暄，不以“以下是/好的”开头；\n'
      + '2) 其后严格按下列标题顺序输出；每个标题独占一行、以“## ”开头，标题文字不得增删改：\n'
      + TAT_SECTIONS.map(function (t) { return '## ' + t; }).join('\n') + '\n'
      + '3) 「你写下的故事，我听见了」：逐个故事温柔回应（以实际写下的数量为准），每个故事 2–4 句：先点出你注意到的动人细节或氛围（只提炼、不整段复述），再说它让你联想到的可能含义；语气像在分享你的感受，而非下判断；\n'
      + '4) 「反复浮现的线索」：跨越多个故事指出反复出现的主题（如“总有人在等待”“故事总以离开收场”“困境里总有一个沉默的旁观者”），说明这种重复可能指向来访者内心真正在意的议题；若没有明显重复，就如实说“每个故事各自独立”，不强行归纳；\n'
      + '5) 「故事里的人，与故事外的你」：温和地讨论故事主角与来访者可能的相似处——主角面对选择时的姿态、与重要他人的距离、处理困境的方式，都可能是来访者内在关系模式的投影；始终用“也许”“有时候你也会…”等试探性语言，避免武断对应；\n'
      + '6) 「藏在情节下的情绪与需要」：指出故事字里行间透出的情绪（孤独、牵挂、渴望被理解、害怕失去等）与未被满足的需要，承认这些情绪的合理性，不评判、不夸大；\n'
      + '7) 「关系里那些没说出口的部分」：若故事涉及人物关系，温柔地点出其中可能未被言明的张力或渴望（如靠近与疏远、给予与索取）；若故事几乎不涉及他人，可以轻轻提及“这些故事里，人物常常独自一人”这一观察本身可能意味着什么；\n'
      + '8) 「可以温柔留意的方向」：给 1–3 条轻柔的自我观察方向即可（如“留意现实里，你在等什么、又在躲什么”），每条以“### 🍃 一句话标题”开头，正文一两句，不说教、不给人生建议清单；若没有把握可只给 1 条或省略；\n'
      + '9) 「说明与免责」：说明意象叙事是自我探索练习而非诊断；故事反映的是“此刻的你在如何讲故事”，会随心境变化，不是固定的人格结论；如需更深入的自我探索，可考虑与信任的人或专业人士聊聊。\n'
      + '10) 排版：重要感受与关键词用 **加粗**；列表项以“- ”开头并单独成行；段落短、多用分块，移动端友好；不输出“> 引用块”与“---”分隔线（页面不渲染）；结尾不需要任何寒暄或署名。'
      + (payload.stories && payload.stories.length ? '\n\n（用户刚完成 ' + payload.quizName + '。请按上面的方式组织语言，不要复述本要求。）' : '');

    var user = head + '\n\n用户写下的故事：\n' + JSON.stringify(payload.stories || [], null, 2);
    return [{ role: 'system', content: sys }, { role: 'user', content: user }];
  }

  /* ================================================================
   * 跨测评「完整人格档案」：汇总同一用户多份结果，供 AI 综合画像
   * ================================================================ */
  function buildProfilePayload(results, cats) {
    var catMap = {};
    (cats || []).forEach(function (c) { catMap[c.id] = c; });
    var list = (results || []).filter(function (r) { return r && r.report; });
    var mentalAlert = false;
    var mentalRisk = false;
    var items = list.map(function (r) {
      var cat = catMap[r.categoryId] || {};
      var rep = r.report || {};
      if (r.categoryId === 'mhealth') {
        if (rep && rep.riskItem9) mentalRisk = true;
        var dims = rep.dims || [];
        dims.forEach(function (d) {
          if (d && d.band && typeof d.band.idx === 'number' && d.band.idx >= 2) mentalAlert = true;
        });
      }
      return {
        quiz: cat.name || r.categoryId,
        completedAt: r.createdAt ? new Date(r.createdAt).toLocaleString('zh-CN', { hour12: false }) : '',
        summary: repDigest(rep)
      };
    });
    return { count: items.length, items: items, mentalAlert: mentalAlert, mentalRisk: mentalRisk };
  }

  var PROFILE_SECTIONS = ['整体人格画像', '核心特质与内在动力', '优势、盲区与提醒', '各测评间的印证与张力', '成长方向与建议'];

  function profileMessages(payload) {
    var sys = '你是一位专业、有温度的中文心理测评解读分析师，擅长把同一用户的多份测评结果整合为一份连贯、诚实、不标签化的「完整人格档案」。'
      + '档案是写给用户自己看的：不要复述任何统计元信息（题量、作答数、档位、题号等一律不出现，如“共几题”“第几档几次”这类字眼都不允许出现在正文里）。'
      + '你只依据给定数据说话：不臆测数据中没有的细节、不做临床诊断；当不同测评看似矛盾时，如实呈现并给出合理解释，而非强行统一。'
      + '语言要求：用第二人称“你”，温暖但不煽情，专业但不冰冷；禁止“你患有…”“你就是 XX 型的人”等定论式表述；不复制测评题目原文。';
    var head = '下面是同一用户在向内而行（Innerway）完成的 ' + payload.count
      + ' 项心理测评的「系统结果摘要」汇总（覆盖性格类型、职业兴趣、动机与防御、人格暗面、五因素、心理健康自评等角度）。'
      + '\n\n请综合以上全部结果，撰写约 800–1000 字的中文「完整人格档案」，并严格满足以下「格式要求」（页面会按小节自动排版）：\n'
      + '1) 正文第一段直接给一段【一句话总览】：2 句内概括“这个人整体上是什么样”，不用术语；不寒暄，不以“以下是/好的”开头；\n'
      + '2) 其后严格按下列标题顺序输出，每个标题独占一行、以“## ”开头（不要改动标题文字，也不要新增其他小节标题）：\n'
      + PROFILE_SECTIONS.map(function (t) { return '## ' + t; }).join('\n') + '\n'
      + '3) 小节正文使用连贯段落；需要列举时，每项以“- ”开头单独成行；关键结论可用 **加粗** 强调；不用“> 引用”和“---”分隔线（页面不渲染）；\n'
      + '4) 写法上：核心特质要区分**稳定内核**与**情境性表现**；把不同测评互相印证的点讲透，明显张力（如高宜人性与较高暗黑得分并存）要正视并给出可能解释；'
      + '成长方向要克制：只给 1–3 个简短方向即可，主体篇幅用于帮助用户理解自己，而不是罗列建议；\n'
      + '5) ' + (payload.mentalRisk
        ? '注意：其中「心理健康自评」命中了需要认真对待的风险信号（如自伤念头相关题目）。请在档案中靠前位置单独、严肃地提醒：本档案仅作自我探索参考、不构成诊断；请立即联系信任的人或拨打全国心理援助热线 12356，紧急情况拨打 120。'
        : (payload.mentalAlert
          ? '注意：其中「心理健康自评」出现值得关注的波动。请在相应小节温和提示：本档案仅作自我探索参考、不构成诊断；若确有困扰请寻求专业帮助或拨打心理援助热线 12356。'
          : '若心理健康自评结果在正常范围，无需特殊渲染，仅作背景参考即可。'));
    var user = head + '\n\n各测评结果摘要：\n' + JSON.stringify(payload.items, null, 2);
    return [{ role: 'system', content: sys }, { role: 'user', content: user }];
  }

  global.Innerway = global.Innerway || {};
  global.Innerway.ai = {
    getSettings: getSettings,
    saveSettings: saveSettings,
    chat: chat,
    readCache: readCache,
    writeCache: writeCache,
    buildQuizPayload: buildQuizPayload,
    quizMessages: quizMessages,
    buildTatPayload: buildTatPayload,
    tatMessages: tatMessages,
    buildProfilePayload: buildProfilePayload,
    profileMessages: profileMessages
  };
})(window);

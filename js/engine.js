/* ============================================================
 * engine.js · 结果计算引擎
 * ------------------------------------------------------------
 * MBTI（正式版 v2）：48 题配对极点 5 点量表计分
 *   answers[题号下标] ∈ 0..4（选项 1..5）
 *   选项分值：1→-2, 2→-1, 3→0, 4→+1, 5→+2（负=A极点 正=B极点）
 *   反向题（rev=1）：分值取反
 *   每维度 12 题求和（-24..+24）：
 *     <0 → A 字母(E/S/T/J)，>0 → B 字母(I/N/F/P)，=0 → 模糊
 *   偏好强度：|得分| 1–6 轻微 / 7–14 中等 / 15–24 明显
 * 霍兰德（演示版）：RIASEC 六型计数（维持不变）
 * ============================================================ */
(function (global) {
  'use strict';
  const data = global.Innerway.data;

  function pct(n, d) { return d <= 0 ? 0 : Math.round((n / d) * 100); }

  /* ---------- MBTI 四维元信息 ---------- */
  const MBTI_DIMS = [
    { key: 'EI', A: 'E', B: 'I', name: '精力来源', aName: '外向', bName: '内向' },
    { key: 'SN', A: 'S', B: 'N', name: '信息获取', aName: '实感', bName: '直觉' },
    { key: 'TF', A: 'T', B: 'F', name: '决策方式', aName: '思考', bName: '情感' },
    { key: 'JP', A: 'J', B: 'P', name: '生活方式', aName: '判断', bName: '知觉' }
  ];

  /* 强度分档 */
  function bandOf(abs) {
    if (abs <= 0) return { n: 0, label: '无明显偏向', text: '两侧趋近平衡' };
    if (abs <= 6) return { n: 1, label: '轻微', text: '轻微偏好' };
    if (abs <= 14) return { n: 2, label: '中等', text: '中等偏好' };
    return { n: 3, label: '明显', text: '明显偏好' };
  }

  /* ---------- MBTI v2：48 题 5 点量表计分（自研题本） ---------- */
  function computeMBTI(answers) {
    const bank = data.getBank('mbti');
    const TYPES = (global.Innerway && global.Innerway.mbti16) || {};
    const sums = { EI: 0, SN: 0, TF: 0, JP: 0 };
    const cnt = { EI: 0, SN: 0, TF: 0, JP: 0 };

    bank.forEach(function (item, qi) {
      const raw = answers[qi];
      if (typeof raw !== 'number' || raw < 0 || raw > 4) return;
      const val = raw - 2;            // 选项 0..4 → -2..+2
      sums[item.d] += item.rev ? -val : val;
      cnt[item.d] += 1;
    });

    const dims = MBTI_DIMS.map(function (meta) {
      const score = sums[meta.key] || 0;
      const abs = Math.abs(score);
      const band = bandOf(abs);
      let fav, unfav, tied = false;
      if (score < 0) { fav = meta.A; unfav = meta.B; }
      else if (score > 0) { fav = meta.B; unfav = meta.A; }
      else { fav = meta.B; unfav = meta.A; tied = true; } // 平票默认取右侧并在报告说明
      const fName = (fav === meta.A) ? meta.aName : meta.bName;
      const uName = (fav === meta.A) ? meta.bName : meta.aName;
      return {
        key: meta.key,
        name: meta.name,
        score: score,
        abs: abs,
        tied: tied,
        answered: cnt[meta.key],
        fav: { k: fav, name: fName },
        unfav: { k: unfav, name: uName },
        band: band
      };
    });

    const typeCode = dims.map(function (d) { return d.fav.k; }).join('');
    const type = TYPES[typeCode] || null;
    const poles = dims.map(function (d) { return d.fav.k + '·' + d.fav.name; });
    const typeName = type ? typeCode + ' · ' + type.name : typeCode + ' · ' + poles.join('/');

    // 维度解读行（供结果页"偏好强度"区块）
    const dimTexts = dims.map(function (d) {
      if (d.tied) {
        return '在「' + d.name + '」上左右旗鼓相当（得分 0），呈现' + d.unfav.name + '与' + d.fav.name +
          '并存的模糊状态，可结合情境辅助判断。';
      }
      return '在「' + d.name + '」上' + d.band.text + d.fav.name + '（' + d.fav.k + '，得分 ' +
        (d.score > 0 ? '+' : '') + d.score + '，区间 ' + d.band.label + '）。';
    });

    // 通用类型解读素材（缺省兜底，不引用版权文本）
    const fallback = {
      name: '复合型', en: 'Composite', tag: '你的四个维度的偏好组合。',
      profile: ['你的四维偏好组合为 ' + poles.join(' / ') + '。不同情境下，这些倾向会以不同方式协同发挥作用，形成你独特的应对风格。', '本测评重在帮助你观察「在大多数情况下更自然的状态」，而非给你贴上一个固定的标签。'],
      strengths: ['四维组合带来独特的观察与应对方式', '在适合的情境中能发挥稳定而有效的作用', '对自我偏好有更清晰的觉察', '愿意以开放心态看待测评结果'],
      blindspots: ['任何偏好组合都可能存在情境盲区', '偏好不等于能力，需在实践中校验', '单一标签无法覆盖完整的人格', '避免用测评结果自我设限'],
      careers: ['依据个人兴趣、技能与价值观综合判断', '可参考职业兴趣测评做交叉验证', '向专业生涯顾问咨询具体方向', '在实际体验中逐步确认适配领域'],
      tip: '把测评当作一面镜子，而不是一副枷锁。'
    };
    const t = type || fallback;

    // ---- 类型清晰度与近似类型：把"偏好强度"纳入解读 ----
    // dims.band.n：0=无(得分0/趋近平衡) 1=轻微 2=中等 3=明显
    const strongDims = dims.filter(function (d) { return !d.tied && d.band && d.band.n >= 2; });
    const weakDims = dims.filter(function (d) { return d.tied || (d.band && d.band.n <= 1); });
    const strongCount = strongDims.length;
    const clarityLabel = strongCount === 4 ? '四维偏好清晰'
      : strongCount === 3 ? '整体轮廓清晰'
        : strongCount === 2 ? '部分维度清晰'
          : strongCount === 1 ? '仅单维较明确'
            : '各维偏好均不显著';
    const strongNames = strongDims.map(function (d) { return '「' + d.name + '」'; });
    const weakNames = weakDims.map(function (d) {
      return d.tied ? '「' + d.name + '」趋近平衡' : '「' + d.name + '」仅轻微';
    });
    // 轻微/模糊的维度翻转后即得相邻类型代码（取与原始最接近的至多 2 个）
    const near = weakDims.slice().sort(function (a, b) {
      return ((a.tied ? -1 : 0) - (b.tied ? -1 : 0)) || (a.abs - b.abs);
    }).map(function (d) {
      return dims.map(function (x) { return (x === d) ? x.unfav.k : x.fav.k; }).join('');
    }).filter(function (v, i, arr) { return arr.indexOf(v) === i; }).slice(0, 2)
      .map(function (c) { const ct = TYPES[c] || null; return { code: c, name: ct ? ct.name : '', en: ct ? ct.en : '' }; });

    const clarityText = [];
    clarityText.push('你的类型代码为 ' + typeCode + '，本次作答的清晰度为「' + clarityLabel + '」。'
      + (strongNames.length || weakNames.length
        ? '具体而言：' + (strongNames.length ? strongNames.join('、') + '的偏好较为明确' : '')
          + (strongNames.length && weakNames.length ? '；' : '')
          + (weakNames.length ? weakNames.join('，') + '，更多随情境波动' : '') + '。'
        : ''));
    clarityText.push(near.length
      ? '由于' + (weakNames.length ? weakNames.join('、') : '存在趋近平衡的维度') + '，' + typeCode + '更适合作为你的「主导倾向」而非精确标签：在不同情境或压力下，你的表现可能更接近 '
        + near.map(function (n) { return n.code + '（' + n.name + '）'; }).join('、')
        + ' 等相邻类型。建议把类型描述当作「光谱上的区间」来对照，而非非此即彼的判断题。'
      : '四个维度均呈现较为明确的偏好，' + typeCode + '可以作为你相对稳定的类型概括：得分越接近区间上限，对应特质通常越典型、越稳定。');
    clarityText.push('轻微偏好或趋近平衡的维度，不代表你不具备另一侧的能力——只是它们更依赖情境、更容易随状态切换。阅读长处与盲区时，请优先采信「明确」维度上的描述，再酌情参考其余部分。');

    // 报告 sections：底部四块（潜在长处 / 可能的盲区 / 职业方向参考 / 成长提示与使用建议）
    // 暂时关闭 —— 已下沉给「AI 深度解读」承载（见 js/ai.js 的 CAT_EXTRA_SECTIONS.mbti）
    const sections = [];

    return {
      engine: 'mbti',
      version: 3,
      typeCode: typeCode,
      typeName: typeName,
      typeEn: t.en || '',
      tagline: t.tag || '',
      chart: 'mbtiPolar',
      profile: t.profile || [],
      dims: dims,
      dimTexts: dimTexts,
      clarity: { label: clarityLabel, text: clarityText },
      near: near,
      sections: sections,
      disclaimer: '本测评基于荣格《心理类型》的类型偏好框架，由本项目原创题本（48 题）开发，与 Myers-Briggs Type Indicator®、MBTI® 官方量表及 The Myers-Briggs Company 无关，亦非其授权或认证产品。结果反映的是你的偏好倾向而非能力水平，仅供自我探索与职业参考，不作为临床诊断或人才选拔的唯一依据。'
    };
  }

  /* ---------- 霍兰德：O*NET Interest Profiler（quick 30 / full 60）RIASEC 计分 ---------- */
  function computeHolland(answers, variant) {
    const bank = data.getBank('holland', variant);
    const order = ['R', 'I', 'A', 'S', 'E', 'C'];
    const sum = {}, cnt = {};
    order.forEach(function (k) { sum[k] = 0; cnt[k] = 0; });
    bank.forEach(function (item, qi) {
      const a = answers[qi];
      if (typeof a !== 'number' || !item.p || a < 0 || a >= item.p.length) return;
      sum[item.g] += (a + 1);
      cnt[item.g] += 1;
    });
    const pct = function (k) { return cnt[k] ? Math.round((sum[k] / cnt[k] / 5) * 100) : 0; };
    const sorted = order.slice().sort(function (x, y) {
      return (pct(y) - pct(x)) || (order.indexOf(x) - order.indexOf(y));
    });
    const typeCode = sorted.slice(0, 3).join('');
    const axes = order.map(function (k) {
      const info = data.HOLLAND_DIM[k];
      return {
        key: k,
        label: info.name,
        value: pct(k),
        raw: sum[k],
        name: info.name.split(' ')[0]
      };
    });
    const top3 = sorted.slice(0, 3).map(function (k) { return data.HOLLAND_DIM[k]; });
    const shortName = function (x) { return x.name.split(' ')[0]; };
    const tagline = '你的兴趣代码为 ' + typeCode + '。主导类型为「' +
      shortName(top3[0]) + '」，并伴有「' + shortName(top3[1]) + '」与「' + shortName(top3[2]) + '」的倾向。';

    return {
      engine: 'holland',
      variant: variant === 'full' ? 'full' : 'quick',
      typeCode: typeCode,
      typeName: top3.map(shortName).join(' · '),
      tagline: tagline,
      axes: axes,
      chart: 'radar',
      sections: [
        { icon: 'eye', tint: '#77836B', soft: '#E4E7D9', title: '你的兴趣倾向', items: top3.map(function (t2) { return '「' + shortName(t2) + '」' + t2.trait; }) },
        { icon: 'sun', tint: '#9A7B60', soft: '#F0E4D3', title: '可能的优势场景', items: top3.map(function (t2) { return t2.trait; }) },
        { icon: 'compass', tint: '#B08D57', soft: '#F1E7CE', title: '职业方向参考', items: top3.reduce(function (acc, t2) {
          (t2.career || []).forEach(function (c) { acc.push('「' + shortName(t2) + '」· ' + c); });
          return acc;
        }, []) },
        { icon: 'moon', tint: '#7D8A97', soft: '#E1E6EA', title: '探索建议', items: ['兴趣不等于能力，请结合技能与价值观做职业决策。', '分数最低的两型可作为"发展区"：有意识地在学习与实践中拓展。', '正式职业决策建议结合专业咨询。'] }
      ],
      disclaimer: '本卷中文编译自美国劳工部（US DOL）就业培训管理局发布的 O*NET® Interest Profiler（Mini-IP / Short Form）。O*NET® 为美国劳工部商标；依据 O*NET Career Exploration Tools License 使用与改编，再分发须保留版权与商标声明并标注来源（https://www.onetcenter.org/IP.html）。本卷结果反映的是工作活动兴趣偏好，仅供自我探索参考，不作为临床诊断或人员选拔依据。'
    };
  }

  /* ---------- 性压抑（SRI）：与开源参考实现一致的计算 ---------- */
  // 标准正态 CDF（把 z 分数映射为 0-100 百分位）
  function normalCDF(x) {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741,
      a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2.0);
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return 0.5 * (1.0 + sign * y);
  }
  function z(raw, m, sd) { return sd === 0 ? 0 : (raw - m) / sd; }

  function computeRepression(answers, variant) {
    const CFG = (global.Innerway && global.Innerway.repression) || null;
    if (!CFG) return null;
    const vk = (variant === 'full') ? 'full' : 'quick';
    const v = CFG.variants[vk];
    const bank = v.bank;
    const norms = CFG.norms[vk];
    const levels = CFG.levels || [];

    // 累加原始分（reverse 项按 6−value 翻转，与参考实现一致）
    const raw = {};
    bank.forEach(function (item, qi) {
      const idx = answers[qi];
      if (typeof idx !== 'number' || idx < 0 || idx > 4) return;
      let val = idx + 1;
      if (item.r) val = 6 - val;
      raw[item.g] = (raw[item.g] || 0) + val;
    });
    const has = function (g) { return Object.prototype.hasOwnProperty.call(raw, g); };

    // 分量分数与 z（阈值与参考实现的"版本自动检测"一致，因版本固定可直接选用）
    const sesRaw = (raw.ses || 0), sis1Raw = (raw.sis1 || 0), sis2Raw = (raw.sis2 || 0);
    const sisRaw = sis1Raw + sis2Raw;
    const sosRaw = (raw.sos || 0), guiltRaw = (raw.mg || 0), shameRaw = (raw.ks || 0);
    const bsasRaw = (raw.bsas || 0);

    const sesZ = z(sesRaw, norms.ses.mean, norms.ses.sd);
    const sisZ = z(sisRaw, norms.sis.mean, norms.sis.sd);
    const sosZ = z(sosRaw, norms.sos.mean, norms.sos.sd);
    const guiltZ = z(guiltRaw, norms.guilt.mean, norms.guilt.sd);
    const shameZ = z(shameRaw, norms.shame.mean, norms.shame.sd);
    const sisOverSes = sisZ - sesZ;

    const compositeZ = (sosZ + guiltZ + shameZ + sisOverSes) / 4;
    const percentile = normalCDF(compositeZ) * 100;
    const score = Math.round(Math.max(0, Math.min(100, percentile)));
    let lvl = levels[2] || { key: 'moderate', label: '中等' };
    levels.forEach(function (lv) { if (score >= lv.min && score < lv.max) lvl = lv; });

    const dims = [
      { key: 'sos', name: '回避与恐惧倾向', z: sosZ, present: has('sos') },
      { key: 'guilt', name: '内疚感', z: guiltZ, present: has('mg') },
      { key: 'shame', name: '羞耻感', z: shameZ, present: has('ks') },
      { key: 'sis', name: '抑制强于兴奋的倾向', z: sisOverSes, present: has('sis1') || has('sis2') || has('ses') }
    ].map(function (d) {
      return { key: d.key, name: d.name, z: Math.round(d.z * 100) / 100, ptile: Math.round(normalCDF(d.z) * 100), present: d.present };
    });

    // 各量表原始分（用于明细展示）
    const scaleRows = (v.scales || []).map(function (sc) {
      const ids = { sis_ses_sf: 'sis_ses_sf', sis_ses_full: 'sis_ses_full' }[sc.k] ? ['ses', 'sis1', 'sis2'] :
        ({ mosher_guilt: 1, mosher_guilt_full: 1 }[sc.k] ? ['mg'] : ({ kiss9_shame: 1 }[sc.k] ? ['ks'] : ({ sos_screening: 1, sos_full: 1 }[sc.k] ? ['sos'] : ['bsas'])));
      let sum = 0;
      ids.forEach(function (g) { sum += (raw[g] || 0); });
      return { key: sc.k, name: sc.t, raw: sum, total: sc.c * 5, ratio: Math.round((sum / (sc.c * 5)) * 100) };
    });

    const summary = [
      'SRI 指数 ' + score + ' 分，处于「' + lvl.label + '」水平——这一指数综合了四类倾向：对性刺激的回避与恐惧、内疚感、羞耻感，以及「抑制感强于兴奋感」的程度。',
      '分数反映的是长期形成的心理倾向，而非任何"好坏"。偏低的指数通常意味着更开放、更少自我评判的性心理体验；偏高则提示可能存在羞耻、内疚或过度控制，值得被温柔地看见。'
    ];
    const highDims = dims.filter(function (d) { return d.z > 1; });
    if (highDims.length) {
      summary.push('其中「' + highDims.map(function (d) { return d.name; }).join('、') + '」相对更明显，是本报告最值得留意的部分。');
    }
    if (lvl.key === 'very-high' || lvl.key === 'high') {
      summary.push('如果这类压抑感长期伴随痛苦、回避或关系困扰，建议与专业心理咨询师或性治疗师讨论，这不是什么羞耻的事。');
    }

    const tips = [];
    if (lvl.key === 'very-high' || lvl.key === 'high') tips.push('考虑与专业的性治疗师或心理咨询师交流，探讨性心理健康话题。');
    dims.forEach(function (d) {
      if (d.z > 1 && d.key === 'guilt') tips.push('探索性内疚感的来源——它常常与文化背景、家庭教育或早期信念有关。');
      if (d.z > 1 && d.key === 'shame') tips.push('练习自我接纳与身体正念，逐步建立与自己的身体更友善的关系。');
      if (d.z > 1 && d.key === 'sis') tips.push('学习放松技巧与正念练习，减少性情境中的焦虑与过度控制。');
      if (d.z > 1 && d.key === 'sos') tips.push('尝试以温和、循序的方式接触与性相关的科学信息，减少回避带来的想象性恐惧。');
    });
    tips.push('与信任的伴侣或朋友开放地讨论性话题，减少孤立感。');
    tips.push('请记住：本工具仅供自我了解与反思，不构成诊断。');

    return {
      engine: 'repression',
      version: 1,
      variant: vk,
      chart: 'sri',
      typeLabel: 'SRI ' + score + ' · ' + lvl.label,
      typeCode: 'SRI',
      typeName: v.label + ' · SRI ' + score,
      tagline: 'SRI 指数 ' + score + ' / 100 · 等级：' + lvl.label,
      sri: { score: score, level: lvl.key, levelLabel: lvl.label, z: Math.round(compositeZ * 100) / 100, percentile: Math.round(percentile) },
      dims: dims,
      scales: scaleRows,
      summary: summary,
      tips: tips,
      disclaimer: '本评估的中文题面参考开源项目 sexual-repression-calculator（MIT 许可证，仅覆盖该仓库代码本身）所采用的公开量表（SIS/SES、Mosher 性内疚、KISS-9、SOS、BSAS 等）编译；各量表题目文本、计分结构与常模数据的权利归其原作者/出版方所有，本卷未取得商业授权，商用前须逐量表取得许可。结果反映的是倾向而非诊断。本工具面向 18 岁及以上成年人，仅供自我探索参考，不构成医学或心理诊断；如有显著困扰请寻求专业人士帮助。'
    };
  }

  /* ---------- 控制欲心理评估（control）：DOC 动机版 / CBS 行为版 ---------- */
  function computeControl(answers, variant) {
    const CFG = (global.Innerway && global.Innerway.control) || null;
    if (!CFG) return null;

    /* 合并版（all）：前段动机卷 + 后段行为卷，拆开后分别计算再合并 */
    if (variant === 'all') {
      const vAll = CFG.variants.all;
      if (!vAll) return null;
      const docAns = {}, cbsAns = {};
      let di = 0, ci = 0;
      vAll.bank.forEach(function (it, qi) {
        const a = answers[qi];
        if (it.g === 'doc') { docAns[di] = a; di += 1; } else { cbsAns[ci] = a; ci += 1; }
      });
      const rDoc = computeControl(docAns, 'doc');
      const rCbs = computeControl(cbsAns, 'cbs');
      if (!rDoc || !rCbs) return null;
      const sDoc = rDoc.score || {}, sCbs = rCbs.score || {};
      return {
        engine: 'control', version: 1, variant: 'all', chart: 'ctrlAll',
        typeCode: 'DOC + CBS', typeName: '控制欲完整评估 · 动机 + 行为（本土化改编）',
        tagline: '动机 ' + sDoc.raw + ' / 140 · 行为频率 ' + sCbs.mean + ' / 5',
        score: { doc: sDoc, cbs: sCbs },
        doc: rDoc, cbs: rCbs,
        summary: ['本次你完成了两卷：动机卷（20 题）反映你「想要掌控」的内在倾向，行为卷（27 题）反映你在亲密关系中实际实施控制行为的频率。两者并不必然一致——动机偏高而行为克制、或压力情境下行为频率升高，都是常见组合。']
          .concat(rDoc.summary || []).concat(rCbs.summary || []),
        tips: (rDoc.tips || []).slice(0, 2).concat((rCbs.tips || []).slice(0, 2)),
        disclaimer: String(rDoc.disclaimer || '') + ' ' + String(rCbs.disclaimer || '')
      };
    }

    const vk = (variant === 'cbs') ? 'cbs' : 'doc';
    const v = CFG.variants[vk];
    const bank = v.bank;
    const raw = {}, cnt = {};
    bank.forEach(function (it, qi) {
      const idx = answers[qi];
      if (typeof idx !== 'number' || idx < 0 || idx >= (it.p || []).length) return;
      let val = idx + 1;
      if (it.r) val = (it.p.length + 1) - val; // 7点反向：8−value；5点反向：6−value
      raw[it.g] = (raw[it.g] || 0) + val;
      cnt[it.g] = (cnt[it.g] || 0) + 1;
      if (it.f) { raw['F_' + it.f] = (raw['F_' + it.f] || 0) + val; cnt['F_' + it.f] = (cnt['F_' + it.f] || 0) + 1; }
    });
    const facetOf = function (f) { return { raw: raw['F_' + f] || 0, cnt: cnt['F_' + f] || 0 }; };

    if (vk === 'doc') {
      const total = raw[bank.length ? bank[0].g : 'doc'] || 0;
      const score = Math.max(20, Math.min(140, total));
      const level = score < 84 ? 'low' : (score <= 116 ? 'mid' : 'high');
      const levelText = { low: '较低 · 更授权与随性', mid: '中等 · 平衡型', high: '较高 · 掌控动机强' }[level];
      const facets = (CFG.facets.doc || []).map(function (fm) {
        const o = facetOf(fm.key);
        return { key: fm.key, name: fm.name, raw: o.raw, count: o.cnt, avg: o.cnt ? Math.round((o.raw / o.cnt) * 10) / 10 : 0 };
      });
      const sorted = facets.slice().sort(function (a, b) { return b.avg - a.avg; });
      const strong = sorted[0], light = sorted[sorted.length - 1];
      const summary = [
        '你的控制欲动机总分约 ' + score + ' / 140，处于「' + levelText + '」区间。控制欲是普遍存在的人格动机：它让你更主动、更有计划，也可能让你在需要放手时感到不适——高低本身没有对错。',
        '四个情境面中，你相对最强的是「' + strong.name + '」（均分 ' + strong.avg + ' / 7），相对最轻的是「' + light.name + '」（均分 ' + light.avg + ' / 7）。' +
        (strong.key === 'rel' ? '你更习惯把决策与执行交给他人，保持选择空间的轻盈。' : '你在需要自己拿主意、带节奏的事情上投入更多。）')
      ];
      const tips = [];
      if (level === 'high') tips.push('掌控动机偏强时，试着把一些低风险事项放心交给别人，练习"不完全由我决定也完全可以"。');
      if (level === 'low') tips.push('如果你希望更多主导感，可以从为一件小事做明确计划开始，逐步练习拍板与推动。');
      tips.push('在重要决策里区分"该我决定"与"可以一起决定"，是让掌控感与关系和谐共处的好方法。');
      tips.push('本卷为基于 DOCS 构念的本土化改编版本，结果仅供参考，不代表原版量表的临床结论。');

      return {
        engine: 'control', version: 1, variant: 'doc', chart: 'doc',
        typeCode: 'DOC', typeName: '控制欲动机测试 · DOCS 改编版',
        tagline: '总分约 ' + score + ' / 140 · ' + levelText,
        score: { raw: score, min: 20, max: 140, level: level, levelText: levelText },
        facets: facets,
        summary: summary, tips: tips,
        disclaimer: '本卷为基于 Burger & Cooper (1979) Desirability of Control Scale 构念的本土化改编版本（非原版量表，未逐字翻译题面），结果反映偏好倾向而非能力，仅供自我探索，不构成心理或职业诊断。'
      };
    }

    /* cbs 亲密关系控制行为 */
    const domains = (CFG.domains.cbs || []).map(function (dm) {
      const o = { raw: raw[dm.key] || 0, cnt: cnt[dm.key] || 0 };
      const avg = o.cnt ? Math.round((o.raw / o.cnt) * 10) / 10 : 0;
      return { key: dm.key, name: dm.name, count: o.cnt, raw: o.raw, avg: avg, alert: avg >= 2.5 };
    });
    const totalRaw = domains.reduce(function (s, d) { return s + d.raw; }, 0);
    const overall = Math.round((totalRaw / bank.length) * 10) / 10;
    const alertDomains = domains.filter(function (d) { return d.alert; });
    const level = overall < 1.5 ? 'low' : (overall < 2.5 ? 'mid' : 'high');
    const levelText = { low: '低频 · 行为模式相对自主', mid: '偶有 · 压力情境下的控制行为', high: '较频繁 · 建议关注关系健康' }[level];
    const summary = [
      '你对 27 类控制行为的出现频率自评为「' + levelText + '」（行为均值约 ' + overall + ' / 5）。这份结果衡量的是你报告的行为频率，而不是给你贴"控制型人格"的标签。',
      alertDomains.length
        ? '需要留意的领域：' + alertDomains.map(function (d) { return '「' + d.name + '」'; }).join('、') + '（均分 ≥ 2.5）。这类行为常与关系中的不安、焦虑有关，看见它们是改变的第一步。'
        : '各领域的均分均低于关注线。若某些行为曾让你或对方感到内疚，值得在关系里坦诚地聊一聊。'
    ];
    const tips = [
      '识别触发情境：哪些时刻你最容易使用控制行为（如嫉妒、不确定、压力）？先处理情绪，再处理冲突。',
      '练习"表达需要"代替"限制对方"：把"你不许去"换成"我需要更多安心，我们聊聊怎么安排"。',
      '给对方保留独立的空间与朋友，是信任建立的一部分；关系健康不等于彼此完全透明。',
      '如果你发现自己或对方正在经历威胁、恐吓、经济或人身控制，请寻求专业帮助或拨打当地热线（见报告底部）。'
    ];

    return {
      engine: 'control', version: 1, variant: 'cbs', chart: 'cbs',
      typeCode: 'CBS', typeName: '亲密关系控制行为测试 · 适配版',
      tagline: '行为频率整体约 ' + overall + ' / 5 · ' + levelText,
      score: { raw: totalRaw, mean: overall, max: bank.length * 5, level: level, levelText: levelText },
      domains: domains, summary: summary, tips: tips,
      disclaimer: '本卷为基于 Graham-Kevan & Archer《Controlling Behaviors Scale–Revised (CBS-R)》构念的本土化改编版本（剔除"利用子女"因子；非原版量表），衡量的是你报告的行为频率而非人格标签，不能作为诊断依据。若你或身边的人正经历伤害或控制，请联系专业支持：全国心理援助热线 12356；妇女维权与反家暴服务热线 12338。'
    };
  }

  /* ---------- 暗黑三特质：SD3（27 题）/ Dirty Dozen（12 题） ---------- */
  // 维度元信息（构念概述为原创中性表述，非量表原文解读）
  const DT_DIM = {
    M: {
      name: '马基雅维利主义', en: 'Machiavellianism',
      high: '马基雅维利主义指一种策略性、善于算计的社交风格：倾向从长远出发经营关系、把他人当作达成目标的资源，同时保持算计而非冲动。',
      low: '马基雅维利主义倾向较低，通常意味着你更信任他人、更少把关系视为博弈，处事相对直接坦率。'
    },
    N: {
      name: '自恋', en: 'Narcissism',
      high: '自恋维度关注的是自我夸大与寻求关注：渴望被欣赏、自视甚高，并期待特殊对待，同时在他人眼里可能显得自我中心。',
      low: '自恋倾向较低，通常表现为谦逊、不过分在意他人评价，也更愿意把注意力放在他人或任务本身上。'
    },
    P: {
      name: '精神病态（亚临床）', en: 'Psychopathy',
      high: '亚临床精神病态维度关注冷酷无情与冲动控制：共情较少、较少内疚，倾向追求即时满足，对规则与风险的顾虑较低。',
      low: '该维度得分较低，通常意味着你有较强的共情与内疚感，行事更有节制，也会顾虑行为对他人的影响。'
    }
  };

  // 相对量表区间的程度标签（偏度判定，非临床阈值）
  function dtLevel(mean, len) {
    const range = len - 1;
    if (mean <= 1 + range * 0.35) return { key: 'low', label: '相对偏低' };
    if (mean >= 1 + range * 0.65) return { key: 'high', label: '相对偏高' };
    return { key: 'mid', label: '接近中间' };
  }

  function computeDarkTriad(categoryId, answers) {
    const ns = (categoryId === 'darktriad-dd')
      ? (global.Innerway && global.Innerway.darktriadDD)
      : (global.Innerway && global.Innerway.darktriad);
    if (!ns) return null;
    const vk = Object.keys(ns.variants)[0];
    const v = ns.variants[vk];
    const bank = v.bank;
    const scaleLabel = v.label || (categoryId === 'darktriad-dd' ? 'DD · 12 题' : 'SD3 · 27 题');
    const len = (bank[0] && bank[0].p) ? bank[0].p.length : 5;

    const raw = {}, cnt = {};
    const order = ['M', 'N', 'P'];
    order.forEach(function (k) { raw[k] = 0; cnt[k] = 0; });
    bank.forEach(function (item, qi) {
      const idx = answers[qi];
      if (typeof idx !== 'number' || idx < 0 || idx >= (item.p || []).length) return;
      let val = idx + 1;
      if (item.r) val = (item.p.length + 1) - val; // 反向题翻转
      raw[item.g] += val;
      cnt[item.g] += 1;
    });

    const dims = order.map(function (k) {
      const mean = cnt[k] ? Math.round((raw[k] / cnt[k]) * 100) / 100 : 0;
      const lv = dtLevel(mean, len);
      const pct = Math.round(((mean - 1) / (len - 1)) * 100);
      const meta = DT_DIM[k];
      return {
        key: k, name: meta.name, en: meta.en,
        mean: mean, count: cnt[k], pct: Math.max(0, Math.min(100, pct)),
        level: lv,
        text: (lv.key === 'high' ? meta.high : meta.low) + (lv.key === 'mid' ? '（处于量表中间区间，说明你在该特质上既有表现也存在自我调节的空间。）' : '')
      };
    });

    // 相对主导排序（同分按 M > N > P）
    const ranked = dims.slice().sort(function (a, b) {
      return (b.mean - a.mean) || (order.indexOf(a.key) - order.indexOf(b.key));
    });
    const top = ranked[0];
    const code = order.map(function (k) { return ranked.find(function (d) { return d.key === k; }); })
      .filter(Boolean).map(function (d) { return d.key; }).join('·');

    const meanLine = dims.map(function (d) {
      return d.key + ' ' + d.mean + ' / ' + len;
    }).join('、');
    const bandText = function (d) {
      return '「' + d.name + '」均分 ' + d.mean + ' / ' + len + '，' + d.level.label + '。';
    };
    const summary = [
      '你在暗黑三特质三个维度上的均分为：' + meanLine + '。三者之中，' +
        (top.level.key === 'high'
          ? '「' + top.name + '」得分相对最高，是你本次报告中最值得留意的倾向。'
          : '「' + top.name + '」相对突出（' + top.mean + ' / ' + len + '），但整体仍在量表中间及以下区间，更多反映一种程度倾向而非固定标签。'),
      '暗黑三特质描述的是每个人身上都不同程度存在的一套"自我优先"心理策略。得分高低本身没有道德对错：适度时可能表现为有策略、有自信、遇事冷静；只有在长期伤害关系、失去自控或伴随明显困扰时，才值得认真对待。'
    ];
    dims.forEach(function (d) { summary.push(bandText(d)); });

    const tips = [];
    dims.forEach(function (d) {
      if (d.level.key === 'high') {
        tips.push('「' + d.name + '」偏高：' + (d.key === 'M' ? '留意是否常用策略换得短期目标而透支信任——练习在关键关系里"少算一步"。' :
          d.key === 'N' ? '留意被欣赏与真正被喜欢之间的差别——试试把赞美让给别人，观察自己的不适感。' :
          '留意冲动与冷酷带来的代价——在行动前给自己一个暂停，想象对方的感受。'));
      }
    });
    tips.push('暗黑特质属于亚临床人格倾向，不等于人格障碍或精神疾病诊断；如果某些特质让你或身边的人长期困扰，与专业心理咨询师聊聊会很有帮助。');
    tips.push('结果会受作答时的心态影响（如实作答比"理想作答"更有参考价值）；本报告仅供自我探索，不作任何选拔、评估他人或医疗用途。');

    const srcLine = categoryId === 'darktriad-dd'
      ? '本卷中文译制自 Jonason & Webster (2010) 发表的 Dark Triad Dirty Dozen（DD，12 题，7 点计分，无反向题）。'
      : '本卷中文译制自 Jones & Paulhus (2014) 发表的 Short Dark Triad（SD3，27 题，5 点计分，含 5 条反向题，计分时已翻转）。';
    const disclaimer = srcLine + '原量表面向研究与教育用途时通常免费开放并需标注出处，商业使用请另行向版权方确认授权。' +
      '本卷面向 18 岁及以上成年人；所测为亚临床人格特质，不构成人格障碍或任何精神疾病诊断。' +
      '部分题面可能让人不适，作答与报告仅保存在本设备浏览器（演示版无云端），不采集真实身份信息。';

    return {
      engine: 'darktriad',
      version: 1,
      variant: vk,
      chart: 'dt',
      typeCode: code,
      typeName: '相对突出倾向：' + top.name,
      tagline: top.level.key === 'high'
        ? '「' + top.name + '」相对突出（均分 ' + top.mean + ' / ' + len + '，' + top.level.label + '）。'
        : '三维均处于中间及以下区间，其中「' + top.name + '」相对最高（' + top.mean + ' / ' + len + '）。',
      scaleLabel: scaleLabel,
      scaleMax: len,
      dims: dims,
      codeRank: code,
      summary: summary,
      tips: tips,
      disclaimer: disclaimer
    };
  }

  /* ---------- 大五人格：IPIP-NEO-120（Johnson 2014）30 facet 计分 ---------- */
  const BF5 = {
    order: ['N', 'E', 'O', 'A', 'C'],
    domain: {
      N: { name: '神经质', en: 'Neuroticism', short: 'NEU', desc: '反映情绪的敏感度与面对压力时的反应方式：水平较高者对紧张、担忧与情绪波动更敏感，往往也更细腻地体验情绪；水平较低者通常更平稳、不易被压力扰动。高神经质不是缺点，只是「情绪雷达」更灵敏。' },
      E: { name: '外向性', en: 'Extraversion', short: 'EXT', desc: '反映精力的指向：高外向者从人际互动与热闹场合中获取能量，健谈而主动；低外向者（内向）并不等于害羞或冷漠，他们更习惯从独处与深度相处中恢复能量。' },
      O: { name: '开放性', en: 'Openness', short: 'OPN', desc: '反映对新经验、观念与美学的开放程度：高开放者好奇、爱想象、乐于尝试新事物；低开放者偏好熟悉、具体与可预期，同样能带来稳定可靠的优势。' },
      A: { name: '宜人性', en: 'Agreeableness', short: 'AGR', desc: '反映人际取向是信任合作还是审慎竞争：高宜人者体贴、谦和、乐于助人；低宜人者更直接、独立、不易被说服，关键时刻更愿意坚持己见。' },
      C: { name: '尽责性', en: 'Conscientiousness', short: 'CON', desc: '反映自律、条理与目标导向：高尽责者计划性强、可靠、说到做到；低尽责者更随性灵活、厌恶条条框框，但也能在需要即兴发挥时获益。' }
    },
    facets: [
      { code: 'N1', name: '焦虑' }, { code: 'N2', name: '愤怒敌意' }, { code: 'N3', name: '抑郁倾向' }, { code: 'N4', name: '自我意识' }, { code: 'N5', name: '放纵冲动' }, { code: 'N6', name: '脆弱感' },
      { code: 'E1', name: '热情友好' }, { code: 'E2', name: '合群' }, { code: 'E3', name: '自信果断' }, { code: 'E4', name: '活动水平' }, { code: 'E5', name: '寻求刺激' }, { code: 'E6', name: '乐观开朗' },
      { code: 'O1', name: '想象力' }, { code: 'O2', name: '审美兴趣' }, { code: 'O3', name: '情感丰富' }, { code: 'O4', name: '求新冒险' }, { code: 'O5', name: '才智思辨' }, { code: 'O6', name: '开放立场' },
      { code: 'A1', name: '信任' }, { code: 'A2', name: '道德感' }, { code: 'A3', name: '利他' }, { code: 'A4', name: '合作' }, { code: 'A5', name: '谦逊' }, { code: 'A6', name: '同情' },
      { code: 'C1', name: '自我效能' }, { code: 'C2', name: '条理性' }, { code: 'C3', name: '尽责守诺' }, { code: 'C4', name: '成就追求' }, { code: 'C5', name: '自律' }, { code: 'C6', name: '审慎' }
    ]
  };
  const BF_FMAP = {};
  BF5.facets.forEach(function (f) { BF_FMAP[f.code] = f; });

  function levelLabel(m) {
    if (m <= 2.4) return { key: 'low', label: '偏低' };
    if (m >= 3.6) return { key: 'high', label: '偏高' };
    return { key: 'mid', label: '中等' };
  }

  function computeBigFive(answers) {
    const CFG = (global.Innerway && global.Innerway.bigfive) || null;
    if (!CFG) return null;
    const bank = CFG.variants.main.bank;
    const fs = {};   // facet 累加
    const fc = {};
    BF5.facets.forEach(function (f) { fs[f.code] = 0; fc[f.code] = 0; });
    bank.forEach(function (it, qi) {
      const idx = answers[qi];
      if (typeof idx !== 'number' || !it.p) return;
      if (idx < 0 || idx >= it.p.length) return;
      let val = idx + 1;
      if (it.r) val = (it.p.length + 1) - val;
      if (fs[it.g] !== undefined) { fs[it.g] += val; fc[it.g] += 1; }
    });
    // 任何 facet 缺题则整体返回 null（完整版必须全部作答）
    const miss = BF5.facets.some(function (f) { return fc[f.code] !== 4; });
    if (miss) return null;

    const facetRows = BF5.facets.map(function (f) {
      const mean = Math.round((fs[f.code] / 4) * 100) / 100;
      return { code: f.code, name: f.name, domain: f.code.charAt(0), mean: mean, pct: Math.round(((mean - 1) / 4) * 100) };
    });
    const dims = BF5.order.map(function (k) {
      const items = facetRows.filter(function (f) { return f.domain === k; });
      const mean = Math.round((items.reduce(function (s, f) { return s + f.mean; }, 0) / 6) * 100) / 100;
      const sorted = items.slice().sort(function (a, b) { return b.mean - a.mean; });
      const topF = sorted[0], lowF = sorted[sorted.length - 1];
      const highlight = (sorted[0].mean - sorted[sorted.length - 1].mean) >= 0.25;
      return {
        key: k, name: BF5.domain[k].name, en: BF5.domain[k].en, short: BF5.domain[k].short,
        mean: mean, pct: Math.round(((mean - 1) / 4) * 100), level: levelLabel(mean),
        topF: topF, lowF: lowF, hasSpread: highlight
      };
    });
    const ranked = dims.slice().sort(function (a, b) { return b.mean - a.mean; });
    const summary = dims.map(function (d) {
      const lv = d.level.label;
      const spread = d.hasSpread
        ? '其中相对更突出的是「' + d.topF.name + '」（' + d.topF.mean.toFixed(1) + '/5），相对较低的是「' + d.lowF.name + '」（' + d.lowF.mean.toFixed(1) + '/5）。'
        : '各子维度较为均衡，没有特别极端的部分。';
      return '「' + d.name + '」' + lv + '（均分 ' + d.mean.toFixed(1) + ' / 5）。' + BF5.domain[d.key].desc + spread;
    });
    const tips = [
      '五维分数描述的是「倾向」，不是好坏：同一分数在不同情境里各有优势，解读时请结合你自己的生活场景。',
      '本报告展示你相对自己的剖面：请把「偏高/偏低」理解为与你自身其它维度的比较，而非与人群常模的比较。',
      '大五人格在成年期相对稳定，但也会随经历缓慢变化——可以隔 1–2 年重测，观察自己的成长轨迹。',
      '如果需要更正式的解释（如职业规划、团队协作），建议结合具体情境或由受过训练的测评师解读，本工具不作诊断用途。'
    ];
    const disclaimer = '本卷为 IPIP-NEO-120（Johnson, 2014）完整 120 题的中文译制版。IPIP 题项属公共领域（ipip.ori.org），可免费使用、改编与翻译；量表层与原版一致（30 个 facet，每 facet 4 题，含原版 -keyed 反向题）。结果反映人格倾向而非疾病或能力，不构成临床诊断或人事决策依据；面向 16 岁及以上成年人。';

    return {
      engine: 'bigfive',
      version: 1,
      variant: 'main',
      chart: 'big5',
      scaleMax: 5,
      typeCode: 'BIG-5',
      typeName: '你的大五人格剖面',
      tagline: '五域相对：' + ranked.map(function (d, i) { return (i === 0 ? '最高「' : (i === dims.length - 1 ? '」，最低「' : '」居中「')) + d.name; }).join('') + '」',
      dims: dims,
      facets: facetRows,
      summary: summary,
      tips: tips,
      disclaimer: disclaimer
    };
  }

  /* ---------- 心理健康自评：PHQ-9（抑郁 9 题）+ GAD-7（焦虑 7 题） ---------- */
  // 说明：answers[题号下标(0 基)] ∈ 0..3（档位 0=完全没有 … 3=几乎每天，值与档位一致）
  //   PHQ-9 → 下标 0–8；GAD-7 → 下标 9–15；自伤风险题（PHQ-9 第 9 题）→ 下标 8
  function computeMHealth(answers) {
    var dep = 0, anx = 0;
    for (var q = 0; q < 9; q++) dep += Math.min(3, Math.max(0, +answers[q] || 0));
    for (var q2 = 9; q2 < 16; q2++) anx += Math.min(3, Math.max(0, +answers[q2] || 0));
    var riskItem9 = (+answers[8] || 0) > 0;

    var depBand = dep <= 4 ? 0 : dep <= 9 ? 1 : dep <= 14 ? 2 : 3;
    var anxBand = anx <= 4 ? 0 : anx <= 9 ? 1 : anx <= 14 ? 2 : 3;
    var overall = Math.max(depBand, anxBand);

    var depTexts = [
      '近两周得分处于 0–4 区间，通常提示无明显抑郁症状，情绪状态较平稳。',
      '5–9 分：轻度抑郁症状区间。你可能偶尔感到兴趣减退或精力不足；若持续超过两周或影响生活，建议留意节奏、规律作息，并与信任的人保持交流。',
      '10–14 分：中度抑郁症状区间。建议尽快与信任的人沟通，并考虑预约心理专业人员做进一步评估。',
      '15–27 分：中重度及以上区间。强烈建议近期预约精神科或心理科专业评估；如伴随自伤念头，请立即联系心理援助热线或前往医院。'
    ];
    var anxTexts = [
      '近两周得分处于 0–4 区间，通常提示无明显焦虑症状。',
      '5–9 分：轻度焦虑症状区间。紧张或担忧偶有出现；若明显影响睡眠与专注，可尝试放松练习并保持规律作息。',
      '10–14 分：中度焦虑症状区间。持续的紧张与担忧可能已影响生活，建议寻求专业评估与支持。',
      '15–21 分：重度焦虑症状区间。建议尽快寻求精神心理专业帮助；急性强烈不适时请及时就医。'
    ];
    var overallNames = ['安适区间', '轻度波动', '值得关注', '建议尽快专业评估'];
    var overallTexts = [
      '当前自评整体处于安适区间，未见明显的抑郁/焦虑症状聚集。可把这份结果当作一次定期的自我关怀记录。',
      '当前自评提示轻度情绪波动：多数时候你仍能自行调节，但建议留意睡眠、活动量与支持关系；若持续两周以上未见缓解，可与专业人士聊聊。',
      '当前自评提示存在值得关注的抑郁/焦虑症状。建议预约心理或精神科专业评估，厘清是否需要进一步的支持与干预。',
      '当前自评提示症状较明显。强烈建议尽快寻求精神心理专业评估；如出现自伤或自杀念头，请立即拨打 120 或心理援助热线（全国统一热线 12356）。'
    ];
    var dims = [
      { key: 'PHQ-9', name: '抑郁倾向（过去两周）', total: dep, max: 27,
        band: { idx: depBand, label: ['无明显症状', '轻度', '中度', '中重度及以上'][depBand], text: depTexts[depBand] } },
      { key: 'GAD-7', name: '焦虑倾向（过去两周）', total: anx, max: 21,
        band: { idx: anxBand, label: ['无明显症状', '轻度', '中度', '重度'][anxBand], text: anxTexts[anxBand] } }
    ];
    var summary = [
      '整体评估：' + overallTexts[overall],
      dims[0].name + '：' + dims[0].band.label + '（' + dep + ' / ' + dims[0].max + ' 分）。' + dims[0].band.text,
      dims[1].name + '：' + dims[1].band.label + '（' + anx + ' / ' + dims[1].max + ' 分）。' + dims[1].band.text
    ];
    var tips = [
      '本自评只反映"过去两周"的主观感受，一次作答不等于诊断；情绪会流动，请勿据此给自己贴标签。',
      '规律睡眠、适度活动与稳定的人际联结是情绪健康的基石；若症状影响到工作、学习或关系，请优先安排专业评估。',
      '若任何时候出现自伤或自杀念头：请立即拨打 120，或拨打全国统一心理援助热线 12356；也可告诉身边信任的人，并前往就近医院精神科。'
    ];
    return {
      engine: 'mhealth', version: 1, variant: 'main', chart: 'mh',
      scaleLabel: 'PHQ-9 + GAD-7 · 16 题',
      typeCode: overallNames[overall],
      typeName: '你的心理健康自评结果',
      tagline: '过去两周内：抑郁自评 ' + dep + '/27（' + dims[0].band.label + '）· 焦虑自评 ' + anx + '/21（' + dims[1].band.label + '）',
      riskItem9: riskItem9,
      dims: dims,
      summary: summary,
      tips: tips,
      disclaimer: '本卷采用公共领域量表 PHQ-9（Kroenke, Spitzer & Williams, 2001）与 GAD-7（Spitzer et al., 2006）的中文官方译版，逐题收录、未增删。量表为筛查工具而非诊断工具：结果不能替代精神科或心理科的专业评估。如处于危机中，请立即拨打 120 或全国统一心理援助热线 12356。'
    };
  }

  /* ---------- 统一入口 ---------- */
  /* ---------- 空间偏好（热区情境 · E/I 探索性参考） ---------- */
  function computeSpatial(answers) {
    const CFG = (global.Innerway && global.Innerway.spatial) || null;
    if (!CFG || !CFG.variants || !CFG.variants.main) return null;
    const bank = CFG.variants.main.bank || [];
    const dimsMeta = CFG.dims || {};

    let E = 0, I = 0, answered = 0;
    const picks = [];
    bank.forEach(function (it, qi) {
      const zid = answers[qi];
      if (typeof zid !== 'string' || !zid) return;
      const zone = (it.zones || []).find(function (z) { return z.id === zid; });
      if (!zone) return;
      answered += 1;
      if (zone.pole === 'E') E += 1; else if (zone.pole === 'I') I += 1;
      picks.push({ scene: it.title || it.id, zone: zone.name, pole: zone.pole });
    });
    const diff = E - I;
    const total = Math.max(1, answered);

    let code = 'X', levelLabel = '内外均衡';
    if (diff >= 3) { code = 'E'; levelLabel = '明显偏外向（靠近人群）'; }
    else if (diff === 2) { code = 'E'; levelLabel = '偏外向（靠近人群）'; }
    else if (diff === 1) { code = 'e'; levelLabel = '略偏外向'; }
    else if (diff === 0) { code = 'X'; levelLabel = '内外较为均衡'; }
    else if (diff === -1) { code = 'i'; levelLabel = '略偏内向'; }
    else if (diff === -2) { code = 'I'; levelLabel = '偏内向（倾向独处）'; }
    else { code = 'I'; levelLabel = '明显偏内向（倾向独处）'; }

    const shareE = Math.round((E / total) * 100);
    const shareI = 100 - shareE;
    const summary = [];
    summary.push('四个情境里，你共有 ' + E + ' 次选择靠近人流与互动的位置，' + I + ' 次选择安静低打扰的位置（E ' + shareE + '% / I ' + shareI + '%）。');
    if (code === 'E') summary.push('从空间站位看，你更常“向人靠近”：入口、吧台、群体和热闹点位对你更顺手。这通常意味着你容易从在场与交谈中获得能量；也值得留意独处是否也能让你安心恢复。');
    else if (code === 'I') summary.push('从空间站位看，你更常“向内收着待”：窗边、角落、安静点位让你更自在。这通常意味着你更容易被低打扰的环境滋养；也值得留意在需要时你是否也能主动走向人群。');
    else summary.push('你的选择在靠近人群与安静独处之间来回，没有明显的单边倾向——更可能是“看场合需要”而不是“按标签行动”，这是一种灵活的适应。');
    summary.push('本题型是探索性的行为偏好参考：空间位置会受到当下心情、熟悉度与任务的影响，不等于稳定的人格结论。');

    const tips = [];
    if (code === 'E') tips.push('留意自己的恢复方式：如果连续人群场合后容易疲惫，可以主动给自己留一段独处的“下线时间”。');
    else if (code === 'I') tips.push('留意自己的人际开关：如果在需要时难以开口靠近，可从“小剂量互动”开始练习，不必强迫自己变外向。');
    else tips.push('继续保持这种按需切换的灵活；可以记录一下哪些场合让你充电、哪些让你消耗。');
    tips.push('把结果当作自我观察的镜子，而非标签。');

    return {
      engine: 'spatial',
      version: 1,
      variant: 'main',
      chart: 'spatial',
      typeCode: code.toUpperCase() + '·空间',
      typeName: levelLabel,
      typeLabel: levelLabel,
      tagline: 'E ' + E + ' · I ' + I + '（已作答 ' + answered + '/' + total + ' 个场景）',
      code: code,
      E: E, I: I, diff: diff, answered: answered, total: total,
      dims: [
        { key: 'E', short: 'E', name: (dimsMeta.E && dimsMeta.E.name) || '靠近人群', val: E, total: total, share: shareE,
          level: { label: diff >= 1 ? '较常选择' : '较少选择' }, desc: dimsMeta.E ? dimsMeta.E.desc : '' },
        { key: 'I', short: 'I', name: (dimsMeta.I && dimsMeta.I.name) || '偏向独处', val: I, total: total, share: shareI,
          level: { label: diff <= -1 ? '较常选择' : '较少选择' }, desc: dimsMeta.I ? dimsMeta.I.desc : '' }
      ],
      summary: summary,
      tips: tips,
      disclaimer: '「空间偏好」为热区情境题型的探索性参考：题目以常见生活场景的位置选择观察你对人际接近与独处的倾向方向，属于体验型内容而非正式心理量表，不构成人格定论或任何诊断。'
    };
  }

  /* ---------- 意象叙事 TAT：无计分，收集故事供 AI 温柔回看 ---------- */
  function computeTat(answers) {
    const CFG = (global.Innerway && global.Innerway.tat) || null;
    const bank = (CFG && CFG.variants && CFG.variants.main && CFG.variants.main.bank) || [];
    const answered = [];
    bank.forEach(function (it, qi) {
      const raw = answers[qi];
      const txt = (typeof raw === 'string') ? raw.trim() : '';
      if (!txt) return;
      answered.push({ id: it.id, title: it.title, scene: it.scene, text: txt, chars: txt.length });
    });
    const total = bank.length;
    const done = answered.length;
    const totalChars = answered.reduce(function (s, a) { return s + a.chars; }, 0);
    const avgChars = done ? Math.round(totalChars / done) : 0;

    const summary = [];
    if (done === 0) {
      summary.push('你还没有为这些画面写下故事，因此这份报告暂时没有可回看的内容。任何时候愿意回来写一段都可以——故事没有对错，也没有必须写满的要求。');
    } else {
      summary.push('这次你没有做任何“选择题”，而是为 ' + done + ' 幅画面各讲了一个故事。故事没有对错、没有标准答案，所以这份报告也不会有分数——它更像一面镜子，把你自己写下的情节、人物与结尾原样呈现在你面前。');
      if (avgChars >= 90) {
        summary.push('你写下的故事相当完整，有前因、有过程、也有结局——说明你愿意让想象充分展开，也愿意认真对待这次自我探索。');
      } else if (avgChars >= 30) {
        summary.push('你为画面勾勒了清晰的情节轮廓；如果愿意，回看时可以试着再多写一点人物的内心——他/她在那一刻最想说什么、最怕什么。');
      } else {
        summary.push('你只用很简短的话收住了故事。短也有短的意义——有时候留白本身就是一种表达，关键是你写下的那几个词触及了怎样的感受。');
      }
      const endings = answered.filter(function (a) {
        return /(?:(?:最后|最终|后来|结尾|从此|终究|终于|于是|结果|末了|多年后|如今|现在).{0,14}(?:。|！|？|\.|!|\?))|(?:(?:。|！|？|\.|!|\?)\s*$)/.test(a.text);
      }).length;
      if (endings === 0 && done > 0) {
        summary.push(done > 1
          ? '你写下的这些故事似乎都没有真正“走到结尾”——很多情节停在了中途。这不一定是回避，也可能只是你更在意“正在发生的那一刻”。不妨问问自己：如果让故事再多走一步，你最想让它走向哪里？'
          : '这个故事似乎没有真正“走到结尾”——情节停在了中途。这不一定是回避，也可能只是你更在意“正在发生的那一刻”。不妨问问自己：如果让故事再多走一步，你最想让它走向哪里？');
      } else if (endings === done) {
        summary.push(done > 1
          ? '你写下的这些故事都给出了各自的收束。你似乎需要让事情“有个交代”才能安心——这种对结局的在意，本身也是了解你自己的线索。'
          : '这个故事给出了自己的收束。你似乎需要让事情“有个交代”才能安心——这种对结局的在意，本身也是了解你自己的线索。');
      }
    }

    const tips = [];
    if (done > 0) {
      tips.push('重读一遍自己写下的文字，试着圈出重复出现的关键词、情绪或人物处境——那往往是最值得你留意的地方。');
      tips.push('看每个故事的主角如何“处理”困境：是独自承担、向外求助、沉默等待，还是转身离开？那可能也是你在现实中习惯的应对方式。');
      tips.push('不必急着给这些故事下结论。把它放一放，过几天再读，你可能会对自己有新的发现。');
    }

    return {
      engine: 'tat',
      version: 1,
      variant: 'main',
      chart: 'tat',
      typeName: '意象叙事 · 无计分',
      typeCode: 'STORY',
      typeLabel: '叙事探索',
      tagline: done ? ('为 ' + done + ' 幅画面写下故事 · 平均 ' + avgChars + ' 字/则') : '尚未写下故事',
      stories: answered,
      answered: done,
      total: total,
      totalChars: totalChars,
      summary: summary,
      tips: tips,
      disclaimer: (CFG && CFG.disclaimer) || '「意象叙事」为主题统觉式（TAT）的自我探索练习：图版为本站原创多义意象，故事没有对错与标准答案。它反映的是“此刻的你如何讲故事”，不是人格定论，也不构成任何诊断。'
    };
  }

  function compute(categoryId, answers, variant) {
    if (categoryId === 'mbti') return computeMBTI(answers);
    if (categoryId === 'holland') return computeHolland(answers, variant);
    if (categoryId === 'repression') return computeRepression(answers, variant);
    if (categoryId === 'control') return computeControl(answers, variant);
    if (categoryId === 'darktriad') return computeDarkTriad(categoryId, answers);
    if (categoryId === 'bigfive') return computeBigFive(answers);
    if (categoryId === 'mhealth') return computeMHealth(answers);
    if (categoryId === 'spatial') return computeSpatial(answers);
    if (categoryId === 'tat') return computeTat(answers);
    return null;
  }

  global.Innerway = global.Innerway || {};
  global.Innerway.engine = { compute: compute };
})(window);

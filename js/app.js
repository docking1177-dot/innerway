/* ============================================================
 * app.js · 应用主控：hash 路由 / 视图渲染 / 交互编排
 * 数据流：
 *   本地缓存(iw.cache.<catId>) ←→ 模拟服务端(iw.srv.*)
 *   答题每步双写；专属码+设备绑定由 api.validateCode 驱动
 * ============================================================ */
(function (global) {
  'use strict';

  // 运行形态开关：true = 公网演示版（保留「演示控制台」与自助「获取演示码」入口）；
  // 正式运营/接入真实后端前请改为 false（演示入口将自动隐藏，只接受正式码）。
  const DEMO_MODE = true;

  const D = global.Innerway.data;
  const S = global.Innerway.server;
  const A = global.Innerway.api;
  const engine = global.Innerway.engine;
  const charts = global.Innerway.charts;
  const icons = global.Innerway.icons;
  const fp = global.Innerway.fp;

  const $ = function (sel, root) { return (root || document).querySelector(sel); };
  const $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  const esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  const state = {
    deviceId: null,
    quiz: null,               // { categoryId, code, bank, answers:{qi:opt}, current }
    saveTimer: null,
    pendingActivate: null     // 多版本门类：激活后待选版本的 {catId, code}
  };

  /* ================= 基础工具 ================= */
  function cacheKey(catId) { return 'iw.cache.' + catId; }
  function readCache(catId) {
    try { return JSON.parse(localStorage.getItem(cacheKey(catId)) || 'null'); } catch (e) { return null; }
  }
  function writeCache(catId, obj) {
    try { localStorage.setItem(cacheKey(catId), JSON.stringify(obj)); } catch (e) { /* ignore */ }
  }
  function fmtDate(ts) {
    const d = new Date(ts);
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* ================= Toast ================= */
  function toast(msg, type) {
    const root = $('#toast-root');
    const t = document.createElement('div');
    t.className = 'toast ' + (type === 'err' ? 'toast-err' : 'toast-ok');
    t.innerHTML = '<span data-icon="' + (type === 'err' ? 'x-circle' : 'check-circle') + '"></span><span>' + esc(msg) + '</span>';
    root.appendChild(t);
    icons.mount(t);
    setTimeout(function () {
      t.classList.add('toast-leave');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
    }, 2600);
  }

  /* ================= 视图装载 ================= */
  function render(into, html) {
    $('#stage').innerHTML = '<section class="view active">' + html + '</section>';
    icons.mount($('#stage'));
    if (into && into.scrollTo) window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function setShell(viewName) {
    document.body.dataset.view = viewName;
    const btn = $('#btnHome');
    btn.hidden = (viewName === 'home');
    $('#saveState').hidden = true;
  }
  function fmtSaveState() {
    const el = $('#saveState');
    if (!state.quiz) return;
    const cat = D.getCategory(state.quiz.categoryId);
    el.innerHTML = '<span data-icon="check-circle"></span>已保存 · ' + cat.name;
    icons.mount(el);
    el.hidden = false;
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(function () { el.hidden = true; }, 1800);
  }
  function savingIndicator() {
    const el = $('#saveState');
    el.innerHTML = '<span data-icon="save-check"></span>正在保存…';
    icons.mount(el);
    el.hidden = false;
  }

  /* ================= 多版本门类（霍兰德/性压抑/控制欲）：版本选择 ================= */
  const VAR_DESC = {
    quick: {
      holland: '官方 Mini-IP 精简版：每型 5 题共 30 题，适合在通勤/碎片时间里快速捕捉兴趣方向。',
      repression: '覆盖性抑制/性兴奋、性内疚、性羞耻与性观感四个核心分量，快速给出 0–100 的 SRI 压抑指数，适合初次自测。'
    },
    full: {
      holland: '官方 Short Form 标准版：每型 10 题共 60 题，剖面更稳、区分度更好，适合认真规划职业时使用。',
      repression: '在快速版基础上纳入完整版各量表与性态度（BSAS）维度，题目更全、剖面更细，适合需要深入对照的阶段。'
    },
    doc: '基于 DOCS「控制欲动机」构念的本土化改编版：20 题 7 点量表，测你想不想、有多想掌控自己的生活与决定。',
    cbs: '基于 CBS-R「亲密关系控制行为」构念的本土化改编版：27 题频率量表，测你在关系中实施监视、隔离、操纵等行为的频率。'
  };
  const VAR_ICO = { quick: 'activity', full: 'layers', doc: 'activity', cbs: 'users' };
  const VAR_SUB = {
    holland: '「' ,
    repression: '',
    control: ''
  };
  function openVariantChooser(cat) {
    closeAllModals();
    const variants = variantCfg(cat.id);
    const keys = variants ? Object.keys(variants) : (VARIANT_DEF[cat.id] || ['quick']);
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    const sub = {
      holland: '「' + esc(cat.name) + '」包含精简与完整两个版本：精简版对应官方 Mini-IP（每型 5 题，30 题）；完整版对应官方 Short Form（每型 10 题，60 题）。两者均为同一份体验码可测。',
      repression: '「' + esc(cat.name) + '」提供两个版本：快测适合初次了解；完整版更全面，需要更长时间。两者共享同一体验码流程，作答与报告仅保存在本设备浏览器（演示版无云端存储）。',
      control: '「' + esc(cat.name) + '」一个看「动机」、一个看「行为」，可以分别作答，也可以相互对照。两者均为面向成年人的本土化改编版本（非原版量表、非诊断）。'
    }[cat.id] || '';
    const note = {
      holland: '本卷中文编译自美国劳工部 O*NET Interest Profiler（按官方 License 授权编译，非公共领域；须保留版权与 O*NET® 商标声明）；题目均为工作活动描述，凭「喜欢程度」作答即可。',
      repression: '本评估面向 <b>18 岁及以上成年人</b>；内容涉及性心理话题，作答与结果仅保存在本设备浏览器（演示版无云端、不采集身份信息）。未成年人请勿使用。',
      control: '面向 18 岁及以上成年人；内容为基于公开量表构念的自我觉察工具，作答与结果仅保存在本设备浏览器（演示版无云端、不采集身份信息）。'
    }[cat.id] || '';
    const descFor = function (key) {
      const m = VAR_DESC[key] || '';
      return (typeof m === 'object') ? (m[cat.id] || '') : m;
    };
    const card = function (key) {
      const v = variants ? variants[key] : { label: key, total: key === 'full' ? 60 : 30, duration: '' };
      return '<button type="button" class="vcard" data-v="' + key + '">' +
        '<span class="vcard-ico"><span data-icon="' + (VAR_ICO[key] || 'activity') + '"></span></span>' +
        '<span class="vcard-body"><span class="vcard-title">' + esc(v.label || key) + '</span>' +
        '<span class="vcard-meta">' + (v.total || 0) + ' 题 · ' + esc(v.duration || '') + '</span>' +
        '<span class="vcard-desc">' + esc(descFor(key)) + '</span></span>' +
        '<span class="vcard-go"><span data-icon="arrow-right"></span></span></button>';
    };
    mask.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true">' +
      '  <div class="modal-head"><div><div class="modal-title">选择评估版本</div>' +
      '    <div class="modal-sub">' + sub + '</div></div>' +
      '    <button type="button" class="modal-x" data-close aria-label="关闭"><span data-icon="x"></span></button></div>' +
      '  <div class="modal-body">' +
      '    <div class="vcard-list">' + keys.map(function (k) { return card(k); }).join('') + '</div>' +
      '    <div class="bound-hint" style="margin-top:14px"><span data-icon="shield-check"></span><span>' + note + '</span></div>' +
      '  </div></div>';
    icons.mount(mask);
    $('#modal-root').appendChild(mask);
    function close() { mask.remove(); }
    mask.querySelector('[data-close]').addEventListener('click', close);
    mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
    $$('.vcard', mask).forEach(function (btn) {
      btn.addEventListener('click', function () {
        const key = btn.getAttribute('data-v');
        close();
        // 新交互：先输码激活（专属码弹窗）→ 激活后回到此处选版本 → 开始作答
        const p = state.pendingActivate || null;
        state.pendingActivate = null;
        if (p && p.catId === cat.id) {
          restoreQuizContext(cat.id, p.code, null, key);
          location.hash = '#/quiz/' + cat.id;
        } else {
          openCodeModal(cat);
        }
      });
    });
  }

  /* ================= 专属码弹窗 =================
     ctx.reuse 存在时复用该已挂载的遮罩容器（单弹窗串联：介绍确认后切为填码，不关闭弹窗） */
  function openCodeModal(cat, variant, ctx) {
    const mask = (ctx && ctx.reuse) || document.createElement('div');
    if (!(ctx && ctx.reuse)) { mask.className = 'modal-mask'; }
    const multi = isVariantCat(cat.id);
    const codeSub = multi
      ? '「' + esc(cat.name) + '」为单次激活测评，包含多个版本——<b>一份体验码，所有版本均可测试</b>，无需分别获取。激活后即可选择版本开始作答。'
      : '「' + esc(cat.name) + '」为单次激活测评。<br>演示版可点击下方按钮自助获取体验码；一码一设备，激活即与当前设备绑定。';
    const demoRowHtml = DEMO_MODE
      ? '      <button type="button" class="btn btn-ghost btn-block" id="codeDemo">没有专属码？获取一个演示码</button>\n'
      : '';
    const boundHintHtml = DEMO_MODE
      ? '    <div class="bound-hint" id="boundHint" hidden><span data-icon="lock"></span><span>演示模式：激活后体验码将与当前设备绑定，其他设备无法使用。</span></div>'
      : '';
    mask.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="codeModalTitle">' +
      '  <div class="modal-head">' +
      '    <div><div class="modal-title" id="codeModalTitle">输入专属码</div>' +
      '      <div class="modal-sub">' + codeSub + '</div>' +
      '    </div>' +
      '    <button type="button" class="modal-x" data-close aria-label="关闭"><span data-icon="x"></span></button>' +
      '  </div>' +
      '  <div class="modal-body">' +
      '    <label class="label" for="codeInput">专属激活码</label>' +
      '    <div class="code-input-wrap">' +
      '      <span data-icon="key-round"></span>' +
      '      <input class="input" id="codeInput" placeholder="IW-MBTI-XXXXXXXX" autocomplete="off" spellcheck="false">' +
      '    </div>' +
      '    <div class="field-err" id="codeErr"></div>' +
      '    <div class="modal-actions">' +
      '      <button type="button" class="btn btn-primary btn-block" id="codeSubmit"><span data-icon="shield-check"></span>激活并开始测评</button>\n' +
      demoRowHtml +
      '    </div>\n' +
      boundHintHtml +
      '  </div>' +
      '</div>';
    icons.mount(mask);
    $('#modal-root').appendChild(mask);
    const input = $('#codeInput', mask);
    const errEl = $('#codeErr', mask);
    const submitBtn = $('#codeSubmit', mask);
    const demoBtn = DEMO_MODE ? $('#codeDemo', mask) : null;
    setTimeout(function () { input.focus(); }, 60);

    function setBusy(busy, txt) {
      submitBtn.disabled = busy;
      submitBtn.innerHTML = busy
        ? '<span class="spinner"></span><span>' + txt + '</span>'
        : '<span data-icon="shield-check"></span>激活并开始测评';
      if (!busy) icons.mount(submitBtn);
    }
    function close() { mask.remove(); }
    mask.querySelector('[data-close]').addEventListener('click', close);
    mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') doValidate(); });

    function doValidate() {
      const code = input.value.trim();
      if (!code) { errEl.textContent = '请输入专属码。'; input.classList.add('err'); return; }
      errEl.textContent = ''; input.classList.remove('err');
      setBusy(true, '正在校验…');
      A.validateCode({ code: code, categoryId: cat.id, deviceId: state.deviceId })
        .then(function (res) {
          if (!res.ok) { throw { friendly: res.message }; }
          close();
          const code = res.data.code;
          if (res.data.state === 'completed') {
            toast('该码已完成测评，正在打开报告');
            location.hash = '#/result/' + res.data.resultId;
            return;
          }
          if (res.data.progress) {
            startQuiz(cat.id, code, res.data.progress, variant);
            location.hash = '#/quiz/' + cat.id;
            return;
          }
          // 全新激活：多版本门类先记住码并进入版本选择，选定后再建立会话
          if (isVariantCat(cat.id)) {
            state.pendingActivate = { catId: cat.id, code: code };
            openVariantChooser(cat);
            return;
          }
          restoreQuizContext(cat.id, code, null, variant);
          location.hash = '#/quiz/' + cat.id;
        })
        .catch(function (err) {
          console.error('激活流程异常', err);
          setBusy(false);
          const msg = (err && err.friendly) || '激活失败，请稍后重试。';
          errEl.textContent = msg;
          input.classList.add('err');
        });
    }
    submitBtn.addEventListener('click', doValidate);

    // 演示：模拟"第三方发码"后自动回填（仅演示版渲染该按钮）
    if (demoBtn) demoBtn.addEventListener('click', function () {
      demoBtn.disabled = true;
      demoBtn.innerHTML = '<span class="spinner"></span><span>正在生成演示码…</span>';
      A.demoPurchase(cat.id).then(function (res) {
        if (!res.ok) { demoBtn.disabled = false; demoBtn.innerHTML = '没有专属码？获取一个演示码'; icons.mount(demoBtn); errEl.textContent = res.message || '获取失败'; return; }
        input.value = res.data.code;
        input.classList.remove('err');
        errEl.textContent = '';
        demoBtn.disabled = false;
        demoBtn.innerHTML = '没有专属码？获取一个演示码';
        icons.mount(demoBtn);
        $('#boundHint', mask).hidden = false;
        icons.mount($('#boundHint', mask));
        toast('已生成演示码：' + res.data.code);
        setTimeout(function () { doValidate(); }, 420);
      });
    });
  }

  /* ================= 门类入口：先弹门类介绍，确认后再进入绑定流程 ================= */
  let categoryOpening = false;
  function openCategory(catId) {
    const cat = D.getCategory(catId);
    if (!cat) return;
    if (!cat.open) { toast('「' + cat.name + '」筹备中，敬请期待', 'err'); return; }
    if (categoryOpening) return;
    categoryOpening = true;
    closeAllModals();
    openCategoryIntro(cat);
    categoryOpening = false;
  }

  /* 门类介绍弹窗：题量/时长/说明，确认后才进入 续答·再测·输码 流程 */
  function openCategoryIntro(cat) {
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    const vCount = isVariantCat(cat.id) ? Object.keys(variantCfg(cat.id) || {}).length : 1;
    const chips =
      '<span class="ci-chip"><span data-icon="clock"></span>' + esc(cat.duration || '') + '</span>' +
      '<span class="ci-chip"><span data-icon="layers"></span>' + (vCount > 1 ? '含 ' + vCount + ' 个版本可选' : '单版本测评') + '</span>' +
      (cat.tag ? '<span class="ci-chip">' + esc(cat.tag) + '</span>' : '');
    mask.innerHTML =
      '<div class="modal modal-intro" role="dialog" aria-modal="true">' +
      '  <div class="modal-head">' +
      '    <div class="ci-head">' +
      '      <span class="ci-ico" style="background:' + esc(cat.tint || '#9A7B60') + '"><span data-icon="' + esc(cat.icon || 'compass') + '"></span></span>' +
      '      <div><div class="modal-title">' + esc(cat.name) + '</div>' +
      '        <div class="modal-sub">' + esc(cat.en || '') + '</div></div>' +
      '    </div>' +
      '    <button type="button" class="modal-x" data-close aria-label="关闭"><span data-icon="x"></span></button>' +
      '  </div>' +
      '  <div class="modal-body">' +
      '    <div class="ci-chips">' + chips + '</div>' +
      '    <p class="ci-desc">' + esc(cat.desc || '') + '</p>' +
      '    <div class="ci-note"><span data-icon="shield-check"></span><span>进入后将按本设备的绑定状态引导：未开始则激活体验码；进行中则续答；已完成可查看上次报告或用新码重测。每道题作答即自动保存，中途可随时退出续答。</span></div>' +
      '    <div class="modal-actions">' +
      '      <button type="button" class="btn btn-primary btn-block" data-act="start"><span data-icon="arrow-right"></span>开始测评</button>' +
      '      <button type="button" class="btn btn-ghost btn-block" data-close>先看看别的</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';
    icons.mount(mask);
    $('#modal-root').appendChild(mask);
    function close() { mask.remove(); }
    mask.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', close); });
    mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
    const startBtn = mask.querySelector('[data-act="start"]');
    startBtn.addEventListener('click', function () { beginCategoryFlow(cat, mask, close); });
  }

  /* 介绍确认后：智能判断绑定态——进行中直接续答；已完成进入再测；全新在同一弹窗内切为专属码填写 */
  async function beginCategoryFlow(cat, mask, closeMask) {
    if (categoryOpening) return;
    categoryOpening = true;
    try {
      if (!cat || !cat.open) return;
      // 进行中优先：续答（可能同时存在历史完成报告与新一轮进行中）
      const active = await A.getMyActive(state.deviceId);
      const act = active.data.find(function (i) { return i.categoryId === cat.id; });
      if (act) {
        toast('检测到本设备已绑定该测评，继续作答');
        closeMask();
        startQuiz(cat.id, act.code, null, act.variant || null);
        location.hash = '#/quiz/' + cat.id;
        return;
      }
      // 已完成：允许"查看最近报告"或"用新专属码再次测评"
      const mine = await A.getMyResults(state.deviceId);
      const done = mine.data.filter(function (r) { return r.categoryId === cat.id; });
      if (done.length) {
        closeMask();
        openReEntryModal(cat, done[0].id);
        return;
      }
      // 全新：不关闭弹窗，直接切换到专属码填写（单弹窗串联）
      openCodeModal(cat, undefined, { reuse: mask });
    } finally {
      categoryOpening = false;
    }
  }

  /* 关闭所有已打开弹窗：保证模态框单例，避免多触发堆叠导致按钮被上层遮罩遮挡 */
  function closeAllModals() {
    document.querySelectorAll('.modal-mask').forEach(function (m) { m.remove(); });
  }

  /* ================= 已完成门类的再入口 ================= */
  function openReEntryModal(cat, resultId) {
    closeAllModals();
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true">' +
      '  <div class="modal-head">' +
      '    <div><div class="modal-title">再次测评「' + esc(cat.name) + '」？</div>' +
      '      <div class="modal-sub">该设备已完成一次本测评。您可以选择查看上次报告，或用新专属码开启新一轮（每码仍限一设备一次）。</div>' +
      '    </div>' +
      '    <button type="button" class="modal-x" data-close aria-label="关闭"><span data-icon="x"></span></button>' +
      '  </div>' +
      '  <div class="modal-body">' +
      '    <div class="modal-actions">' +
      '      <button type="button" class="btn btn-ghost btn-block" data-act="view"><span data-icon="file-text"></span>查看上次报告</button>' +
      '      <button type="button" class="btn btn-primary btn-block" data-act="new"><span data-icon="key-round"></span>使用新专属码再测一次</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';
    icons.mount(mask);
    $('#modal-root').appendChild(mask);
    function close() { mask.remove(); }
    mask.querySelector('[data-close]').addEventListener('click', close);
    mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
    // 委托处理，避免按钮受图标替换或层级影响而失焦/无响应
    mask.addEventListener('click', function (e) {
      const hit = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
      if (!hit) return;
      const act = hit.getAttribute('data-act');
      e.preventDefault();
      e.stopPropagation();
      if (act === 'view') {
        close();
        location.hash = '#/result/' + resultId;
      } else if (act === 'new') {
        close();
        openCodeModal(cat);
      }
    });
  }

  /* ================= 答题视图 ================= */
  const VARIANT_DEF = { holland: ['quick', 'full'], repression: ['quick', 'full'], control: ['doc', 'cbs'] };
  function variantCfg(catId) {
    if (catId === 'holland') return (global.Innerway.holland && global.Innerway.holland.variants) || null;
    if (catId === 'repression') return (global.Innerway.repression && global.Innerway.repression.variants) || null;
    if (catId === 'control') return (global.Innerway.control && global.Innerway.control.variants) || null;
    return null;
  }
  function isVariantCat(catId) { return catId === 'holland' || catId === 'repression' || catId === 'control'; }
  // 解析测评版本（holland/repression/control 才有多个版本；其余门类固定）
  function pickVariant(catId, want, src) {
    if (!isVariantCat(catId)) return null;
    const keys = variantCfg(catId) ? Object.keys(variantCfg(catId)) : VARIANT_DEF[catId];
    const w = want || (src && src.variant) || null;
    return keys.indexOf(w) >= 0 ? w : keys[0];
  }

  function restoreQuizContext(catId, code, progress, variantWant) {
    // 恢复现场：对比"服务端进度"与"本地缓存"，取 updatedAt 较新者
    const local = readCache(catId);
    let src = progress || null;
    if (local && local.code === code) {
      const localT = local.updatedAt || 0;
      const srvT = (src && src.updatedAt) || 0;
      if (localT >= srvT) src = local;
    }
    const variant = pickVariant(catId, variantWant, src);
    const bank = D.getBank(catId, variant);
    const meta = isVariantCat(catId) ? D.getVariantInfo(catId, variant) : null;
    state.quiz = {
      categoryId: catId,
      code: code,
      variant: variant,
      bank: bank,
      answers: (src && src.answers) ? Object.assign({}, src.answers) : {},
      current: Math.min((src && typeof src.current === 'number') ? src.current : 0, Math.max(bank.length - 1, 0)),
      meta: meta
    };
    // 恢复后回写本地缓存（双写）
    syncLocal();
  }

  async function startQuiz(catId, code, progress, variantWant) {
    if (progress) {
      restoreQuizContext(catId, code, progress, variantWant);
      return;
    }
    // progress 为空时尝试从服务端拉取（刷新恢复场景）
    try {
      const p = await A.getProgress(code, state.deviceId);
      restoreQuizContext(catId, code, p.data, variantWant);
    } catch (e) {
      restoreQuizContext(catId, code, null, variantWant);
    }
  }

  function syncLocal() {
    if (!state.quiz) return;
    writeCache(state.quiz.categoryId, {
      code: state.quiz.code,
      variant: state.quiz.variant,
      answers: state.quiz.answers,
      current: state.quiz.current,
      updatedAt: Date.now()
    });
  }
  // 服务端保存（去抖 500ms）
  function serverSaveSoon() {
    if (!state.quiz) return;
    savingIndicator();
    clearTimeout(state.serverSaveT);
    state.serverSaveT = setTimeout(function () {
      A.saveProgress({
        code: state.quiz.code,
        categoryId: state.quiz.categoryId,
        deviceId: state.deviceId,
        answers: state.quiz.answers,
        current: state.quiz.current
      }).then(function () { fmtSaveState(); });
    }, 500);
  }

  function quizStats(q) {
    const total = q.bank.length;
    const answeredCount = Object.keys(q.answers).length;
    return { total: total, answeredCount: answeredCount, pct: Math.round((answeredCount / total) * 100), qi: q.current };
  }

  /* ================= 配对极点 5 点量表（MBTI v2）辅助 ================= */
  const SR_GROUP = {
    ses: '性兴奋 SES', sis1: '表现抑制 SIS1', sis2: '威胁抑制 SIS2',
    mg: '性内疚 Mosher', ks: '性羞耻 KISS-9', sos: '性观感 SOS', bsas: '性态度 BSAS',
    doc: '控制欲动机 DOC', eco: '经济控制', thr: '威胁控制', int: '恐吓与羞辱',
    emo: '情感操纵', iso: '隔离与监控', min: '淡化与推责',
    R: '现实型 R', I: '研究型 I', A: '艺术型 A', S: '社会型 S', E: '企业型 E', C: '常规型 C'
  };
  const DIM_META = {
    EI: { name: '精力来源', A: 'E', B: 'I' },
    SN: { name: '信息获取', A: 'S', B: 'N' },
    TF: { name: '决策方式', A: 'T', B: 'F' },
    JP: { name: '生活方式', A: 'J', B: 'P' }
  };
  const POLAR_CAP = ['非常偏左', '偏左', '居中', '偏右', '非常偏右'];
  // 左右两栏实际展示的字母：正向=左A右B，反向=左B右A
  function polarLetters(item) {
    const m = DIM_META[item.d];
    return item.rev ? [m.B, m.A] : [m.A, m.B];
  }
  // 作答反馈只做中性确认，不提示"更接近哪一侧/是否居中"，避免在答题中泄露倾向性结果
  function polarStateText(item, ll, rl, p) {
    return '已选第 ' + (p + 1) + ' 档 · 选择已自动保存，可随时返回修改';
  }

  // 底部导航/提交按钮区域的 HTML（含全部答完的提交入口）
  function quizControlsHtml(q, st) {
    const qi = st.qi, total = st.total, isLast = qi === total - 1, allDone = st.answeredCount === total;
    // 意象叙事 TAT：写作易疲倦，写满 2 幅即可随时提前提交；此后可自由跳到任意画面浏览/补写
    const tatQuick = q.categoryId === 'tat' && st.answeredCount >= 2;
    let html = '<div class="quiz-nav">';
    if (qi > 0) {
      html += '<button type="button" class="btn btn-ghost btn-sm" id="qPrev"><span data-icon="arrow-left"></span>上一题</button>';
    } else {
      html += '<span class="quiz-nav-spacer"></span>';
    }
    if (!isLast) {
      const v = q.answers[qi];
      const answered = (typeof v === 'number') || (typeof v === 'string' && v.trim().length > 0);
      html += '<button type="button" class="btn btn-primary btn-sm" id="qNext" ' + ((answered || tatQuick) ? '' : 'disabled') + '>下一题<span data-icon="arrow-right"></span></button>';
    } else if (allDone || tatQuick) {
      html += '<button type="button" class="btn btn-primary" id="qSubmit"><span data-icon="sparkles"></span>完成测评 · 查看结果</button>';
    } else {
      html += '<button type="button" class="btn btn-primary btn-sm" id="qNext" disabled>提交前请完成本题<span data-icon="arrow-right"></span></button>';
    }
    html += '</div>';
    if (allDone && !isLast) {
      html += '<div style="text-align:center;margin-top:18px">' +
        '<button type="button" class="btn-early" id="qSubmitBar"><span data-icon="sparkles"></span>全部题目已答完 · 立即查看结果</button></div>';
    } else if (tatQuick && !isLast) {
      html += '<div style="text-align:center;margin-top:18px">' +
        '<button type="button" class="btn-early" id="qSubmitBar"><span data-icon="sparkles"></span>已完成 ' + st.answeredCount + ' 幅，满 2 幅即可提交</button>' +
        '<div class="btn-early-note">小提醒 · 答得越多，解读越准——多写几幅，故事线索更完整，回看也会更贴近你此刻的心境</div></div>';
    }
    return html;
  }

  function bindQuizControls(root) {
    const q = state.quiz;
    if (!q) return;
    const st = quizStats(q);
    const prev = $('#qPrev', root);
    if (prev) prev.addEventListener('click', function () { q.current = Math.max(0, st.qi - 1); syncLocal(); serverSaveSoon(); renderQuiz(); });
    const next = $('#qNext', root);
    if (next && !next.disabled) next.addEventListener('click', function () { q.current = Math.min(st.total - 1, st.qi + 1); syncLocal(); serverSaveSoon(); renderQuiz(); });
    const submit = $('#qSubmit', root);
    if (submit) submit.addEventListener('click', onSubmitQuiz);
    const barSubmit = $('#qSubmitBar', root);
    if (barSubmit) barSubmit.addEventListener('click', onSubmitQuiz);
  }

  // 选项点击后的局部刷新：避免整页重渲染带来的闪烁
  function refreshAfterAnswer() {
    const q = state.quiz;
    if (!q) return;
    const stage = $('#stage');
    const st = quizStats(q);
    const counter = $('.quiz-count', stage);
    if (counter) counter.textContent = '已答 ' + st.answeredCount + ' / ' + st.total;
    const fill = $('.progress-fill', stage);
    if (fill) fill.style.width = st.pct + '%';
    // 重绘控制区
    const ctrl = $('#quizCtrlRoot', stage);
    if (ctrl) {
      ctrl.innerHTML = quizControlsHtml(q, st);
      icons.mount(ctrl);
      bindQuizControls(ctrl);
    }
  }

  /* ================= 空间偏好 · 热区点击题（SVG 场景 + 多边形热区） ================= */
  function hsPts(z) {
    return String(z.pts).trim().split(/\s+/).map(function (s) {
      const p = s.split(',');
      return [Number(p[0]), Number(p[1])];
    });
  }
  function hsCentroid(pts) {
    let x = 0, y = 0;
    pts.forEach(function (p) { x += p[0]; y += p[1]; });
    return [Math.round(x / pts.length), Math.round(y / pts.length)];
  }
  function hsInPoly(x, y, pts) {
    let inside = false, a = pts[0], b;
    for (let i = 1; i <= pts.length; i++) {
      b = pts[i % pts.length];
      if (((a[1] > y) !== (b[1] > y)) && (x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0])) inside = !inside;
      a = b;
    }
    return inside;
  }
  function hsScenePoint(evt, svg) {
    const ctm = svg.getScreenCTM && svg.getScreenCTM();
    if (!ctm) return null;
    const m = ctm.inverse();
    const p = new DOMPoint(evt.clientX, evt.clientY).matrixTransform(m);
    return { x: p.x, y: p.y };
  }
  function hsHit(item, x, y) {
    const zones = item.zones || [];
    for (let i = 0; i < zones.length; i++) {
      if (hsInPoly(x, y, hsPts(zones[i]))) return zones[i].id;
    }
    return null; // 区域外：提示重选
  }
  function hotspotMarkup(item) {
    const zones = item.zones || [];
    const polys = zones.map(function (z) {
      const c = hsCentroid(hsPts(z));
      return '<g class="hs-zone" data-zone="' + z.id + '">' +
        '<polygon points="' + z.pts + '"></polygon>' +
        '<text x="' + c[0] + '" y="' + c[1] + '" text-anchor="middle" dominant-baseline="middle">' + esc(z.name) + '</text></g>';
    }).join('');
    const chips = zones.map(function (z) {
      return '<button type="button" class="hs-chip" data-zone="' + z.id + '">' + esc(z.name) + '</button>';
    }).join('');
    return '<div class="hs">' +
      '<div class="hs-stage">' +
      '<svg class="hs-svg" viewBox="0 0 1000 640" role="img" aria-label="' + esc(item.title || '场景') + '俯视图">' +
      item.svg +
      polys +
      '<g class="hs-pin" aria-hidden="true"><circle class="hs-ripple" cx="0" cy="0"></circle><circle class="hs-ring" cx="0" cy="0" r="9"></circle><circle class="hs-dot" cx="0" cy="0" r="4"></circle></g>' +
      '</svg>' +
      '<div class="hs-hint"><span data-icon="info-circle"></span>点击场景中你最可能停留的位置；选择即保存，随后自动进入下一题</div>' +
      '</div>' +
      '<div class="hs-chips">' + chips + '</div></div>';
  }
  function hotspotBind(root, q, qi, item) {
    const svg = $('.hs-svg', root);
    if (!svg) return;
    const zones = item.zones || [];
    const pick = function (zid, x, y) {
      if (q.answers[qi] === zid) return;
      q.answers[qi] = zid;
      syncLocal();
      serverSaveSoon();
      $$('.hs-zone', root).forEach(function (g) {
        g.classList.toggle('sel', g.getAttribute('data-zone') === zid);
      });
      $$('.hs-chip', root).forEach(function (c) {
        c.classList.toggle('sel', c.getAttribute('data-zone') === zid);
      });
      const z = zones.find(function (o) { return o.id === zid; });
      if (z) {
        const c = hsCentroid(hsPts(z));
        const px = (x != null) ? x : c[0];
        const py = (y != null) ? y : c[1];
        const pin = $('.hs-pin', root);
        if (pin) {
          pin.setAttribute('transform', 'translate(' + px.toFixed(1) + ',' + py.toFixed(1) + ')');
          pin.classList.add('on');
          const rp = $('.hs-ripple', pin);
          if (rp) {
            const start = (window.performance && performance.now) ? performance.now() : Date.now();
            (function tick(now) {
              const t = Math.min(1, (now - start) / 450);
              rp.setAttribute('r', (10 + 32 * t).toFixed(1));
              rp.setAttribute('opacity', String(Math.max(0, 1 - t)));
              if (t < 1) requestAnimationFrame(tick);
            })(start);
          }
        }
      }
      refreshAfterAnswer();
      const st = quizStats(q);
      if (st.qi < st.total - 1) {
        setTimeout(function () {
          const st2 = quizStats(q);
          q.current = Math.min(st2.total - 1, st2.qi + 1);
          syncLocal();
          serverSaveSoon();
          renderQuiz();
        }, 760);
      }
    };
    svg.addEventListener('click', function (evt) {
      const p = hsScenePoint(evt, svg);
      if (!p) return;
      const zid = hsHit(item, p.x, p.y);
      if (!zid) { toast('这里不在可停留区域附近，请点在各座位 / 设施所在区域', 'err'); return; }
      pick(zid, p.x, p.y);
    });
    $$('.hs-chip', root).forEach(function (btn) {
      btn.addEventListener('click', function () { pick(btn.getAttribute('data-zone'), null, null); });
    });
  }

  /* 意象叙事 TAT：图版渲染——优先黑白照片（img），缺失时回退极简 SVG */
  function tatFigMarkup(item) {
    if (item.img) return '<img class="tat-fig-img" src="' + esc(item.img) + '" alt="' + esc(item.title || '意象图') + '：' + esc(item.scene || '') + '">';
    return item.svg || '';
  }

  function renderQuiz() {
    const q = state.quiz;
    if (!q) { location.hash = '#/'; return; }
    const cat = D.getCategory(q.categoryId);
    const st = quizStats(q);
    const qi = st.qi, total = st.total;
    const item = q.bank[qi];
    const polar = !!(item && item.d && item.l && item.r && !item.opts);
    const srItem = !!(item && item.g && item.p && item.q && !item.opts);
    const hotspot = !!(item && item.type === 'hotspot' && item.zones && item.zones.length);
    const story = !!(item && item.type === 'story' && (item.img || item.svg));

    // 选项区：配对极点 5 点量表（MBTI v2）/ 单题 5 点量表（性压抑）/ 传统多选按钮（霍兰德等）
    let optsHtml = '';
    if (story) {
      const selT = q.answers[qi];
      const guideChips = ['此刻 · 正在发生什么', '前因 · 在这之前', '心声 · 想与感受', '后来 · 会怎样'].map(function (g) {
        return '<span class="story-guide-chip">' + g + '</span>';
      }).join('');
      optsHtml =
        '<div class="story">' +
        '  <div class="story-fig">' + tatFigMarkup(item) + '</div>' +
        '  <div class="story-guide">' + guideChips + '</div>' +
        '  <textarea class="story-ta" id="storyTa" rows="6" placeholder="写下你脑海里浮现的故事……两三句话也好，不必追求完整或“精彩”。">' + (typeof selT === 'string' ? esc(selT) : '') + '</textarea>' +
        '  <div class="story-hint"><span data-icon="save-check"></span>每题约 2–3 分钟 · 写下即自动保存 · 答得越多，解读越准；写满 2 幅即可提前提交，未写的画面不必勉强</div>' +
        '</div>';
    } else if (srItem) {
      const selS = q.answers[qi];
      const len = (item.p || []).length;
      const isFreq = item.o === 1;
      const isLike = item.o === 2;
      const pairTxt = isFreq
        ? (len === 5 ? '频率 · 1–5 分' : '过去两周出现频率 · 0–' + (len - 1) + ' 档')
        : (isLike ? '喜欢程度 · 1–5 分' : (len === 7 ? '同意度 · 1–7 分' : '同意度 · 1–5 分'));
      const srBtns = (item.p || []).map(function (opt, i) {
        const sel = selS === i;
        return '<button type="button" class="p-pt' + (sel ? ' sel' : '') + '" data-v="' + i + '" role="radio" aria-checked="' + sel + '">' +
          '<i class="p-dot"></i><b>' + opt.v + '</b><em>' + esc(opt.label) + '</em>' +
          '</button>';
      }).join('');
      const tipText = (q.meta && q.meta.hint) ? esc(q.meta.hint) : '请根据你真实的日常状态与第一直觉作答，没有对错之分；选择后自动保存，可随时返回修改。';
      optsHtml =
        '<div class="q-dim"><span class="q-dim-pair">' + pairTxt + '</span></div>' +
        '<div class="polar-tip"><span data-icon="info-circle"></span>' + tipText + '</div>' +
        '<div class="p-scale p' + len + '" role="radiogroup" aria-label="程度选择">' + srBtns + '</div>' +
        '<div class="p-state" id="polarState">' + (typeof selS === 'number'
          ? '已选：' + esc((item.p[selS] || {}).label || '')
          : '凭第一直觉作答即可，无需反复纠结。') + '</div>';
    } else if (polar) {
      const L = polarLetters(item);
      const ll = L[0], rl = L[1];
      const selP = q.answers[qi];
      const dotHtml = [0, 1, 2, 3, 4].map(function (p) {
        const sel = selP === p;
        return '<button type="button" class="p-pt' + (sel ? ' sel' : '') + '" data-v="' + p + '" role="radio" aria-checked="' + sel + '">' +
          '<i class="p-dot"></i><b>' + (p + 1) + '</b><em>' + POLAR_CAP[p] + '</em>' +
          '</button>';
      }).join('');
      optsHtml =
        '<div class="q-dim"><span class="q-dim-pair">左右倾向 · 5 档</span></div>' +
        '<div class="q-polar">' +
        '  <div class="polar-tip"><span data-icon="info-circle"></span>左右各是一段描述：选择最接近你<strong>日常真实状态</strong>的档位 —— 越靠左越符合左侧，越靠右越符合右侧。</div>' +
        '  <div class="polar-cols">' +
        '    <div class="p-anchor p-left"><p class="p-text">' + esc(item.l) + '</p></div>' +
        '    <div class="p-axis" aria-hidden="true"><i class="p-axis-l">偏左</i><span></span><i class="p-axis-r">偏右</i></div>' +
        '    <div class="p-anchor p-right"><p class="p-text">' + esc(item.r) + '</p></div>' +
        '  </div>' +
        '  <div class="p-scale" role="radiogroup" aria-label="左右倾向强度">' + dotHtml + '</div>' +
        '  <div class="p-state" id="polarState">' + (typeof selP === 'number'
          ? polarStateText(item, ll, rl, selP)
          : '凭第一直觉作答，没有对错之分；选择后自动保存，可随时返回修改。') + '</div>' +
        '</div>';
    } else if (hotspot) {
      optsHtml = hotspotMarkup(item);
    } else {
      optsHtml = item.opts.map(function (op, oi) {
        const sel = q.answers[qi] === oi;
        const letter = String.fromCharCode(65 + oi);
        return '<button type="button" class="q-opt' + (sel ? ' sel' : '') + '" data-opt="' + oi + '">' +
          '<span class="q-radio"></span>' +
          '<span style="flex:1">' +
          '  <span class="q-opt-letter">' + letter + '</span>' +
          '  <span class="q-opt-text">' + esc(op.t) + '</span>' +
          '</span></button>';
      }).join('');
    }

    render('#stage',
      '<div class="quiz-page">' +
      '  <div class="quiz-top">' +
      '    <span class="quiz-cat"><span data-icon="' + (cat.icon || 'compass') + '"></span>' + esc(cat.name) + (cat.tag ? ' · ' + esc(cat.tag) : '') + '</span>' +
      '    <span class="quiz-count">已答 ' + st.answeredCount + ' / ' + total + '</span>' +
      '  </div>' +
      '  <div class="progress-track"><div class="progress-fill" style="width:' + st.pct + '%"></div></div>' +
      '  <div class="quiz-card">' +
      '    <div class="q-index">QUESTION ' + String(qi + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0') + '</div>' +
      '    ' + (item.q ? '<div class="q-text">' + esc(item.q) + '</div>' : '') +
      '    <div class="q-opts">' + optsHtml + '</div>' +
      '  </div>' +
      '  <div id="quizCtrlRoot">' + quizControlsHtml(q, st) + '</div>' +
      '  <div class="quiz-hint"><span data-icon="save-check"></span>选择即自动保存，可随时退出，下次回到本页继续作答</div>' +
      '</div>');

    setShell('quiz');
    bindQuizControls($('#stage'));

    if (polar || srItem) {
      const polarState = $('#polarState', $('#stage'));
      $$('.p-pt', $('#stage')).forEach(function (btn) {
        btn.addEventListener('click', function () {
          const p = parseInt(btn.getAttribute('data-v'), 10);
          if (q.answers[qi] === p) return;
          q.answers[qi] = p;
          syncLocal();
          serverSaveSoon();
          $$('.p-pt', $('#stage')).forEach(function (b) {
            const on = parseInt(b.getAttribute('data-v'), 10) === p;
            b.classList.toggle('sel', on);
            b.setAttribute('aria-checked', on);
          });
          const L2 = srItem ? null : polarLetters(item);
           let stateTxt;
           if (srItem) {
             const op = (item.p || [])[p];
             stateTxt = '已选：' + (((op && op.label) != null) ? op.label : '');
           } else {
             stateTxt = polarStateText(item, L2[0], L2[1], p);
           }
           if (polarState) polarState.textContent = stateTxt;
          refreshAfterAnswer();
        });
      });
    } else {
      // 选项事件：就地选中 + 持久化 + 刷新统计/控制区
      $$('.q-opt', $('#stage')).forEach(function (btn) {
        btn.addEventListener('click', function () {
          const oi = parseInt(btn.getAttribute('data-opt'), 10);
          if (q.answers[qi] === oi) return;
          q.answers[qi] = oi;
          syncLocal();
          serverSaveSoon();
          $$('.q-opt', $('#stage')).forEach(function (b) {
            b.classList.toggle('sel', parseInt(b.getAttribute('data-opt'), 10) === oi);
          });
          refreshAfterAnswer();
        });
      });
    }
    if (hotspot) hotspotBind($('#stage'), q, qi, item);
    if (story) storyBind($('#stage'), q, qi, item);
  }

  // 故事写作题：textarea 输入防抖保存 + 刷新控制区按钮态
  function storyBind(root, q, qi, item) {
    const ta = $('#storyTa', root);
    if (!ta) return;
    let t = null;
    const refresh = function () {
      clearTimeout(t);
      t = setTimeout(function () {
        refreshAfterAnswer();
      }, 260);
    };
    ta.addEventListener('input', function () {
      const v = ta.value;
      const nv = v.trim();
      if (nv) q.answers[qi] = v;
      else delete q.answers[qi];
      syncLocal();
      serverSaveSoon();
      refresh();
    });
    // 进入下一题/提交前，确保 answers 是最新值
    ta.addEventListener('change', function () {
      const v = ta.value;
      const nv = v.trim();
      if (nv) q.answers[qi] = v;
      else delete q.answers[qi];
      syncLocal();
      serverSaveSoon();
    });
  }

  async function onSubmitQuiz() {
    const q = state.quiz;
    if (!q) return;
    const total = q.bank.length;
    // 意象叙事 TAT 允许“写满 2 幅即提交”（可任选画面作答）；其余门类需全部完成
    const need = q.categoryId === 'tat' ? Math.min(2, total) : total;
    if (Object.keys(q.answers).length < need) {
      if (q.categoryId === 'tat') toast('请至少为 2 幅画面写下故事后再提交，也可以继续补写或跳过不感兴趣的画面', 'err');
      else toast('尚有题目未作答', 'err');
      return;
    }
    const btn = $('#qSubmit') || $('#qSubmitBar');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span><span>正在生成报告…</span>'; }
    try {
      // 服务端最终保存进度，再提交结果
      await A.saveProgress({ code: q.code, categoryId: q.categoryId, deviceId: state.deviceId, variant: q.variant, answers: q.answers, current: q.current });
      const report = engine.compute(q.categoryId, q.answers, q.variant);
      const res = await A.submitResult({
        code: q.code, categoryId: q.categoryId, deviceId: state.deviceId,
        report: report, answers: q.answers
      });
      if (!res.ok) throw new Error(res.message);
      writeCache(q.categoryId, { code: q.code, answers: {}, current: 0, updatedAt: Date.now() }); // 清本地作答缓存
      location.hash = '#/result/' + res.data.resultId;
    } catch (e) {
      toast('报告生成失败：' + ((e && e.message) || '请重试'), 'err');
      renderQuiz();
    }
  }

  /* ================= 首页 ================= */
  async function renderHome() {
    setShell('home');
    render('#stage', '<div class="page-loading"><span class="spinner"></span><span>正在加载…</span></div>');
    const [activeRes, resultRes] = await Promise.all([
      A.getMyActive(state.deviceId),
      A.getMyResults(state.deviceId)
    ]);
    const active = activeRes.data || [];
    const results = resultRes.data || [];

    // 继续测评条
    let contHtml = '';
    if (active.length) {
      const items = active.slice(0, 2).map(function (i) {
        const cat = D.getCategory(i.categoryId);
        return '<div class="continue-card">' +
          '<div class="continue-ico"><span data-icon="' + (cat ? cat.icon : 'compass') + '"></span></div>' +
          '<div class="continue-body"><div class="continue-title">继续「' + (cat ? cat.name : i.categoryId) + '」</div>' +
          '<div class="continue-desc">' + (cat ? cat.desc.slice(0, 26) : '') + '…</div></div>' +
          '<button type="button" class="btn btn-primary btn-sm" data-continue="' + i.categoryId + '">继续作答</button>' +
          '</div>';
      }).join('');
      contHtml = '<div class="continue-bar show">' + items + '</div>';
    }

    // 平台概况（数字随演示数据动态生成，不使用虚构统计）
    const openCount = D.CATEGORIES.filter(function (c) { return c.open; }).length;
    const statsHtml = '<div class="stats-band stagger">' +
      '<div class="stat-cell"><span class="stat-num">' + D.CATEGORIES.length + '</span>' +
      '<span class="stat-label"><span data-icon="layers"></span>在架测评门类</span></div>' +
      '<div class="stat-cell"><span class="stat-num">' + openCount + '</span>' +
      '<span class="stat-label"><span data-icon="sparkles"></span>即刻可测（演示题库）</span></div>' +
      '<div class="stat-cell"><span class="stat-num">' + results.length + '</span>' +
      '<span class="stat-label"><span data-icon="file-text"></span>本设备已存报告</span></div>' +
      '</div>';

    // 测试档案入口：完成全部在架门类后解锁「查看完整人格档案」
    const openCats = D.CATEGORIES.filter(function (c) { return c.open; });
    const doneMap = {};
    results.forEach(function (r) { if (r.categoryId) doneMap[r.categoryId] = true; });
    const doneCount = openCats.filter(function (c) { return doneMap[c.id]; }).length;
    const allDone = openCats.length > 0 && doneCount >= openCats.length;
    const pct = openCats.length ? Math.round(doneCount / openCats.length * 100) : 0;
    const profileHtml =
      '<a class="profile-strip" href="#/archive">' +
      '  <span class="profile-ico"><span data-icon="sparkles"></span></span>' +
      '  <span class="profile-body">' +
      '    <span class="profile-title">完整人格档案<span class="profile-en">TEST ARCHIVE · ' + doneCount + '/' + openCats.length + '</span></span>' +
      '    <span class="profile-sub">' + (allDone
        ? '全部测评已完成，AI 现在可以综合你的全部结果，生成一份跨测评的完整人格画像。'
        : '已完成 ' + doneCount + '/' + openCats.length + ' 项测评，完成全部后即可解锁 AI 跨测评综合画像。') + '</span>' +
      '    <span class="profile-progress"><span class="profile-fill" style="width:' + pct + '%"></span></span>' +
      '  </span>' +
      '  <span class="profile-cta">' + (allDone ? '查看档案' : '继续完成') + '<span data-icon="arrow-right"></span></span>' +
      '</a>';

    // 门类卡片
    const catHtml = D.CATEGORIES.map(function (c) {
      const locked = !c.open;
      return '<button type="button" class="cat-card' + (locked ? ' locked' : '') + '" data-cat="' + c.id + '" ' + (locked ? 'aria-disabled="true"' : '') + '>' +
        (c.tag ? '<span class="cat-badge tag ' + (locked ? 'tag-ghost' : 'tag-sage') + '">' + esc(c.tag) + '</span>' : '') +
        '<span class="cat-ico" style="background:' + c.tint + '"><span data-icon="' + c.icon + '"></span></span>' +
        '<span class="cat-name">' + esc(c.name) + '</span>' +
        '<span class="cat-en">' + esc(c.en) + '</span>' +
        '<span class="cat-desc">' + esc(c.desc) + '</span>' +
        '<span class="cat-foot">' +
        '  <span class="cat-meta"><span data-icon="clock"></span><span class="cat-meta-t">' + esc(c.duration) + '</span></span>' +
        '  <span class="cat-go">' + (locked ? '筹备中' : '开始测评') + '<span data-icon="arrow-right"></span></span>' +
        '</span>' +
        '</button>';
    }).join('');

    // 核心优势
    const FEATURES = [
      { no: '01', icon: 'book-open', tint: '#9A7B60', soft: '#F0E4D3', title: '清晰标注来源', text: 'MBTI 性格类型为自研 48 题题本（已标注非官方）；霍兰德为 O*NET® 授权编译；其余改编/译制量表均已在题本、报告与文档中标注来源与授权口径。' },
      { no: '02', icon: 'shield-check', tint: '#77836B', soft: '#E4E7D9', title: '凭码使用 · 隐私克制', text: '免注册、免登录即可测评；作答与报告仅保存在当前设备浏览器（演示版不收集任何身份信息）。' },
      { no: '03', icon: 'save-check', tint: '#B08D57', soft: '#F1E7CE', title: '即答即存 · 随时续答', text: '每一题的选择都会自动保存，中途退出、误关页面都不必重来，回来即可继续。' },
      { no: '04', icon: 'file-text', tint: '#7D8A97', soft: '#E1E6EA', title: '报告随设备存档', text: '完成后自动生成类型代码、维度图表与解读，报告按设备存档，可随时回看。' }
    ];
    const featHtml = FEATURES.map(function (f) {
      return '<div class="feat-card"><span class="feat-no">#' + f.no + '</span>' +
        '<span class="feat-ico" style="background:' + f.soft + ';color:' + f.tint + '"><span data-icon="' + f.icon + '"></span></span>' +
        '<div class="feat-title">' + esc(f.title) + '</div>' +
        '<div class="feat-text">' + esc(f.text) + '</div></div>';
    }).join('');

    // 常见问题
    const FAQS = [
      { q: '需要注册或登录账号吗？', a: '不需要。演示版点击「获取演示码」即可自助开始，也可以输入已有码激活；码与设备绑定后，再次访问可直接续答或查看报告。' },
      { q: '一张专属码可以在多台设备使用吗？', a: '不可以。体验码首次激活即与当前设备绑定，防止同一份码在多个设备流转。演示数据仅存于当前浏览器，清除浏览器数据后设备绑定会重置，重新获取体验码即可。' },
      { q: '中途退出或误关页面会丢失进度吗？', a: '不会。每道题选择都会自动保存，中途退出、误关页面都不必重来，回来即可继续。' },
      { q: '测评结果如何查看与保存？', a: '完成全部题目后自动生成报告，包含类型代码、维度图表与解读，并按设备存档。首页「往期报告」可随时回看。' },
      { q: '这些测评专业吗？', a: '在架测评均采用经典框架与公开量表的授权中文编译或本土化改编，题本已逐条标注来源与授权口径（如霍兰德为 O*NET® 授权编译版）。报告仅供自我探索参考，不构成医疗或心理诊断。' }
    ];
    const faqHtml = FAQS.map(function (f, i) {
      return '<details class="faq-item"' + (i === 0 ? ' open' : '') + '>' +
        '<summary><span>' + esc(f.q) + '</span><span class="faq-chev"><span data-icon="chevron-down"></span></span></summary>' +
        '<div class="faq-body">' + esc(f.a) + '</div></details>';
    }).join('');

    // 往期报告
    let reportHtml = '';
    if (results.length) {
      const cards = results.slice(0, 4).map(function (r) {
        const cat = D.getCategory(r.categoryId);
        return '<button type="button" class="report-card" data-report="' + r.id + '">' +
          '<span class="report-type">' + esc(r.typeCode || '--') + '</span>' +
          '<span class="report-info"><span class="report-name">' + esc(cat ? cat.name : r.categoryId) + '</span>' +
          '<span class="report-date">' + fmtDate(r.createdAt) + '</span></span>' +
          '<span class="report-open"><span data-icon="chevron-right"></span></span>' +
          '</button>';
      }).join('');
      reportHtml =
        '<div class="section" id="reports">' +
        '  <div class="section-head"><div><span class="sec-no">02 · MY ARCHIVE</span><h2 class="sec-title">往期报告</h2></div>' +
        '  <p class="sec-sub">结果已随本设备存档，可随时回看。</p></div>' +
        '  <div class="report-grid">' + cards + '</div>' +
        '</div>';
    }

    render('#stage',
      '<div class="hero">' +
      '  <div class="hero-orbit" aria-hidden="true"><svg viewBox="0 0 560 260" fill="none" stroke="currentColor">' +
      '    <circle cx="280" cy="130" r="120" stroke="#E0D5C2" stroke-width="1"/><circle cx="280" cy="130" r="176" stroke="#E6DCCB" stroke-width=".7" stroke-dasharray="3 6"/>' +
      '    <ellipse cx="280" cy="130" rx="176" ry="60" stroke="#D8CDBB" stroke-width=".8" transform="rotate(-18 280 130)"/>' +
      '    <circle cx="436" cy="92" r="5" fill="#9A7B60"/><circle cx="168" cy="200" r="3" fill="#B08D57"/>' +
      '  </svg></div>' +
      '  <div class="hero-kicker">THE INWARD JOURNEY</div>' +
      '  <h1>向内而行，<br><em>遇见真实的自己</em></h1>' +
      '  <p class="hero-sub">专业的心理测评工具集合。本网站为在线演示版：点击「获取演示码」即可免注册体验——答案不在别处，而在你心里。</p>' +
      '  <div class="hero-cta">' +
      '    <a class="btn btn-primary btn-lg" href="#cats"><span data-icon="compass"></span>选择测评</a>' +
      '    <a class="btn btn-ghost btn-lg" href="#faq"><span data-icon="book-open"></span>了解常见问题</a>' +
      '  </div>' +
      '  <p class="hero-note"><span data-icon="shield-check"></span>体验码一码一设备，激活后与当前设备绑定；演示数据仅保存在本机浏览器</p>' +
      '</div>' +
      '<div class="wrap">' +
      contHtml +
      statsHtml +
      profileHtml +
      '<div class="section" id="cats">' +
      '  <div class="section-head">' +
      '    <div><span class="sec-no">01 · CATEGORIES</span><h2 class="sec-title">选择你的测评</h2></div>' +
      '    <p class="sec-sub">点击门类开始。首次使用需输入专属激活码；绑定后再次进入可直接继续。</p>' +
      '  </div>' +
      '  <div class="cat-grid stagger">' + catHtml + '</div>' +
      '  <div class="cat-note"><span data-icon="layers"></span>心理健康自评（PHQ-9 + GAD-7 · 完整 16 题）、大五人格（IPIP-NEO-120）与暗黑人格（SD3）完整版现已可测，题本均逐条收录、未增删；来源与授权口径见各报告页脚。' +
      '  <a class="link-like" href="#faq">查看常见问题</a></div>' +
      '</div>' +
      reportHtml +
      '<div class="section" id="why">' +
      '  <div class="section-head">' +
      '    <div><span class="sec-no">03 · WHY INNERWAY</span><h2 class="sec-title">为什么选择「向内而行」</h2></div>' +
      '    <p class="sec-sub">安静、克制、可信赖的自我探索工具。</p>' +
      '  </div>' +
      '  <div class="feat-grid stagger">' + featHtml + '</div>' +
      '</div>' +
      '<div class="section" id="faq">' +
      '  <div class="section-head">' +
      '    <div><span class="sec-no">04 · FAQ</span><h2 class="sec-title">常见问题</h2></div>' +
      '  </div>' +
      '  <div class="faq-list">' + faqHtml + '</div>' +
      '</div>' +
      '</div>');
    setShell('home');

    // 事件绑定
    $$('.cat-card', $('#stage')).forEach(function (card) {
      card.addEventListener('click', function () { openCategory(card.getAttribute('data-cat')); });
    });
    $$('[data-continue]', $('#stage')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        const catId = btn.getAttribute('data-continue');
        const item = active.find(function (i) { return i.categoryId === catId; });
        if (item) { startQuiz(catId, item.code, null, item.variant || null); location.hash = '#/quiz/' + catId; }
      });
    });
    $$('[data-report]', $('#stage')).forEach(function (btn) {
      btn.addEventListener('click', function () { location.hash = '#/result/' + btn.getAttribute('data-report'); });
    });
  }

  /* ================= SRI（性压抑）结果页 ================= */
  const SRI_COLOR = {
    'very-low': ['#E7E5DA', '#5C6A52'], 'low': ['#E7E5DA', '#5C6A52'],
    'moderate': ['#F1E6CE', '#8A6B33'], 'high': ['#F0E3D6', '#93563F'],
    'very-high': ['#F3E3DB', '#93563F']
  };
  function renderSri(rep, cat) {
    setShell('result');
    const sri = rep.sri || {};
    const [lvlBg, lvlFg] = SRI_COLOR[sri.level] || SRI_COLOR.moderate;
    const variant = rep.variant === 'full' ? '完整测试' : '快速测试';
    const dimsKpis = (rep.dims || []).map(function (d) {
      const hot = d.z > 1;
      const low = d.z < -0.5;
      return '<span class="dim-chip"><span class="dim-body"><span class="dim-name">' + esc(d.name) + '</span>' +
        '<span class="dim-val">高于约 ' + (d.ptile || 0) + '% 参考人群</span></span>' +
        '<span class="dim-tag' + (hot ? ' dim-tie' : '') + '">' + (hot ? '值得留意' : (low ? '低于典型' : '典型范围')) + '</span></span>';
    }).join('');

    render('#stage',
      '<div class="wrap" style="max-width:920px">' +
      '  <div class="result-hero">' +
      '    <div class="result-badge"><span data-icon="check-circle"></span>测评完成 · 报告已自动保存</div>' +
      '    <div class="sr-variant">' + esc(cat ? cat.name : '性压抑心理评估') + ' · ' + variant + '</div>' +
      '    <div class="sr-score">SRI&nbsp;<b>' + sri.score + '</b><i>/ 100</i></div>' +
      '    <div class="sr-level" style="background:' + lvlBg + ';color:' + lvlFg + '">' + esc(sri.levelLabel || '') + '</div>' +
      '    <div class="result-type-sub" style="max-width:640px">SRI 指数综合了回避、内疚、羞耻与抑制-兴奋优势四类倾向，分值越高代表压抑倾向越明显。' +
      '你的结果高于约 ' + (sri.percentile || 0) + '% 的参考人群——这一对比仅为辅助理解，不意味着好或坏。</div>' +
      '    <div class="dims-strip">' + dimsKpis + '</div>' +
      '  </div>' +
      '  <div class="chart-cards">' +
      '    <div class="chart-card"><div class="chart-title">四维倾向剖面</div><div class="chart-sub">浅色区间为大多数人的典型范围，条形越长说明越明显</div><div id="srDims"></div></div>' +
      '    <div class="chart-card"><div class="chart-title">维度结构雷达</div><div class="chart-sub">各维度相对参考人群的分位（越靠外越明显）</div><div class="radar-wrap" id="srRadar"></div></div>' +
      '  </div>' +
      '  <div class="read-block"><div class="read-sec-head"><span class="read-sec-ico" style="background:#EFE5D8;color:#9A7B60"><span data-icon="book-open"></span></span>' +
      '    <span class="read-sec-title">核心解读</span></div>' +
      (rep.summary || []).map(function (p) { return '<p class="sr-para">' + esc(p) + '</p>'; }).join('') +
      '</div>' +
      '  <div class="read-block"><div class="read-sec-head"><span class="read-sec-ico" style="background:#E1E6EA;color:#7D8A97"><span data-icon="sparkles"></span></span>' +
      '    <span class="read-sec-title">温和的建议</span></div>' +
      '    <ul class="read-sec-list">' + (rep.tips || []).slice(0, 3).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>' +
      '  <div class="result-actions">' +
      '    <a class="btn btn-primary" href="#cats"><span data-icon="arrow-left"></span>返回主页 · 选择测评</a>' +
      '    <a class="btn btn-ghost" href="#cats"><span data-icon="compass"></span>选择其他测评</a>' +
      '  </div>' +
      '  <div class="result-disclaimer"><span data-icon="info-circle"></span>' + esc(rep.disclaimer || '') + '</div>' +
      '</div>');
    setShell('result');
    charts.zMeters($('#srDims'), { dims: rep.dims || [] });
    const srAxisMap = { sos: '回避', guilt: '内疚', shame: '羞耻', sis: '抑制/兴奋' };
    const srAxes = (rep.dims || []).map(function (d) {
      return { short: srAxisMap[d.key] || d.name, value: Math.round((d.ptile != null ? d.ptile : 50)) };
    });
    if (srAxes.length >= 3) charts.radar($('#srRadar'), { axes: srAxes, title: (cat ? cat.name : '性压抑评估') + ' · 维度结构', colors: ['#A9826A', '#77836B', '#B08D57', '#7D8A97'] });
    icons.mount($('#stage'));
    window.scrollTo({ top: 0 });
  }

  /* ================= 控制欲（doc 动机 / cbs 行为）结果页 ================= */
  function renderCtrlResult(rep, cat) {
    setShell('result');
    const isDoc = rep.chart === 'doc';
    const isCbs = !isDoc;
    const score = rep.score || {};
    const [lvlBg, lvlFg] = { low: ['#E7E5DA', '#5C6A52'], mid: ['#F1E6CE', '#8A6B33'], high: ['#F3E3DB', '#93563F'] }[score.level] || ['#F1E6CE', '#8A6B33'];
    const variantLabel = isDoc ? '控制欲动机测试 · DOC 改编' : '亲密关系控制行为测试 · CBS 改编';
    const title2 = isDoc ? '情境面剖面' : '行为领域频率';
    const sub2 = isDoc ? '四个情境面均分（满分 7 分，代表你"想要掌控"的侧重）' : '各领域行为频率均分（满分 5 分；≥2.5 标注为需留意）';

    const rowItem = function (r, max) {
      const ratio = Math.min(100, Math.round((r.avg / max) * 100));
      const flag = (!isDoc && r.alert) ? '<span class="dim-tag dim-tie">值得留意</span>' : '';
      return '<div class="sr-srow"><div class="sr-srow-head"><span>' + esc(r.name) + flag + '</span>' +
        '<b>' + r.avg + ' / ' + max + (isCbs ? '（共 ' + r.raw + ' 分）' : '') + '</b></div>' +
        '<div class="sr-track"><div class="sr-fill' + (flag ? ' is-alert' : '') + '" style="width:' + Math.max(3, ratio) + '%"></div></div></div>';
    };

    const rowsHtml = (isDoc ? rep.facets : rep.domains).map(function (r) { return rowItem(r, isDoc ? 7 : 5); }).join('');
    const headNote = isDoc
      ? '<div class="result-type-sub" style="max-width:660px">总分约 ' + score.raw + ' / 140。作为参考，该量表的普遍平均水平约为 100 分，本结果仅供对照与自我探索，不代表好或坏。</div>'
      : '<div class="result-type-sub" style="max-width:660px">27 类行为里，你报告的整体出现频率约 ' + score.mean + ' / 5。这衡量的是行为频率，不等于"你是什么样的人"。</div>';

    render('#stage',
      '<div class="wrap" style="max-width:920px">' +
      '  <div class="result-hero">' +
      '    <div class="result-badge"><span data-icon="check-circle"></span>测评完成 · 报告已自动保存</div>' +
      '    <div class="sr-variant">' + esc(cat ? cat.name : '控制欲心理评估') + ' · ' + variantLabel + '</div>' +
      (isDoc
        ? '<div class="sr-score">' + score.raw + '<i>/ 140</i></div>'
        : '<div class="sr-score">' + score.mean + '<i>/ 5 整体频率</i></div>') +
      '    <div class="sr-level" style="background:' + lvlBg + ';color:' + lvlFg + '">' + esc(score.levelText || '') + '</div>' +
      headNote +
      '  </div>' +
      '  <div class="chart-cards">' +
      '    <div class="chart-card"><div class="chart-title">维度雷达</div><div class="chart-sub">各维度强度（%，越靠外越明显）</div><div class="radar-wrap" id="ctrlRadar"></div></div>' +
      '    <div class="chart-card"><div class="chart-title">' + title2 + '</div><div class="chart-sub">' + sub2 + '</div>' + rowsHtml + '</div>' +
      '    <div class="chart-card"><div class="chart-title">如何理解</div><div class="chart-sub">阅读提示与行动方向</div>' +
      (isDoc
        ? '<ul class="read-sec-list">' + (rep.tips || []).slice(0, 3).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>'
        : '<ul class="read-sec-list">' + (rep.tips || []).slice(0, 3).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>') +
      '    </div></div>' +
      '  <div class="read-block"><div class="read-sec-head"><span class="read-sec-ico" style="background:#EFEAF5;color:#8C7AA6"><span data-icon="book-open"></span></span>' +
      '    <span class="read-sec-title">核心解读</span></div>' +
      (rep.summary || []).map(function (p) { return '<p class="sr-para">' + esc(p) + '</p>'; }).join('') +
      '</div>' +
      '  <div class="result-actions">' +
      '    <a class="btn btn-primary" href="#cats"><span data-icon="arrow-left"></span>返回主页 · 选择测评</a>' +
      '    <a class="btn btn-ghost" href="#cats"><span data-icon="compass"></span>选择其他测评</a>' +
      '  </div>' +
      '  <div class="result-disclaimer"><span data-icon="info-circle"></span>' + esc(rep.disclaimer || '') + '</div>' +
      '</div>');
    setShell('result');
    const cSrc = isDoc ? (rep.facets || []) : (rep.domains || []);
    const cMx = isDoc ? 7 : 5;
    const cAxes = cSrc.map(function (r) {
      const nm = String((r && r.name) || '');
      return { short: nm.length > 6 ? nm.slice(0, 6) + '…' : nm, value: Math.round((r.avg / cMx) * 100) };
    });
    if (cAxes.length >= 3) charts.radar($('#ctrlRadar'), { axes: cAxes, title: (cat ? cat.name : '控制欲评估') + ' · 维度剖面', colors: ['#A9826A', '#B08D57', '#7D8A97', '#77836B', '#8A6E8C', '#6E7B62'] });
    icons.mount($('#stage'));
    window.scrollTo({ top: 0 });
  }

  /* ================= 暗黑三特质（SD3 / Dirty Dozen）结果页 ================= */
  const DT_PAL = {
    M: { hex: '#9A7B60', hexSoft: '#EFE5D8' },
    N: { hex: '#B08D57', hexSoft: '#F1E6CE' },
    P: { hex: '#8A6E8C', hexSoft: '#EAE2EA' }
  };
  const DT_LVL = {
    low: ['#E7E5DA', '#5C6A52'], mid: ['#F1E6CE', '#8A6B33'], high: ['#F3E3DB', '#93563F']
  };
  function renderDarkResult(rep, cat) {
    setShell('result');
    const dims = rep.dims || [];
    const max = rep.scaleMax || 5;
    const chips = dims.map(function (d) {
      const [lbg, lfg] = DT_LVL[d.level.key] || DT_LVL.mid;
      return '<span class="dim-chip">' +
        '<span class="dim-letters"><em style="background:' + DT_PAL[d.key].hex + '">' + d.key + '</em></span>' +
        '<span class="dim-body"><span class="dim-name">' + esc(d.name) + '</span>' +
        '<span class="dim-val">均分 ' + d.mean + ' / ' + max + '</span></span>' +
        '<span class="dim-tag" style="background:' + lbg + ';color:' + lfg + '">' + esc(d.level.label) + '</span>' +
        '</span>';
    }).join('');
    const rows = dims.map(function (d) {
      const ratio = Math.max(3, Math.min(100, d.pct || 0));
      return '<div class="sr-srow"><div class="sr-srow-head"><span>' + esc(d.key) + ' · ' + esc(d.name) + '</span>' +
        '<b>' + d.mean + ' / ' + max + '</b></div>' +
        '<div class="sr-track"><div class="sr-fill" style="width:' + ratio + '%;background:' + DT_PAL[d.key].hex + '"></div></div>' +
        '<div class="sr-note">' + esc(d.text || '') + '</div></div>';
    }).join('');
    const legend = dims.map(function (d) {
      return '<span><i style="background:' + DT_PAL[d.key].hex + '"></i>' + esc(d.name.split('（')[0]) + '</span>';
    }).join('');
    const note = rep.variant === 'sd3'
      ? '说明：下列对照仅为帮助理解，并非诊断切点。本报告将你的得分与亚临床人群的平均水平进行相对比较，用于呈现你在三个特质上的倾向强弱。'
      : '本报告将每题 1–7 的自评结果换算为 0–100 的相对强度：数值越高，说明你对该特质相关状态的认同越明显。';

    render('#stage',
      '<div class="wrap" style="max-width:920px">' +
      '  <div class="result-hero">' +
      '    <div class="result-badge"><span data-icon="check-circle"></span>测评完成 · 报告已自动保存</div>' +
      '    <div class="sr-variant">' + esc(cat ? cat.name : '暗黑人格') + ' · ' + esc(rep.scaleLabel || '') + '</div>' +
      '    <div class="result-type-wrap">' +
      '      <div class="result-type">' + esc(rep.codeRank || rep.typeCode || 'M·N·P') + '</div>' +
      '      <div class="result-type-name">' + esc(rep.typeName || '') + '</div>' +
      '      <div class="result-type-sub" style="max-width:660px">' + esc(rep.tagline || '') + '</div>' +
      '    </div>' +
      '    <div class="dims-strip">' + chips + '</div>' +
      '  </div>' +
      '  <div class="chart-cards">' +
      '    <div class="chart-card"><div class="chart-title">三特质倾向雷达</div>' +
      '      <div class="chart-sub">均分映射 0–100 的相对强度（中心=低，外圈=高）</div>' +
      '      <div class="radar-wrap" id="dtRadar"></div>' +
      '      <div class="legend">' + legend + '</div></div>' +
      '    <div class="chart-card"><div class="chart-title">整体对照</div>' +
      '      <div class="chart-sub">各维度自评强度（每题 1–' + max + ' 计分）</div>' + rows + '</div>' +
      '  </div>' +
      '  <div class="read-block"><div class="read-sec-head">' +
      '    <span class="read-sec-ico" style="background:#EAE2EA;color:#8A6E8C"><span data-icon="book-open"></span></span>' +
      '    <span class="read-sec-title">核心解读</span></div>' +
      '    <div class="result-type-sub" style="max-width:none;color:#4C463C">' + note + '</div>' +
      (rep.summary || []).map(function (p) { return '<p class="sr-para">' + esc(p) + '</p>'; }).join('') +
      '</div>' +
      '  <div class="read-block"><div class="read-sec-head">' +
      '    <span class="read-sec-ico" style="background:#EFE5D8;color:#9A7B60"><span data-icon="sparkles"></span></span>' +
      '    <span class="read-sec-title">温和的提醒</span></div>' +
      '    <ul class="read-sec-list">' + (rep.tips || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>' +
      '  <div class="result-actions">' +
      '    <a class="btn btn-primary" href="#cats"><span data-icon="arrow-left"></span>返回主页 · 选择测评</a>' +
      '    <a class="btn btn-ghost" href="#cats"><span data-icon="compass"></span>选择其他测评</a>' +
      '  </div>' +
      '  <div class="result-disclaimer"><span data-icon="info-circle"></span>' + esc(rep.disclaimer || '') + '</div>' +
      '</div>');
    setShell('result');
    const axesR = dims.map(function (d) {
      return { short: d.key, value: Math.max(0, Math.min(100, d.pct || 0)) };
    });
    charts.radar($('#dtRadar'), {
      axes: axesR,
      title: (cat ? cat.name : '暗黑人格') + ' 三特质剖面',
      colors: dims.map(function (d) { return DT_PAL[d.key].hex; })
    });
    icons.mount($('#stage'));
    window.scrollTo({ top: 0 });
  }

  /* ================= 大五人格（IPIP-NEO-120）结果页 ================= */
  const BF_COLORS = { N: '#7D8A97', E: '#B08D57', O: '#9A7B60', A: '#77836B', C: '#8A6E8C' };
  function renderBigFive(rep, cat) {
    setShell('result');
    const dims = rep.dims || [];
    const chips = dims.map(function (d) {
      const lv = d.level || {};
      const hot = lv.key === 'high';
      const cold = lv.key === 'low';
      const [lbg, lfg] = hot ? ['#EFE5D8', '#8A5A3B'] : (cold ? ['#E1E6EA', '#4F5D6A'] : ['#F1E7CE', '#8A6B33']);
      return '<span class="dim-chip">' +
        '<span class="dim-letters"><em style="background:' + (BF_COLORS[d.key] || '#9A7B60') + '">' + d.short + '</em></span>' +
        '<span class="dim-body"><span class="dim-name">' + esc(d.name) + '</span>' +
        '<span class="dim-val">' + d.mean.toFixed(1) + ' / 5</span></span>' +
        '<span class="dim-tag" style="background:' + lbg + ';color:' + lfg + '">' + esc(lv.label || '') + '</span>' +
        '</span>';
    }).join('');
    const legend = dims.map(function (d) {
      return '<span><i style="background:' + (BF_COLORS[d.key] || '#9A7B60') + '"></i>' + esc(d.name) + '</span>';
    }).join('');
    const reads = (rep.summary || []).map(function (p) {
      return '<div class="read-sec"><p class="sr-para" style="margin:0">' + esc(p) + '</p></div>';
    }).join('');

    render('#stage',
      '<div class="wrap" style="max-width:920px">' +
      '  <div class="result-hero">' +
      '    <div class="result-badge"><span data-icon="check-circle"></span>测评完成 · 报告已自动保存</div>' +
      '    <div class="sr-variant">' + esc(cat ? cat.name : '大五人格') + ' · IPIP-NEO-120 完整版（30 个子维度）</div>' +
      '    <div class="result-type-wrap">' +
      '      <div class="result-type">' + esc(rep.typeCode || 'BIG-5') + '</div>' +
      '      <div class="result-type-name">' + esc(rep.typeName || '') + '</div>' +
      '      <div class="result-type-sub" style="max-width:680px">' + esc(rep.tagline || '') + '</div>' +
      '    </div>' +
      '    <div class="dims-strip">' + chips + '</div>' +
      '  </div>' +
      '  <div class="chart-cards">' +
      '    <div class="chart-card"><div class="chart-title">五域人格雷达</div>' +
      '      <div class="chart-sub">从中心向外为倾向强度（%）</div>' +
      '      <div class="radar-wrap" id="bfRadar"></div>' +
      '      <div class="legend">' + legend + '</div></div>' +
      '    <div class="chart-card"><div class="chart-title">五域均分对比</div>' +
      '      <div class="chart-sub">1–5 均分（含反向题翻转后）</div><div id="bfBars"></div></div>' +
      '  </div>' +
      '  <div class="read-block"><div class="read-sec-head">' +
      '    <span class="read-sec-ico" style="background:#F1E7CE;color:#8A6B33"><span data-icon="book-open"></span></span>' +
      '    <span class="read-sec-title">五域解读与子维度速览</span></div>' + reads + '</div>' +
      '  <div class="read-block"><div class="read-sec-head">' +
      '    <span class="read-sec-ico" style="background:#EFE5D8;color:#9A7B60"><span data-icon="sparkles"></span></span>' +
      '    <span class="read-sec-title">使用建议</span></div>' +
      '    <ul class="read-sec-list">' + (rep.tips || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>' +
      '  <div class="result-actions">' +
      '    <a class="btn btn-primary" href="#cats"><span data-icon="arrow-left"></span>返回主页 · 选择测评</a>' +
      '    <a class="btn btn-ghost" href="#cats"><span data-icon="compass"></span>选择其他测评</a>' +
      '  </div>' +
      '  <div class="result-disclaimer"><span data-icon="info-circle"></span>' + esc(rep.disclaimer || '') + '</div>' +
      '</div>');
    setShell('result');
    const axesR = dims.map(function (d) {
      return { short: d.short, value: d.pct, color: BF_COLORS[d.key] || '#9A7B60' };
    });
    const axesB = dims.map(function (d) { return { label: d.name, value: d.mean }; });
    charts.radar($('#bfRadar'), { axes: axesR, title: (cat ? cat.name : '大五人格') + ' · 五域剖面', colors: dims.map(function (d) { return BF_COLORS[d.key] || '#9A7B60'; }) });
    charts.bars($('#bfBars'), { axes: axesB, color: '#B08D57' });
    icons.mount($('#stage'));
    window.scrollTo({ top: 0 });
  }

  /* ================= 心理健康自评（PHQ-9 + GAD-7）结果页 ================= */
  const MH_DIM_STYLE = {
    'PHQ-9': { fill: '#6E8B7A', soft: '#DFE8E1' },
    'GAD-7': { fill: '#7D8A97', soft: '#E1E6EA' }
  };
  const MH_BAND_STYLE = [
    ['#E7E5DA', '#4F6B54'],
    ['#F1E6CE', '#8A6B33'],
    ['#F0E3D6', '#93563F'],
    ['#F3DFD8', '#A2463A']
  ];
  const MH_RANGES = { 'PHQ-9': ['0–4', '5–9', '10–14', '15–27'], 'GAD-7': ['0–4', '5–9', '10–14', '15–21'] };
  function renderMHealth(rep, cat) {
    setShell('result');
    const dims = rep.dims || [];
    const overallIdx = dims.reduce(function (m, d) { return Math.max(m, (d.band && d.band.idx) || 0); }, 0);
    const ov = MH_BAND_STYLE[overallIdx] || MH_BAND_STYLE[0];
    const chips = dims.map(function (d) {
      const st = MH_DIM_STYLE[d.key] || MH_DIM_STYLE['PHQ-9'];
      const [bg, fg] = MH_BAND_STYLE[(d.band && d.band.idx) || 0] || MH_BAND_STYLE[0];
      return '<span class="dim-chip">' +
        '<span class="dim-letters"><em style="background:' + st.soft + ';color:' + st.fill + ';width:auto;min-width:30px;border-radius:99px;padding:0 8px;font-size:10.5px">' + d.key + '</em></span>' +
        '<span class="dim-body"><span class="dim-name">' + esc(d.name) + '</span>' +
        '<span class="dim-val">' + d.total + ' / ' + d.max + ' 分</span></span>' +
        '<span class="dim-tag" style="background:' + bg + ';color:' + fg + '">' + esc(d.band.label) + '</span></span>';
    }).join('');
    const cards = dims.map(function (d) {
      const st = MH_DIM_STYLE[d.key] || MH_DIM_STYLE['PHQ-9'];
      const bi = (d.band && d.band.idx) || 0;
      const ranges = MH_RANGES[d.key] || MH_RANGES['PHQ-9'];
      const segs = ranges.map(function (rg, i) {
        const [bg, fg] = i === bi ? (MH_BAND_STYLE[i] || MH_BAND_STYLE[0]) : ['#EFEAE0', '#A79D8C'];
        return '<span style="flex:1;min-width:0;text-align:center;font-size:11px;line-height:1;white-space:nowrap;padding:7px 2px;border-radius:8px;background:' + bg + ';color:' + fg + ';font-weight:' + (i === bi ? 700 : 400) + '">' + rg + '</span>';
      }).join('');
      const ratio = d.max ? Math.max(2, Math.min(100, Math.round((d.total / d.max) * 100))) : 0;
      return '<div class="chart-card">' +
        '<div class="chart-title">' + esc(d.name) + ' · 症状负荷</div>' +
        '<div class="chart-sub">过去两周 ' + d.total + '/' + d.max + ' 分 · 量表区间：' + esc(d.band.label) + '</div>' +
        '<div class="sr-srow" style="margin-top:14px"><div class="sr-srow-head"><span>' + esc(d.key) + ' 合计</span><b>' + d.total + ' / ' + d.max + '</b></div>' +
        '<div class="sr-track"><div class="sr-fill" style="width:' + ratio + '%;background:linear-gradient(90deg,' + st.fill + ',' + st.fill + 'cc)"></div></div></div>' +
        '<div class="mh-scale" style="display:flex;gap:5px;margin-top:12px">' + segs + '</div>' +
        '<div class="chart-sub" style="margin-top:8px">分级参考（按量表临床切点，不等距）：无明显症状 / 轻度 / 中度 / 中重度或重度</div>' +
        '</div>';
    }).join('');
    const riskCard = rep.riskItem9
      ? '<div class="read-block" style="border:1px solid #EBCFC3;background:linear-gradient(135deg,#FBF0EA,#F6E2D8);margin-top:6px">' +
        '<div class="read-sec-head"><span class="read-sec-ico" style="background:#EFD8CE;color:#A2463A"><span data-icon="heart"></span></span>' +
        '<span class="read-sec-title" style="color:#8A3A2A">请认真对待的信号 · 第 9 题</span></div>' +
        '<p class="sr-para" style="color:#6B3A2D">你在"有不如死掉或用某种方式伤害自己的念头"一题上选择了并非"完全没有"的选项。请务必认真对待：立即拨打<strong>全国统一心理援助热线 <a class="link-like" href="tel:12356">12356</a></strong>（或 120），或联系你信任的人、就近医院精神科。主动寻求帮助是勇敢的选择，你值得被倾听与支持。</p></div>'
      : '';

    render('#stage',
      '<div class="wrap" style="max-width:920px">' +
      '  <div class="result-hero">' +
      '    <div class="result-badge"><span data-icon="check-circle"></span>测评完成 · 报告已自动保存</div>' +
      '    <div class="sr-variant">' + esc(cat ? cat.name : '心理健康自评') + ' · PHQ-9 + GAD-7 · 16 题 · 完整版</div>' +
      '    <div class="result-type-wrap">' +
      '      <div class="result-type" style="color:' + ov[1] + '">' + esc(rep.typeCode || '') + '</div>' +
      '      <div class="result-type-name">' + esc(rep.typeName || '') + '</div>' +
      '      <div class="result-type-sub" style="max-width:680px">' + esc(rep.tagline || '') + '</div>' +
      '    </div>' +
      '    <div class="dims-strip">' + chips + '</div>' +
      '  </div>' + riskCard +
      '  <div class="chart-cards">' + cards + '</div>' +
      '  <div class="read-block"><div class="read-sec-head">' +
      '    <span class="read-sec-ico" style="background:#DFE8E1;color:#4E6B57"><span data-icon="activity"></span></span>' +
      '    <span class="read-sec-title">整体与分维度解读</span></div>' +
      (rep.summary || []).map(function (p) { return '<p class="sr-para">' + esc(p) + '</p>'; }).join('') + '</div>' +
      '  <div class="read-block"><div class="read-sec-head">' +
      '    <span class="read-sec-ico" style="background:#EFE5D8;color:#9A7B60"><span data-icon="sparkles"></span></span>' +
      '    <span class="read-sec-title">自我关怀建议</span></div>' +
      '    <ul class="read-sec-list">' + (rep.tips || []).slice(0, 3).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>' +
      '  <div class="result-actions">' +
      '    <a class="btn btn-primary" href="#cats"><span data-icon="arrow-left"></span>返回主页 · 选择测评</a>' +
      '    <a class="btn btn-ghost" href="#cats"><span data-icon="compass"></span>选择其他测评</a>' +
      '  </div>' +
      '  <div class="result-disclaimer"><span data-icon="info-circle"></span>' + esc(rep.disclaimer || '') + '</div>' +
      '</div>');
    icons.mount($('#stage'));
    window.scrollTo({ top: 0 });
  }

  /* ================= 空间偏好（热区情境）结果页 ================= */
  function renderSpatial(rep, cat) {
    setShell('result');
    const E = rep.E || 0, I = rep.I || 0;
    const answered = rep.answered || 0, total = rep.total || 0;
    const shareE = Math.round(answered ? (E / answered) * 100 : 0);
    const shareI = 100 - shareE;
    const chips = (rep.dims || []).map(function (d) {
      const lv = d.level || {};
      return '<span class="dim-chip">' +
        '<span class="dim-letters"><em style="background:' + (d.key === 'E' ? '#9A7B60' : '#77836B') + '">' + d.short + '</em></span>' +
        '<span class="dim-body"><span class="dim-name">' + esc(d.name) + '</span>' +
        '<span class="dim-val">' + d.val + ' / ' + d.total + ' 次</span></span>' +
        '<span class="dim-tag">' + esc(lv.label || '') + '</span></span>';
    }).join('');
    const rows = (rep.dims || []).map(function (d) {
      return '<div class="sr-srow"><div class="sr-srow-head"><span>' + esc(d.name) + '</span>' +
        '<b>' + d.val + ' / ' + d.total + ' 次（' + d.share + '%）</b></div>' +
        '<div class="sr-track"><div class="sr-fill" style="width:' + Math.max(3, d.share) + '%;background:' + (d.key === 'E' ? 'linear-gradient(90deg,#A9826A,#9A7B60)' : 'linear-gradient(90deg,#93A08A,#77836B)') + '"></div></div>' +
        (d.desc ? '<div class="sr-note">' + esc(d.desc) + '</div>' : '') +
        '</div>';
    }).join('');

    render('#stage',
      '<div class="wrap" style="max-width:920px">' +
      '  <div class="result-hero">' +
      '    <div class="result-badge"><span data-icon="check-circle"></span>测评完成 · 报告已自动保存</div>' +
      '    <div class="sr-variant">' + esc(cat ? cat.name : '空间偏好') + ' · 热区情境 · 4 场景</div>' +
      '    <div class="result-type-wrap">' +
      '      <div class="result-type">' + esc((rep.typeCode || '空间').split('·')[0]) + '</div>' +
      '      <div class="result-type-name">' + esc(rep.typeName || '') + '</div>' +
      '      <div class="result-type-sub" style="max-width:680px">在 ' + answered + ' 个情境场景中，你 ' + E + ' 次选择靠近人群的位置、' + I + ' 次选择安静低打扰的位置。</div>' +
      '    </div>' +
      '    <div class="dims-strip">' + chips + '</div>' +
      '  </div>' +
      '  <div class="chart-cards">' +
      '    <div class="chart-card"><div class="chart-title">E/I 位置选择分布</div>' +
      '      <div class="chart-sub">E ' + shareE + '% · I ' + shareI + '%（' + answered + ' 个场景）</div>' +
      '      <div style="display:flex;height:12px;border-radius:99px;overflow:hidden;background:#ECE5D6;margin-top:14px">' +
      '        <div style="width:' + shareE + '%;background:#9A7B60;transition:width .6s var(--ease)"></div>' +
      '        <div style="width:' + shareI + '%;background:#77836B;transition:width .6s var(--ease)"></div></div>' +
      '      <div class="legend" style="margin-top:14px">' +
      '        <span><i style="background:#9A7B60"></i>E · 靠近人群与互动</span>' +
      '        <span><i style="background:#77836B"></i>I · 安静与低打扰</span></div></div>' +
      '    <div class="chart-card"><div class="chart-title">两个方向的位置选择</div><div class="chart-sub">次数与占比</div>' + rows + '</div>' +
      '  </div>' +
      '  <div class="read-block"><div class="read-sec-head">' +
      '    <span class="read-sec-ico" style="background:#DFE8E1;color:#4E6B57"><span data-icon="map-pin"></span></span>' +
      '    <span class="read-sec-title">空间倾向解读</span></div>' +
      (rep.summary || []).map(function (p) { return '<p class="sr-para">' + esc(p) + '</p>'; }).join('') + '</div>' +
      '  <div class="read-block"><div class="read-sec-head">' +
      '    <span class="read-sec-ico" style="background:#F1E7CE;color:#8A6B33"><span data-icon="sun"></span></span>' +
      '    <span class="read-sec-title">可以留意</span></div>' +
      '    <ul class="read-sec-list">' + (rep.tips || []).slice(0, 3).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>' +
      '  <div class="result-actions">' +
      '    <a class="btn btn-primary" href="#cats"><span data-icon="arrow-left"></span>返回主页 · 选择测评</a>' +
      '    <a class="btn btn-ghost" href="#cats"><span data-icon="compass"></span>选择其他测评</a>' +
      '  </div>' +
      '  <div class="result-disclaimer"><span data-icon="info-circle"></span>' + esc(rep.disclaimer || '') + '</div>' +
      '</div>');
    setShell('result');
    icons.mount($('#stage'));
    window.scrollTo({ top: 0 });
  }

  /* ================= 意象叙事 TAT · 结果页（无计分 · 故事回看 + AI 温柔解读） ================= */
  function renderTat(rep, cat) {
    setShell('result');
    // 题库取出图版（黑白照片优先，SVG 兜底）用于回看
    const g = global.Innerway || {};
    const bank = (g.tat && g.tat.variants && g.tat.variants.main && g.tat.variants.main.bank) || [];
    const figMap = {};
    bank.forEach(function (it) { if (it && it.id) figMap[it.id] = tatFigMarkup(it); });

    const stories = (rep.stories || []).map(function (s, i) {
      return '<div class="tat-story">' +
        '<div class="tat-story-top"><span class="tat-story-no">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="tat-story-meta"><span class="tat-story-title">' + esc(s.title || '') + '</span>' +
        '<span class="tat-story-scene">' + esc(s.scene || '') + '</span></span></div>' +
        (figMap[s.id] ? '<div class="tat-story-fig">' + figMap[s.id] + '</div>' : '') +
        '<div class="tat-story-text">' + esc(s.text) + '</div>' +
        '</div>';
    }).join('') || '<p class="sr-para" style="color:var(--text-sub)">这一卷还没有留下故事。</p>';

    render('#stage',
      '<div class="wrap" style="max-width:920px">' +
      '  <div class="result-hero">' +
      '    <div class="result-badge"><span data-icon="check-circle"></span>测评完成 · 报告已自动保存</div>' +
      '    <div class="sr-variant">' + esc(cat ? cat.name : '意象叙事') + ' · 故事写作 · 无对错</div>' +
      '    <div class="result-type-wrap">' +
      '      <div class="result-type">' + esc(rep.typeCode || 'STORY') + '</div>' +
      '      <div class="result-type-name">' + esc(rep.typeName || '意象叙事') + '</div>' +
      '      <div class="result-type-sub" style="max-width:680px">你为 ' + (rep.answered || 0) + ' 幅画面各讲了一个故事。这份报告没有分数、没有“类型”，它只是温柔地把你的故事交还给你。</div>' +
      '    </div>' +
      '  </div>' +
      '  <div class="read-block"><div class="read-sec-head">' +
      '    <span class="read-sec-ico" style="background:#E3E7EC;color:#54697C"><span data-icon="book-user"></span></span>' +
      '    <span class="read-sec-title">这份报告没有分数</span></div>' +
      '    <p class="sr-para">故事是内心的镜子，但不是量尺——它没有及格线，也不给你贴标签。你可以慢慢读下面的文字，也可以直接请 AI 陪你一起回看这些故事里的你。</p>' +
      '  </div>' +
      '  <div class="tat-section"><div class="chart-title" style="font-size:15px">你写下的故事</div>' +
      '    <div class="chart-sub">' + ((rep.stories || []).length ? '你写下的 ' + (rep.stories || []).length + ' 幅画面与你的讲述' : '画面与你的讲述') + '</div>' + stories + '</div>' +
      (rep.summary && rep.summary.length
        ? '<div class="read-block"><div class="read-sec-head">' +
          '  <span class="read-sec-ico" style="background:#E3E7EC;color:#54697C"><span data-icon="feather"></span></span>' +
          '  <span class="read-sec-title">读完你的故事后，想对你说</span></div>' +
          (rep.summary).map(function (p) { return '<p class="sr-para">' + esc(p) + '</p>'; }).join('') + '</div>'
        : '') +
      (rep.tips && rep.tips.length
        ? '<div class="read-block"><div class="read-sec-head">' +
          '  <span class="read-sec-ico" style="background:#F1E7CE;color:#8A6B33"><span data-icon="sun"></span></span>' +
          '  <span class="read-sec-title">可以留意的方向</span></div>' +
          '  <ul class="read-sec-list">' + (rep.tips || []).slice(0, 3).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>'
        : '') +
      '  <div class="result-actions">' +
      '    <a class="btn btn-primary" href="#cats"><span data-icon="arrow-left"></span>返回主页 · 选择测评</a>' +
      '    <a class="btn btn-ghost" href="#cats"><span data-icon="compass"></span>选择其他测评</a>' +
      '  </div>' +
      '  <div class="result-disclaimer"><span data-icon="info-circle"></span>' + esc(rep.disclaimer || '') + '</div>' +
      '</div>');
    setShell('result');
    icons.mount($('#stage'));
    window.scrollTo({ top: 0 });
  }
  let aiCtxRecord = null; // 最近一次打开的报告记录（含逐题 answers），供 AI 结果区挂载使用

  // AI 自动排版：把「## 小节标题 + 段落/列表 + **加粗**」渲染为站点报告同款卡片
  const AI_THEME = [
    { icon: 'book-open', bg: '#EFE5D8', fg: '#9A7B60' },
    { icon: 'sun', bg: '#F1E7CE', fg: '#8A6B33' },
    { icon: 'moon', bg: '#E1E6EA', fg: '#4F5D6A' },
    { icon: 'compass', bg: '#E4E7D9', fg: '#5C6A52' },
    { icon: 'sparkles', bg: '#F0E4D3', fg: '#93563F' },
    { icon: 'activity', bg: '#DFE8E1', fg: '#4E6B57' },
    { icon: 'heart', bg: '#F0E6DE', fg: '#A2463A' },
    { icon: 'layers', bg: '#EAE2EA', fg: '#7A5E7C' }
  ];
  function aiInline(t) {
    const e = esc(t);
    return e.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }
  function aiFormatHtml(text) {
    const lines = String(text).split(/\r?\n/);
    const segs = [];
    let cur = null;
    const headRe = /^#{1,6}\s+(.+?)\s*$/;
    lines.forEach(function (line) {
      const t = line.replace(/\s+$/, '');
      const m = headRe.exec(t);
      if (m) {
        cur = { title: m[1].replace(/[*_`]/g, '').trim(), lines: [] };
        segs.push(cur);
        return;
      }
      if (!t.trim()) return;
      // 安全网：忽略 markdown 分割线，避免把 “---” 渲染成正文
      if (/^[-=_*]{3,}\s*$/.test(t)) return;
      if (!cur) { cur = { title: null, lines: [] }; segs.push(cur); }
      cur.lines.push(t.trim());
    });
    return segs.map(function (seg, i) {
      const th = AI_THEME[i % AI_THEME.length];
      const bullets = [];
      const paras = [];
      (seg.lines || []).forEach(function (ln) {
        const bm = /^[-•·]\s+/.exec(ln);
        if (bm) bullets.push(aiInline(ln.replace(/^[-•·]\s+/, '')));
        else {
          // 安全网：把 “> …” 引用行渲染为警示色块（AI 输出规范已要求避免，但兜底兼容）
          const qm = /^>\s?/.exec(ln);
          if (qm) paras.push('<div class="ai-quote"><span>⚠️</span><div>' + aiInline(ln.slice(qm[0].length)) + '</div></div>');
          else paras.push('<p class="sr-para">' + aiInline(ln) + '</p>');
        }
      });
      if (!seg.title && !paras.length && !bullets.length) return '';
      let html = '<div class="read-block">';
      if (seg.title) {
        html += '<div class="read-sec-head">' +
          '<span class="read-sec-ico" style="background:' + th.bg + ';color:' + th.fg + '"><span data-icon="' + th.icon + '"></span></span>' +
          '<span class="read-sec-title">' + esc(seg.title) + '</span></div>';
      }
      html += paras.join('') +
        (bullets.length ? '<ul class="read-sec-list">' + bullets.map(function (b) { return '<li>' + b + '</li>'; }).join('') + '</ul>' : '') +
        '</div>';
      return html;
    }).join('');
  }

  function aiShell(cache, err, isTat) {
    const safe = function (t) { return t == null ? '' : String(t); };
    const title = isTat ? 'AI 故事回看' : 'AI 深度解读';
    const icoBg = isTat ? '#E3E7EC' : '#EDE4D2';
    const icoFg = isTat ? '#54697C' : '#8A6B33';
    if (cache && safe(cache.text)) {
      return '<div class="ai-result">' +
        '<div class="read-sec-head">' +
        '<span class="read-sec-ico" style="background:' + icoBg + ';color:' + icoFg + '"><span data-icon="sparkles"></span></span>' +
        '<span class="read-sec-title">' + title + '</span>' +
        '<span class="dim-tag" style="margin-left:auto;background:#E4EBE2;color:#4E6B57">本次次数已使用</span></div>' +
        aiFormatHtml(safe(cache.text)) +
        '<div class="ai-actions" style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">' +
        '  <button type="button" class="btn btn-ghost btn-sm" data-act="ai-settings"><span data-icon="key-round"></span>AI 设置</button></div>' +
        '<div class="ai-note" style="margin-top:12px;font-size:12px;color:var(--text-sub)">每个完成的测评可免费生成 1 次' + (isTat ? ' AI 故事回看' : ' AI 深度解读') + '，本次已使用完毕（不提供重新生成）。完成一次新的测评可再次获得 1 次。内容仅供自我探索参考，不构成诊断或专业意见。</div>' +
        '</div>';
    }
    return '<div class="read-block ai-block" style="border:1px dashed #E0D8C8;background:#FDFBF6">' +
      '<div class="read-sec-head"><span class="read-sec-ico" style="background:' + icoBg + ';color:' + icoFg + '"><span data-icon="sparkles"></span></span>' +
      '<span class="read-sec-title">' + (isTat ? '想让 AI 陪你回看这些故事？' : '想要更深入的专属解读？') + '</span></div>' +
      (isTat
        ? '<p class="sr-para">静态报告把故事原样还给了你。开启 AI 后，一位<b>温柔、细腻、有同理心的分析师</b>会静静读完全部故事，陪你一起回看：哪些线索反复出现、故事里的人和你有什么相似、情绪与需要藏在情节的哪里。它不评判，只是帮你<b>看见自己</b>。</p>'
        : '<p class="sr-para">静态报告给的是通用型解读。开启 AI 后，系统会把本次<b>全部题目的原文作答</b>（每题题干 + 你的选择）发送给<b>本站配置的 AI 服务</b>（默认由平台代理调用 DeepSeek，用户无需 Key），生成针对这份作答的专属深度解读。</p>') +
      (err ? '<div class="field-err" style="display:block;margin-bottom:10px">' + esc(err) + '</div>' : '') +
      '<div class="ai-actions" style="display:flex;gap:10px;flex-wrap:wrap">' +
      '  <button type="button" class="btn btn-primary" data-act="ai-run"><span data-icon="sparkles"></span>' + (isTat ? '用 AI 温柔回看我的故事' : '用 AI 生成专属深度解读') + '</button>' +
      '  <button type="button" class="btn btn-ghost" data-act="ai-settings"><span data-icon="key-round"></span>AI 设置（高级）</button></div>' +
      '<div class="ai-note" style="margin-top:12px;font-size:12.5px;color:var(--text-sub)">默认走「本站 AI 代理」（平台侧提供 DeepSeek-V4-Flash，用户无需填写 Key、不承担模型费用）。每个测评结果可免费生成 <b>1 次</b> AI 解读：生成成功即使用完毕；若失败可重试，重试不扣次数。如需自备 Key 直连官方/中转接口，可在「AI 设置」中填写接口地址与 API Key。</div>' +
      '</div>';
  }
  function mountMBTIAI(root, ctx) {
    const AI = global.Innerway && global.Innerway.ai;
    if (!AI || !root) return;
    const local = AI.readCache(ctx.resultId);
    const cloudText = ctx.record && ctx.record.ai && ctx.record.ai.text;
    const text = cloudText || (local && local.text) || '';
    const isTat = !!(ctx.cat && ctx.cat.id === 'tat');
    root.innerHTML = aiShell(text ? { text: text } : null, ctx.lastErr || '', isTat);
    icons.mount(root);
    root.onclick = function (e) {
      const hit = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
      if (!hit) return;
      const act = hit.getAttribute('data-act');
      if (act === 'ai-run') runMBTIAI(root, ctx);
      else if (act === 'ai-settings') openAISettingsModal(null);
    };
  }
  // 在结果页末尾追加 AI 区并挂载（各量表渲染完成后调用）
  function attachAI(rep, cat) {
    const AI = global.Innerway && global.Innerway.ai;
    const stage = $('#stage');
    if (!AI || !stage || document.getElementById('aiZone')) return;
    const rec = aiCtxRecord;
    if (!rec || !rec.answers) return;
    const wrap = document.createElement('div');
    wrap.id = 'aiZone';
    const actions = stage.querySelector('.result-actions');
    if (actions && actions.parentNode) {
      // AI 解读紧跟“非 AI 解读”正文之后；免责/来源提示放在 AI 之后、返回主页按钮之前（按钮仍在页底）
      wrap.style.cssText = 'margin:10px 0 30px';
      actions.parentNode.insertBefore(wrap, actions);
      const dc = stage.querySelector('.result-disclaimer');
      if (dc && dc.parentNode && dc !== actions) actions.parentNode.insertBefore(dc, actions);
    } else {
      wrap.className = 'wrap';
      wrap.style.maxWidth = '920px';
      stage.appendChild(wrap);
    }
    mountMBTIAI(wrap, { rep: rep || rec.report || {}, answers: rec.answers, resultId: rec.id, cat: cat, record: rec });
  }
  // 按实际作答题数反查对应版本的题库（多版本门类自动匹配）
  function bankForRecord(rec, cat) {
    const g = global.Innerway || {};
    const cid = (cat && cat.id) || (rec && rec.categoryId);
    const vins = cid && g[cid] && g[cid].variants;
    const n = Object.keys(((rec && rec.answers) || {})).length;
    if (vins) {
      const keys = Object.keys(vins);
      for (let k = 0; k < keys.length; k++) {
        const b = vins[keys[k]] && vins[keys[k]].bank;
        if (b && b.length === n) return b;
      }
      if (keys.length) return (vins[keys[0]] && vins[keys[0]].bank) || [];
    }
    try { return (g.data && cid) ? (g.data.getBank(cid) || []) : []; } catch (e3) { return []; }
  }
  function runMBTIAI(root, ctx) {
    const AI = global.Innerway && global.Innerway.ai;
    if (!AI) return;
    // 计次规则：每个测评结果限 1 次；本机缓存或云端记录(record.ai)已有正文即视为已使用
    const used = (function () {
      const c = AI.readCache(ctx.resultId);
      const cloud = ctx.record && ctx.record.ai && ctx.record.ai.text;
      return !!((c && c.text) || cloud);
    })();
    if (used) {
      toast('本次测评的 AI 深度解读次数已使用，完成一次新的测评可再次获得 1 次');
      mountMBTIAI(root, ctx);
      return;
    }
    if (ctx.aiRunning) { toast('AI 正在生成中，请稍候…'); return; }
    ctx.aiRunning = true;
    const cfg = AI.getSettings();
    // 代理模式（接口地址留空）无需 Key；仅"直连模式但未填 Key"才引导设置
    if (cfg.baseUrl && !cfg.apiKey) { ctx.aiRunning = false; openAISettingsModal(function () { runMBTIAI(root, ctx); }); return; }
    root.innerHTML = '<div class="read-block ai-block" style="border:1px solid #E3DCCB;background:#FDFBF6">' +
      '<div class="read-sec-head"><span class="read-sec-ico" style="background:#EDE4D2;color:#8A6B33"><span data-icon="sparkles"></span></span>' +
      '<span class="read-sec-title">AI 深度解读</span></div>' +
      '<div style="display:flex;gap:10px;align-items:center;color:var(--text-sub);font-size:14px">' +
      '<span class="spinner"></span>' + ((ctx.cat && ctx.cat.id === 'tat')
        ? '正在静静读你写下的故事，并生成专属回看（视接口约 10–40 秒）…'
        : '正在逐题分析你的作答并生成专属解读（视接口与题量约 10–40 秒）…') + '</div></div>';
    icons.mount(root);
    const bank = bankForRecord(ctx.record || {}, ctx.cat);
    const isTat = !!(ctx.cat && ctx.cat.id === 'tat');
    let payload;
    try {
      payload = isTat
        ? AI.buildTatPayload({ cat: ctx.cat, rec: ctx.record || {}, answers: ctx.answers || {}, rep: ctx.rep || {}, bank: bank })
        : AI.buildQuizPayload({ cat: ctx.cat, rec: ctx.record || {}, answers: ctx.answers || {}, rep: ctx.rep || {}, bank: bank });
    } catch (e2) {
      payload = isTat
        ? { quizName: (ctx.cat && ctx.cat.name) || '意象叙事', categoryId: 'tat', stories: [] }
        : {
            quizName: (ctx.cat && ctx.cat.name) || '心理测评',
            categoryId: (ctx.cat && ctx.cat.id) || '',
            answers: [],
            digest: ['（作答整理失败，已降级为简要摘要）']
          };
    }
    const run = isTat ? function (p) { return AI.chat(AI.tatMessages(p)); } : function (p) { return AI.chat(AI.quizMessages(p)); };
    run(payload).then(function (res) {
      ctx.aiRunning = false;
      if (res.ok) {
        AI.writeCache(ctx.resultId, res.text);
        // 并入结果记录：与报告一同持久化到（模拟）云端，回看旧报告自动带出
        const api = global.Innerway && global.Innerway.api;
        if (api && api.saveResultAI && ctx.record && ctx.record.deviceId) {
          api.saveResultAI({ resultId: ctx.resultId, deviceId: ctx.record.deviceId, aiText: res.text, model: cfg.model })
            .then(function (sr) { if (sr && sr.ok) toast('AI 解读已随报告存入云端，回看自动带出'); });
        }
        mountMBTIAI(root, ctx);
      }
      else { ctx.lastErr = res.message || '生成失败，请重试'; mountMBTIAI(root, ctx); }
    });
  }
  function openAISettingsModal(onSaved) {
    const AI = global.Innerway && global.Innerway.ai;
    if (!AI) return;
    closeAllModals();
    const cur = AI.getSettings();
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true">' +
      '  <div class="modal-head"><div><div class="modal-title">AI 设置</div>' +
      '    <div class="modal-sub">默认「本站代理」：服务端已配置模型服务（DeepSeek-V4-Flash），无需填写任何 Key。如需自备 Key 直连，请填写接口地址（如 https://api.deepseek.com）与 API Key。</div></div>' +
      '    <button type="button" class="modal-x" data-close aria-label="关闭"><span data-icon="x"></span></button></div>' +
      '  <div class="modal-body">' +
      '    <label class="label" for="aiBase">接口地址（留空 = 本站代理）</label>' +
      '    <input class="input" id="aiBase" value="' + esc(cur.baseUrl) + '" placeholder="留空 = 本站 AI 代理；直连填 https://api.deepseek.com" autocomplete="off">' +
      '    <label class="label" for="aiModel">模型名称</label>' +
      '    <input class="input" id="aiModel" value="' + esc(cur.model) + '" placeholder="deepseek-v4-flash" autocomplete="off">' +
      '    <label class="label" for="aiKey">API Key（直连模式必填）</label>' +
      '    <input class="input" id="aiKey" type="password" value="' + esc(cur.apiKey) + '" placeholder="直连模式必填；代理模式可留空" autocomplete="off">' +
      '    <div class="field-err" id="aiErr"></div>' +
      '    <div class="modal-actions">' +
      '      <button type="button" class="btn btn-primary btn-block" id="aiSave"><span data-icon="check-circle"></span>保存设置</button>' +
      '    </div>' +
      '    <div class="bound-hint" id="aiHint" hidden=""><span data-icon="info-circle"></span><span>也可点击生成按钮时若未配置会自动弹出本窗口。</span></div>' +
      '  </div></div>';
    icons.mount(mask);
    $('#modal-root').appendChild(mask);
    const err = $('#aiErr', mask);
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
    mask.addEventListener('click', function (e) { if (e.target === mask) mask.remove(); });
    $('#aiSave', mask).addEventListener('click', function () {
      try {
        AI.saveSettings({ baseUrl: $('#aiBase', mask).value, model: $('#aiModel', mask).value, apiKey: $('#aiKey', mask).value });
      } catch (ex) { err.textContent = (ex && ex.message) || '保存失败，请检查填写内容'; return; }
      mask.remove();
      toast('AI 设置已保存');
      if (onSaved) onSaved();
    });
    setTimeout(function () { $('#aiKey', mask).focus(); }, 60);
  }

  /* ================= 结果视图 ================= */
  async function renderResult(resultId) {
    setShell('result');
    aiCtxRecord = null;
    try {
      const res = await A.getResult(resultId, state.deviceId);
      if (!res.ok) throw new Error(res.message);
      const r = res.data;
      aiCtxRecord = r;
      const cat = D.getCategory(r.categoryId);
      const rep = r.report;
      if (!rep) throw new Error('报告数据缺失或已损坏');
      const tint = cat ? cat.tint : '#9A7B60';
      if (rep && rep.chart === 'sri') { renderSri(rep, cat); attachAI(rep, cat); return; }
      if (rep && (rep.chart === 'doc' || rep.chart === 'cbs')) { renderCtrlResult(rep, cat); attachAI(rep, cat); return; }
      if (rep && rep.chart === 'dt') { renderDarkResult(rep, cat); attachAI(rep, cat); return; }
      if (rep && rep.chart === 'big5') { renderBigFive(rep, cat); attachAI(rep, cat); return; }
      if (rep && rep.chart === 'mh') { renderMHealth(rep, cat); attachAI(rep, cat); return; }
      if (rep && rep.chart === 'spatial') { renderSpatial(rep, cat); attachAI(rep, cat); return; }
      if (rep && rep.chart === 'tat') { renderTat(rep, cat); attachAI(rep, cat); return; }
      const PALETTE = ['#9A7B60', '#77836B', '#B08D57', '#7D8A97', '#A98B6A', '#6E7B62'];

      // 图表
      let chartHtml = '';
      let dimsStripHtml = '';
      let profileHtml = '';
      let clarityHtml = '';
      let disclaimerHtml = '';
      if (rep && rep.chart === 'mbtiPolar' && rep.dims) {
        const dims = rep.dims;
        // 四维偏好徽章条
        dimsStripHtml = '<div class="dims-strip">' + dims.map(function (d) {
          const tiedTag = d.tied ? '<span class="dim-tag dim-tie">模糊</span>' : '';
          return '<span class="dim-chip">' +
            '<span class="dim-letters"><em>' + d.fav.k + '</em><i>' + d.unfav.k + '</i></span>' +
            '<span class="dim-body"><span class="dim-name">' + esc(d.name) + '</span>' +
            '<span class="dim-val">' + (d.tied ? '左右趋近平衡' : d.band.text + d.fav.name) + '</span></span>' +
            '<span class="dim-tag">' + esc(d.band ? d.band.label : '') + '</span>' + tiedTag +
            '</span>';
        }).join('') + '</div>';
        // 核心特质解读（长文）
        profileHtml = '<div class="read-block result-profile"><div class="read-sec-head">' +
          '<span class="read-sec-ico" style="background:#EFE5D8;color:#9A7B60"><span data-icon="book-open"></span></span>' +
          '<span class="read-sec-title">核心特质解读</span></div>' +
          (rep.profile || []).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') +
          '</div>';
        // 类型强度与维度解读：区分轻微/明显，并给出相邻类型（旧报告无该字段时自动隐藏）
        if (rep.clarity && rep.clarity.text && rep.clarity.text.length) {
          clarityHtml = '<div class="read-block result-clarity"><div class="read-sec-head">' +
            '<span class="read-sec-ico" style="background:#E4E7D9;color:#77836B"><span data-icon="activity"></span></span>' +
            '<span class="read-sec-title">类型强度与维度解读</span>' +
            (rep.clarity.label ? '<span class="dim-tag" style="margin-left:auto">' + esc(rep.clarity.label) + '</span>' : '') +
            '</div>' +
            rep.clarity.text.map(function (p) { return '<p class="sr-para">' + esc(p) + '</p>'; }).join('') +
            (rep.dimTexts && rep.dimTexts.length
              ? '<div class="clarity-sub" style="font-weight:700;color:#4C463C;font-size:13.5px;margin:6px 0 2px 44px">四维强度逐项</div>' +
                '<ul class="read-sec-list">' + rep.dimTexts.map(function (t2) { return '<li>' + esc(t2) + '</li>'; }).join('') + '</ul>'
              : '') +
            '</div>';
        }
        disclaimerHtml = rep.disclaimer ? '<div class="result-disclaimer"><span data-icon="info-circle"></span>' + esc(rep.disclaimer) + '</div>' : '';
        chartHtml =
          '<div class="chart-card"><div class="chart-title">四维偏好雷达</div>' +
          '<div class="chart-sub">从中心向外为偏好强度：轻微 → 中等 → 明显</div>' +
          '<div class="radar-wrap" id="chartPolarRadar"></div></div>' +
          '<div class="chart-card"><div class="chart-title">偏好强度尺</div>' +
          '<div class="chart-sub">每维得分区间 −24 ~ +24 · 越靠所选字母一端强度越高</div>' +
          '<div id="chartMeters"></div></div>';
      } else if (rep && rep.chart === 'radar' && rep.axes) {
        const names = rep.axes.map(function (a) { return a.name.split(' ')[0]; });
        chartHtml =
          '<div class="chart-card"><div class="chart-title">六型兴趣雷达</div>' +
          '<div class="chart-sub">各维度倾向强度（%）</div><div class="radar-wrap" id="chartRadar"></div>' +
          '<div class="legend">' + names.map(function (n, i) { return '<span><i style="background:' + PALETTE[i % 6] + '"></i>' + n + '</span>'; }).join('') + '</div></div>' +
          '<div class="chart-card"><div class="chart-title">倾向强度对比</div><div class="chart-sub">RIASEC 六型分布</div><div id="chartBars"></div></div>';
      } else if (rep && rep.chart === 'splitBars' && rep.axes) {
        chartHtml =
          '<div class="chart-card"><div class="chart-title">四维偏好分布</div><div class="chart-sub">左右偏好占比较（%）</div><div id="chartSplit"></div></div>' +
          '<div class="chart-card"><div class="chart-title">倾向小结</div><div class="chart-sub">' + esc(cat ? cat.name : '') + '</div><div style="font-size:14.5px;color:#4C463C;line-height:1.95">' +
          esc(rep.tagline || '') + '</div></div>';
      }

      // 解读区块
      const secHtml = (rep.sections || []).map(function (s) {
        return '<div class="read-sec">' +
          '<div class="read-sec-head"><span class="read-sec-ico" style="background:' + (s.soft || '#F0E4D3') + ';color:' + (s.tint || '#9A7B60') + '"><span data-icon="' + s.icon + '"></span></span>' +
          '<span class="read-sec-title">' + esc(s.title) + '</span></div>' +
          '<ul class="read-sec-list">' + (s.items || []).map(function (it) { return '<li>' + esc(it) + '</li>'; }).join('') + '</ul>' +
          '</div>';
      }).join('');

      // 通用报告若带 disclaimer（如霍兰德 O*NET 署名），与专属渲染器一致地展示
      if (!disclaimerHtml && rep && rep.disclaimer) {
        disclaimerHtml = '<div class="result-disclaimer"><span data-icon="info-circle"></span>' + esc(rep.disclaimer) + '</div>';
      }

      render('#stage',
        '<div class="wrap" style="max-width:920px">' +
        '  <div class="result-hero">' +
        '    <div class="result-badge"><span data-icon="check-circle"></span>测评完成 · 报告已自动保存</div>' +
        '    <div class="result-type-wrap">' +
        '      <div class="result-type">' + esc(rep.typeCode || '--') + '</div>' +
        '      <div class="result-type-name">' + esc(rep.typeName || '') + '</div>' +
        (rep && rep.typeEn ? '      <div class="result-en">' + esc(rep.typeEn) + '</div>' : '') +
        '      <div class="result-type-sub">' + esc(rep.tagline || '') + '</div>' +
        '    </div>' +
        dimsStripHtml +
        '  </div>' +
        '  <div class="chart-cards">' + chartHtml + '</div>' +
        profileHtml +
        clarityHtml +
        '  <div class="read-block">' + secHtml + '</div>' +
        '  <div class="result-actions">' +
        '    <a class="btn btn-primary" href="#cats"><span data-icon="arrow-left"></span>返回主页 · 选择测评</a>' +
        '    <a class="btn btn-ghost" href="#cats"><span data-icon="compass"></span>选择其他测评</a>' +
        '  </div>' +
        (disclaimerHtml || '<div class="result-note"><span class="tag tag-ghost"><span data-icon="info-circle"></span>演示报告由示例算法生成，仅供参考</span></div>') +
        '</div>');
      setShell('result');

      // 挂图表（动画）
      if (rep && rep.chart === 'mbtiPolar' && rep.dims) {
        charts.polarRadar($('#chartPolarRadar'), { dims: rep.dims });
        charts.meters($('#chartMeters'), { dims: rep.dims });
      } else if (rep && rep.chart === 'radar') {
        const axesR = rep.axes.map(function (a, i) {
          return { short: a.key, value: a.value, color: PALETTE[i % 6] };
        });
        const axesB = rep.axes.map(function (a) {
          return { label: a.name.split(' ')[0], value: a.value };
        });
        charts.radar($('#chartRadar'), { axes: axesR, title: (cat ? cat.name : '') + ' 六型分布', colors: PALETTE });
        charts.bars($('#chartBars'), { axes: axesB, color: tint });
      } else if (rep && rep.chart === 'splitBars') {
        charts.splitBars($('#chartSplit'), { axes: rep.axes });
      }
      icons.mount($('#stage'));
      attachAI(rep, cat);
      window.scrollTo({ top: 0 });
    } catch (e) {
      render('#stage',
        '<div class="page-loading"><div class="empty">' +
        '<span data-icon="x-circle"></span><span>无法打开该报告：' + esc((e && e.message) || '不存在或设备不匹配') + '</span>' +
        '<a class="btn btn-ghost btn-sm" href="#/" style="margin-top:12px">返回主页</a></div></div>');
      setShell('result');
      icons.mount($('#stage'));
    }
  }

  /* ================= 演示控制台 ================= */
  function openDemoConsole() {
    const root = $('#demo-panel-root');
    if (root.firstChild) { root.innerHTML = ''; return; }
    const fpHash = fp.getFingerprintHash();
    const panel = document.createElement('div');
    panel.className = 'demo-panel';
    panel.innerHTML =
      '<h4>演示控制台<button type="button" class="modal-x" data-close aria-label="关闭"><span data-icon="x"></span></button></h4>' +
      '<p>当前设备：<code style="font-family:var(--font-mono);font-size:12px">' + esc(state.deviceId) + '</code><br>' +
      '指纹摘要：<code style="font-family:var(--font-mono);font-size:12px">' + esc((fpHash || '').slice(0, 14)) + '…</code></p>' +
      '<div class="demo-actions">' +
      '  <button type="button" class="demo-btn" data-act="newdevice"><span data-icon="device-rotate"></span>模拟换机（清除本机绑定，刷新生效）</button>' +
      '  <button type="button" class="demo-btn" data-act="reset"><span data-icon="refresh-cw"></span>重置演示数据（清空服务端模拟库）</button>' +
      '  <button type="button" class="demo-btn" data-act="wipeall"><span data-icon="x-circle"></span>重置全部（含设备指纹）</button>' +
      '</div>';
    root.appendChild(panel);
    icons.mount(panel);
    panel.querySelector('[data-close]').addEventListener('click', function () { panel.remove(); });
    panel.querySelector('[data-act="newdevice"]').addEventListener('click', function () {
      fp.simulateNewDevice();
      location.hash = '#/';
      toast('已模拟新设备，正在刷新…');
      setTimeout(function () { location.reload(); }, 600);
    });
    panel.querySelector('[data-act="reset"]').addEventListener('click', function () {
      S.wipe();
      S.ensureSeeded();
      try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('iw.cache.') === 0) localStorage.removeItem(k); }); } catch (e) { /* ignore */ }
      toast('已重置演示数据');
      setTimeout(function () { location.reload(); }, 700);
    });
    panel.querySelector('[data-act="wipeall"]').addEventListener('click', function () {
      S.wipe();
      fp.simulateNewDevice();
      try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('iw.') === 0) localStorage.removeItem(k); }); } catch (e) { /* ignore */ }
      toast('已重置全部演示数据');
      setTimeout(function () { location.reload(); }, 700);
    });
  }

  /* ================= 隐私与免责（弹窗） ================= */
  function openPrivacyModal() {
    closeAllModals();
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="privacyTitle">' +
      '  <div class="modal-head">' +
      '    <div><div class="modal-title" id="privacyTitle">隐私与免责</div>' +
      '      <div class="modal-sub">向内而行 Innerway · 在线演示版（2026-09 更新）</div>' +
      '    </div>' +
      '    <button type="button" class="modal-x" data-close aria-label="关闭"><span data-icon="x"></span></button>' +
      '  </div>' +
      '  <div class="modal-body" style="max-height:62vh;overflow-y:auto">' +
      '    <div class="bound-hint" style="margin-bottom:14px"><span data-icon="shield-check"></span>' +
      '      <span>本站在线演示版<b>不收集任何身份信息</b>；你的作答、进度与报告仅保存在自己的浏览器中。</span></div>' +
      '    <p class="privacy-sec-title"><span data-icon="layers"></span>一、数据与隐私</p>' +
      '    <ul class="privacy-list">' +
      '      <li>作答、进度与报告仅存于本机浏览器（localStorage）；清除浏览器数据即可完全抹除。</li>' +
      '      <li>设备标识仅用于演示「一码一设备」绑定逻辑，同样只存本机，不会上传到任何服务器。</li>' +
      '      <li>本平台不要求、也不收集手机号、邮箱等任何可识别身份的信息。</li>' +
      '      <li>「AI 深度解读」为可选功能：默认由<b>本站代理</b>调用模型（Key 由平台保管、不出现在前端）；若在 AI 设置选择「直连」，Key 仅保存在本机、作答将直发你填写的接口。开启后，本次作答的<b>全部题目原文与结果摘要</b>会发送给模型服务商，请知悉后再使用。</li>' +
      '    </ul>' +
      '    <p class="privacy-sec-title"><span data-icon="book-open"></span>二、量表来源与版权口径</p>' +
      '    <ul class="privacy-list">' +
      '      <li>各门类的量表出处、授权口径与非诊断声明，均已在门类卡片、作答提示与报告页脚逐条标注。</li>' +
      '      <li>MBTI 为沿用四字母命名的<b>自研题本（非 MBTI® 官方测评）</b>；霍兰德为美国劳工部 O*NET® Interest Profiler 授权中文编译；IPIP-NEO-120 与 PHQ-9/GAD-7 为公共领域中文版；SD3 / SRI / 控制欲改编版口径见各报告页脚。</li>' +
      '    </ul>' +
      '    <p class="privacy-sec-title"><span data-icon="info-circle"></span>三、免责声明</p>' +
      '    <ul class="privacy-list">' +
      '      <li>本平台所有测评与解读仅供自我探索参考，<b>不构成医疗、心理或任何形式的诊断与建议</b>。</li>' +
      '      <li>涉及 18+ 的门类仅面向成年人；如确有心理困扰，请及时寻求专业帮助，或拨打全国统一心理援助热线 <a class="link-like" href="tel:12356">12356</a>。</li>' +
      '    </ul>' +
      '    <p class="privacy-sec-title"><span data-icon="refresh-cw"></span>四、重置与联系</p>' +
      '    <ul class="privacy-list">' +
      '      <li>演示版不设账号与人工客服：页脚「演示控制台 → 重置全部」可将本机数据恢复为初始状态；正式运营后，此处将替换为联系方式与用户协议入口。</li>' +
      '    </ul>' +
      '  </div>' +
      '</div>';
    icons.mount(mask);
    $('#modal-root').appendChild(mask);
    mask.querySelector('[data-close]').addEventListener('click', function () { mask.remove(); });
    mask.addEventListener('click', function (e) { if (e.target === mask) mask.remove(); });
  }

  /* ================= 测试档案页 ================= */
  function profileBodyHtml(mode, extra) {
    if (mode === 'locked') {
      return '<div class="arch-locked">' +
        '<span class="arch-lock-ico"><span data-icon="lock"></span></span>' +
        '<div><div class="arch-lock-title">完整人格档案尚未解锁</div>' +
        '<p class="arch-lock-text">还差：' + esc(extra.missing.join('、')) + '。完成全部 ' + extra.total + ' 项测评后，即可让 AI 综合你所有结果，生成一份跨测评的完整人格档案。</p></div>' +
        '</div>';
    }
    if (mode === 'cached') {
      return aiFormatHtml(extra.text) +
        '<div class="ai-actions" style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">' +
        '  <button type="button" class="btn btn-ghost btn-sm" data-act="pf-run"><span data-icon="refresh-cw"></span>重新生成</button>' +
        '  <button type="button" class="btn btn-ghost btn-sm" data-act="ai-settings"><span data-icon="key-round"></span>AI 设置</button></div>';
    }
    return '<p class="arch-ai-intro">将你已完成的全部测评（性格、兴趣、动机与防御、人格暗面、大五、心理健康自评）交由 AI 综合，输出一份约 800–1000 字的「完整人格档案」：稳定内核、情境性表现、测评间的印证与张力、可执行的成长方向。生成内容保存在本机，可随时重新生成。</p>' +
      '<div class="ai-actions" style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap">' +
      '  <button type="button" class="btn btn-primary" data-act="pf-run"><span data-icon="sparkles"></span>用 AI 生成完整人格档案</button>' +
      '  <button type="button" class="btn btn-ghost" data-act="ai-settings"><span data-icon="key-round"></span>AI 设置（高级）</button></div>';
  }

  function mountArchiveAi(ctx) {
    const box = $('#archAiBody');
    if (!box) return;
    const AI = global.Innerway && global.Innerway.ai;
    const cached = AI && AI.readCache('profile');
    const text = cached && cached.text ? String(cached.text) : '';
    box.innerHTML = profileBodyHtml(ctx.allDone ? (text ? 'cached' : 'ready') : 'locked', {
      missing: ctx.missing, total: ctx.total, text: text
    });
    const repaint = function () { mountArchiveAi(ctx); };

    const run = function () {
      if (!ctx.allDone) { toast('请先完成全部测评', 'err'); return; }
      if (!AI) return;
      const cfg = AI.getSettings();
      if (!cfg || (!cfg.apiKey && !cfg.baseUrl)) {
        openAISettingsModal(function () { setTimeout(repaint, 80); });
        return;
      }
      box.innerHTML = '<div style="padding:26px 8px;text-align:center;color:var(--text-sub)"><span class="spinner"></span><div style="margin-top:12px">AI 正在综合 ' + ctx.results.length + ' 份测评结果生成完整人格档案…</div></div>';
      let payload = null;
      try { payload = AI.buildProfilePayload(ctx.results, ctx.cats); } catch (e) { payload = { count: ctx.results.length, items: [], mentalAlert: false }; }
      AI.chat(AI.profileMessages(payload)).then(function (res) {
        if (res.ok) {
          AI.writeCache('profile', res.text);
          toast('完整人格档案已生成');
          repaint();
        } else {
          box.innerHTML = '<div class="ai-actions" style="flex-direction:column;gap:12px;padding:10px 2px">' +
            '<div style="color:var(--text-sub);font-size:13.5px;line-height:1.8">生成失败：' + esc(res.message || '请重试') + '</div>' +
            '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
            '<button type="button" class="btn btn-primary" data-act="pf-run"><span data-icon="refresh-cw"></span>重试</button>' +
            '<button type="button" class="btn btn-ghost" data-act="ai-settings"><span data-icon="key-round"></span>AI 设置</button></div></div>';
          if (icons && icons.mount) icons.mount(box);
        }
      });
    };
    box.__pfRun = run;
    if (!box.__pfBound) {
      box.__pfBound = true;
      box.addEventListener('click', function (e) {
        const b = e.target.closest('[data-act]');
        if (!b || !box.contains(b)) return;
        const act = b.getAttribute('data-act');
        if (act === 'pf-run') { if (box.__pfRun) box.__pfRun(); }
        else if (act === 'ai-settings') openAISettingsModal(null);
      });
    }
    if (icons && icons.mount) icons.mount(box);
  }

  async function renderArchive() {
    setShell('archive');
    render('#stage', '<div class="page-loading"><span class="spinner"></span><span>正在加载…</span></div>');
    const resultRes = await A.getMyResults(state.deviceId);
    const results = resultRes.data || [];
    const cats = D.CATEGORIES.slice();
    const openCats = cats.filter(function (c) { return c.open; });

    const byCat = {};
    results.forEach(function (r) {
      const cur = byCat[r.categoryId];
      if (!cur || (r.createdAt || 0) > (cur.createdAt || 0)) byCat[r.categoryId] = r;
    });
    const doneCount = openCats.filter(function (c) { return byCat[c.id]; }).length;
    const allDone = openCats.length > 0 && doneCount >= openCats.length;
    const missing = openCats.filter(function (c) { return !byCat[c.id]; }).map(function (c) { return c.name; });

    const pct = openCats.length ? Math.round(doneCount / openCats.length * 100) : 0;
    const rows = openCats.map(function (c) {
      const rec = byCat[c.id];
      let state;
      if (rec) {
        state = '<button type="button" class="arch-link" data-report="' + rec.id + '">' +
          '<span class="arch-code">' + esc(rec.typeCode || '已测') + '</span><span class="arch-open"><span data-icon="chevron-right"></span></span></button>';
      } else {
        state = '<span class="arch-tag tag-ghost">未完成</span>';
      }
      return '<div class="pf-row">' +
        '<span class="pf-ico" style="background:' + c.tint + '"><span data-icon="' + c.icon + '"></span></span>' +
        '<span class="pf-txt"><span class="pf-name">' + esc(c.name) + '</span><span class="pf-en">' + esc(c.en) + '</span></span>' +
        state +
        '</div>';
    }).join('');

    const ctx = { allDone: allDone, missing: missing, total: openCats.length,
      results: openCats.map(function (c) { return byCat[c.id]; }).filter(Boolean), cats: cats };
    render('#stage',
      '<div class="wrap arch-wrap">' +
      '  <div class="section-head"><div><span class="sec-no">MY ARCHIVE · PROFILE</span>' +
      '    <h2 class="sec-title" style="margin-top:8px">测试档案</h2></div>' +
      '    <p class="sec-sub">一份档案 = 你在全部测评中的集合呈现。每完成一项，这里都会补上一块拼图。</p></div>' +
      '  <div class="arch-overview">' +
      '    <div class="arch-count"><span class="arch-num">' + doneCount + '<em>/' + openCats.length + '</em></span>' +
      '      <span class="arch-count-label">已完成测评</span></div>' +
      '    <div class="arch-meta"><div class="arch-meta-title">' + (allDone ? '档案完整度：全部完成' : '档案完整度：继续完成剩余测评') + '</div>' +
      '      <div class="arch-track"><span class="arch-fill" style="width:' + pct + '%"></span></div>' +
      '      <div class="arch-meta-sub">' + (allDone ? '已解锁「完整人格档案」生成功能。' : '已测 ' + doneCount + ' / ' + openCats.length + '，完成后 AI 将跨测评综合画像。') + '</div></div>' +
      '  </div>' +
      '  <div class="arch-rows">' + rows + '</div>' +
      '  <div class="read-block arch-ai-block">' +
      '    <div class="read-sec-head">' +
      '      <span class="read-sec-ico" style="background:#EDE4D2;color:#8A6B33"><span data-icon="sparkles"></span></span>' +
      '      <span class="read-sec-title">完整人格档案</span>' +
      '      <span class="dim-tag" style="margin-left:auto;background:#F1E7CE;color:#8A6B33">AI · 跨测评综合</span></div>' +
      '    <div id="archAiBody"></div>' +
      '    <div style="margin-top:14px;font-size:12px;color:var(--text-sub)">本档案由外部大模型依据你的多份测评结果摘要生成并自动排版，仅供自我探索参考，不构成诊断或专业意见；Key 仅存本机浏览器。</div>' +
      '  </div>' +
      '</div>');
    mountArchiveAi(ctx);
    $$('[data-report]', $('#stage')).forEach(function (btn) {
      btn.addEventListener('click', function () { location.hash = '#/result/' + btn.getAttribute('data-report'); });
    });
  }

  /* ================= 路由 ================= */
  const HOME_ANCHORS = ['cats', 'why', 'faq'];
  function parseHash() {
    const raw = location.hash || '#/';
    const h = raw.replace(/^#/, '');
    if (h === '' || h === '/') return { name: 'home' };
    const seg = h.split('/').filter(Boolean);
    if (seg[0] === 'quiz' && seg[1]) return { name: 'quiz', catId: seg[1] };
    if (seg[0] === 'result' && seg[1]) return { name: 'result', id: seg[1] };
    if (seg[0] === 'archive') return { name: 'archive' };
    if (HOME_ANCHORS.indexOf(seg[0]) >= 0) return { name: 'home', anchor: seg[0] };
    return { name: 'home' };
  }

  let lastView = null;
  async function router() {
    const r = parseHash();
    if (r.name === 'home') {
      // 已在首页且目标锚点存在 → 平滑滚动，避免整页重渲染
      if (lastView === 'home' && r.anchor) {
        const t = document.getElementById(r.anchor);
        if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      }
      await renderHome();
      lastView = 'home';
      if (r.anchor) {
        const t = document.getElementById(r.anchor);
        if (t) { setTimeout(function () { t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60); }
      } else {
        window.scrollTo({ top: 0 });
      }
      return;
    }
    if (r.name === 'archive') {
      await renderArchive();
      lastView = 'archive';
      return;
    }
    if (r.name === 'quiz') {
      // 刷新恢复：查找该设备在此门类的进行中绑定
      try {
        const active = await A.getMyActive(state.deviceId);
        const act = active.data.find(function (i) { return i.categoryId === r.catId; });
        if (act) {
          await startQuiz(r.catId, act.code, null, act.variant || null);
          renderQuiz();
          lastView = 'quiz';
        } else if (state.quiz && state.quiz.categoryId === r.catId && state.quiz.bank && state.quiz.bank.length) {
          // 激活后服务端查询与本地会话的竞态兜底：直接渲染刚开始的测评
          renderQuiz();
          lastView = 'quiz';
        } else {
          toast('未找到可继续的测评，请重新激活');
          location.hash = '#/';
        }
      } catch (e) { console.error('router#quiz 失败', e); location.hash = '#/'; }
      return;
    }
    if (r.name === 'result') {
      await renderResult(r.id);
      lastView = 'result';
    }
  }

  /* ================= 启动 ================= */
  function boot() {
    // 兜底清理：index.html 静态快照可能残留上一会话的弹窗遮罩/面板，
    // 若不清除会在启动时覆盖当前视图、并让页面处于模糊（失焦）状态
    document.querySelectorAll('#modal-root .modal-mask, #demo-panel-root .demo-panel, #toast-root .toast')
      .forEach(function (el) { el.remove(); });
    S.ensureSeeded();
    const device = fp.ensureDeviceId();
    state.deviceId = device.deviceId;
    icons.mount(document.body); // shell 常驻图标
    $('#btnHome').addEventListener('click', function () { location.hash = '#/'; });
    const demoConsoleBtn = $('#demoConsoleBtn');
    if (demoConsoleBtn) {
      if (DEMO_MODE) demoConsoleBtn.addEventListener('click', openDemoConsole);
      else demoConsoleBtn.remove();
    }
    const privacyBtn = $('#privacyBtn');
    if (privacyBtn) privacyBtn.addEventListener('click', openPrivacyModal);
    window.addEventListener('hashchange', router);
    router();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);

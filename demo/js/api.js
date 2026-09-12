/* ============================================================
 * api.js · API 层（双模式）
 * ------------------------------------------------------------
 * 模式 A「服务端」：window.IW_CONFIG.apiBase 非空（如 '/api/v1'）
 *   → 所有读写走真实后端 HTTP；AI 由服务端计次与代理
 * 模式 B「本地」：apiBase 为空（GitHub Pages / 本地开文件预览）
 *   → 沿用浏览器本地模拟实现，AI 由前端直连/本站 /ai 代理
 * 两种模式对外签名与返回形状完全一致：{ ok, data } / { ok:false, code, message }
 * 真实接口契约见 sideproduct/docs/后端接口与安全设计.md
 * ============================================================ */
(function (global) {
  'use strict';
  const S = global.Innerway.server;
  const CFG = Object.assign({ apiBase: '' }, global.IW_CONFIG || {});
  const API_BASE = String(CFG.apiBase || '').replace(/\/+$/, '');
  function isServerMode() { return !!API_BASE; }

  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function net() { return delay(260 + Math.random() * 220); }
  function ok(data) { return { ok: true, data: data }; }
  function err(code, message) { return { ok: false, code: code, message: message }; }

  /* ---------------- HTTP 通道（服务端模式） ---------------- */
  function http(method, path, body, timeoutMs) {
    const url = API_BASE + path;
    const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs || 20000) : null;
    return fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      return r.json().catch(function () { return { ok: false, code: 'BAD_JSON', message: '服务端返回异常' }; });
    }).then(function (j) {
      if (j && j.ok) return { ok: true, data: j.data };
      return { ok: false, code: (j && j.code) || 'ERROR', message: (j && j.message) || '请求失败，请重试' };
    }).catch(function (e) {
      const msg = (e && e.name === 'AbortError') ? '请求超时，请重试' : '网络异常，请检查连接后重试';
      return { ok: false, code: 'NETWORK', message: msg };
    }).then(function (res) { if (timer) clearTimeout(timer); return res; });
  }
  const enc = encodeURIComponent;

  const httpApi = {
    validateCode: function (p) { return http('POST', '/codes/validate', { code: p.code, categoryId: p.categoryId, deviceId: p.deviceId }); },
    getMyActive: function (deviceId) { return http('GET', '/me/active?deviceId=' + enc(deviceId)); },
    getMyResults: function (deviceId) { return http('GET', '/me/results?deviceId=' + enc(deviceId)); },
    getMyCodes: function (deviceId) { return http('GET', '/me/codes?deviceId=' + enc(deviceId)); },
    saveProgress: function (p) { return http('PUT', '/progress/' + enc(p.code), { code: p.code, categoryId: p.categoryId, deviceId: p.deviceId, variant: p.variant || null, answers: p.answers || {}, current: typeof p.current === 'number' ? p.current : 0 }); },
    getProgress: function (code, deviceId) { return http('GET', '/progress/' + enc(code) + '?deviceId=' + enc(deviceId)); },
    submitResult: function (p) { return http('POST', '/results', { code: p.code, categoryId: p.categoryId, deviceId: p.deviceId, variant: p.variant || null, report: p.report, answers: p.answers || {} }); },
    getResult: function (id, deviceId) { return http('GET', '/results/' + enc(id) + '?deviceId=' + enc(deviceId)); },
    saveResultAI: function (p) { return http('POST', '/results/' + enc(p.resultId) + '/ai', { resultId: p.resultId, deviceId: p.deviceId, aiText: p.aiText, model: p.model }); },
    demoPurchase: function () { return Promise.resolve(err('DEMO_DISABLED', '本站不在页面内发码，请通过官方渠道获取体验码。')); },
    aiChat: function (p) {
      return http('POST', '/ai/chat', {
        deviceId: p.deviceId, code: p.code, resultId: p.resultId || null,
        kind: p.kind || 'single', messages: p.messages || [], model: p.model || ''
      }, 100000);
    }
  };

  /* ---------------- 本地模拟通道（本地/Pages 模式） ---------------- */
  const localApi = {
    validateCode: async function (payload) {
      await net();
      const code = S.findCode(payload.code);
      if (!code) return err('CODE_NOT_FOUND', '该专属码不存在，请核对后重新输入。');
      if (code.categoryId !== payload.categoryId) return err('CODE_CATEGORY_MISMATCH', '该专属码与所选测评门类不匹配。');
      if (code.status === 'bound') {
        if (code.deviceId !== payload.deviceId) {
          return err('CODE_BOUND_OTHER_DEVICE', '该专属码已在其他设备激活使用，无法重复激活。');
        }
        const prog = S.getProgress(code.code);
        const hasResult = !!(code.resultId && S.getResult(code.resultId));
        return ok({
          state: hasResult ? 'completed' : 'resume',
          code: code.code,
          categoryId: code.categoryId,
          progress: prog ? { current: prog.current, answers: prog.answers, variant: prog.variant || null, updatedAt: prog.updatedAt } : null,
          resultId: code.resultId || null
        });
      }
      code.status = 'bound';
      code.deviceId = payload.deviceId;
      code.activatedAt = Date.now();
      S.saveCode(code);
      return ok({ state: 'new', code: code.code, categoryId: code.categoryId, progress: null, resultId: null });
    },
    getMyActive: async function (deviceId) {
      await net();
      return ok(S.listBoundByDevice(deviceId).map(function (c) {
        const prog = S.getProgress(c.code);
        return {
          code: c.code, categoryId: c.categoryId, activatedAt: c.activatedAt,
          hasResult: !!(c.resultId && S.getResult(c.resultId)), resultId: c.resultId || null,
          current: prog ? prog.current : 0, updatedAt: prog ? prog.updatedAt : c.activatedAt
        };
      }).filter(function (i) { return !i.hasResult; }).sort(function (a, b) { return b.updatedAt - a.updatedAt; }));
    },
    getMyResults: async function (deviceId) {
      await net();
      return ok(S.listResultsByDevice(deviceId).map(function (r) {
        return {
          id: r.id, categoryId: r.categoryId, code: r.code,
          typeCode: r.report ? r.report.typeCode : null,
          typeLabel: r.report ? r.report.typeLabel : null,
          hasAi: !!(r.ai && r.ai.text), createdAt: r.createdAt
        };
      }).sort(function (a, b) { return b.createdAt - a.createdAt; }));
    },
    // 本地模式：按已绑定码聚合（无服务端计划概念，全部在架门类完成才解锁）
    getMyCodes: async function (deviceId) {
      await net();
      const cats = (global.Innerway && global.Innerway.data && global.Innerway.data.CATEGORIES) || [];
      const openCats = cats.filter(function (c) { return c.open; }).map(function (c) { return c.id; });
      const results = S.listResultsByDevice(deviceId);
      const done = {};
      results.forEach(function (r) { done[r.categoryId] = true; });
      const allDone = openCats.length > 0 && openCats.every(function (id) { return done[id]; });
      return ok(S.listBoundByDevice(deviceId).map(function (c) {
        return {
          code: c.code, items: [{ categoryId: c.categoryId }], status: c.status, batch: null,
          planTotal: openCats.length, planDone: openCats.filter(function (id) { return done[id]; }).length, allDone: allDone,
          aggregateUsed: false, aggregateRemaining: allDone ? 1 : 0, aggregateText: '', aggregateAt: null,
          results: results.filter(function (r) { return r.code === c.code; }).map(function (r) {
            return { resultId: r.id, categoryId: r.categoryId, variant: null, aiUsed: !!(r.ai && r.ai.text) };
          })
        };
      }));
    },
    saveProgress: async function (payload) {
      await delay(120);
      S.saveProgress({
        code: payload.code.toUpperCase().trim(), categoryId: payload.categoryId, deviceId: payload.deviceId,
        variant: payload.variant || null, answers: payload.answers || {},
        current: typeof payload.current === 'number' ? payload.current : 0, updatedAt: Date.now()
      });
      return ok({ saved: true });
    },
    getProgress: async function (code, deviceId) {
      await net();
      const rec = S.getProgress(code);
      if (!rec) return ok(null);
      if (rec.deviceId && rec.deviceId !== deviceId) return err('FORBIDDEN', '进度与当前设备不匹配');
      return ok({ current: rec.current, answers: rec.answers, variant: rec.variant || null, updatedAt: rec.updatedAt });
    },
    submitResult: async function (payload) {
      await net();
      const codeRec = S.findCode(payload.code);
      if (!codeRec) return err('CODE_NOT_FOUND', '专属码不存在');
      if (codeRec.deviceId !== payload.deviceId) return err('FORBIDDEN', '设备与绑定不符');
      const result = S.createResult({
        code: payload.code.toUpperCase().trim(), categoryId: payload.categoryId, deviceId: payload.deviceId,
        report: payload.report, answers: payload.answers || {}, createdAt: Date.now()
      });
      codeRec.resultId = result.id;
      S.saveCode(codeRec);
      return ok({ resultId: result.id });
    },
    getResult: async function (id, deviceId) {
      await net();
      const r = S.getResult(id);
      if (!r) return err('NOT_FOUND', '结果不存在');
      if (r.deviceId !== deviceId) return err('FORBIDDEN', '无权访问该结果');
      return ok(r);
    },
    saveResultAI: async function (payload) {
      await net();
      const r = S.getResult(payload.resultId);
      if (!r) return err('NOT_FOUND', '结果不存在');
      if (r.deviceId !== payload.deviceId) return err('FORBIDDEN', '无权修改该结果');
      const aiText = String(payload.aiText || '').trim();
      if (!aiText) return err('EMPTY_AI', 'AI 内容为空');
      const ai = { text: aiText, model: String(payload.model || '').trim(), at: Date.now() };
      const rec = S.saveResultAI(payload.resultId, ai);
      if (!rec) return err('NOT_FOUND', '结果不存在');
      return ok({ resultId: rec.id, ai: rec.ai });
    },
    demoPurchase: async function (categoryId) {
      await net();
      const rec = S.purchaseCode(categoryId);
      if (!rec) return err('CATEGORY_CLOSED', '该门类暂未开放');
      return ok({ code: rec.code, categoryId: rec.categoryId });
    },
    // 本地模式不做服务端计次；由 app.js 走浏览器直连/本站代理并本地计次
    aiChat: function () { return Promise.resolve(err('LOCAL_MODE', '本地模式不走服务端 AI，请使用前端直连。')); }
  };

  /* ---------------- 统一出口 ---------------- */
  const api = { isServerMode: isServerMode };
  Object.keys(localApi).forEach(function (k) {
    api[k] = function () {
      const args = Array.prototype.slice.call(arguments);
      const impl = isServerMode() && httpApi[k] ? httpApi[k] : localApi[k];
      return impl.apply(null, args);
    };
  });

  global.Innerway = global.Innerway || {};
  global.Innerway.api = api;
})(window);

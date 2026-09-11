/* ============================================================
 * api.js · API 桩层（REST 形状契约 + 本地模拟实现）
 * ------------------------------------------------------------
 * 本文件每个函数都标注了对应的真实 HTTP 接口。接后端时，
 * 仅需将函数体替换为 fetch 调用，保持签名与返回形状不变。
 * 真实接口契约、鉴权与防刷设计详见 docs/后端接口说明.md。
 * ============================================================ */
(function (global) {
  'use strict';
  const S = global.Innerway.server;

  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  // 模拟网络抖动
  function net() { return delay(260 + Math.random() * 220); }

  function ok(data) { return { ok: true, data: data }; }
  function err(code, message) { return { ok: false, code: code, message: message }; }

  const api = {
    /* --------------------------------------------------------
     * POST /api/v1/codes/validate
     * 请求: { code, categoryId, deviceId }
     * 校验专属码：不存在/门类不匹配/已被他设备绑定 → 明确错误；
     * 未使用 → 绑定当前设备并进入答题；已绑定本设备 → 续答或查看结果
     * -------------------------------------------------------- */
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
      // 首次使用 → 绑定设备
      code.status = 'bound';
      code.deviceId = payload.deviceId;
      code.activatedAt = Date.now();
      S.saveCode(code);
      return ok({ state: 'new', code: code.code, categoryId: code.categoryId, progress: null, resultId: null });
    },

    /* --------------------------------------------------------
     * GET  /api/v1/me/active?deviceId=
     * 当前设备已绑定、进行中（未出结果）的门类列表 —— 用于首页"继续测评"
     * -------------------------------------------------------- */
    getMyActive: async function (deviceId) {
      await net();
      const bound = S.listBoundByDevice(deviceId);
      const items = bound
        .map(function (c) {
          const prog = S.getProgress(c.code);
          return {
            code: c.code,
            categoryId: c.categoryId,
            activatedAt: c.activatedAt,
            hasResult: !!(c.resultId && S.getResult(c.resultId)),
            resultId: c.resultId || null,
            current: prog ? prog.current : 0,
            updatedAt: prog ? prog.updatedAt : c.activatedAt
          };
        })
        .filter(function (i) { return !i.hasResult; })
        .sort(function (a, b) { return b.updatedAt - a.updatedAt; });
      return ok(items);
    },

    /* --------------------------------------------------------
     * GET  /api/v1/me/results?deviceId=
     * 当前设备历史测评结果列表
     * -------------------------------------------------------- */
    getMyResults: async function (deviceId) {
      await net();
      const rs = S.listResultsByDevice(deviceId)
        .map(function (r) {
          return {
            id: r.id, categoryId: r.categoryId, code: r.code,
            typeCode: r.report ? r.report.typeCode : null,
            typeLabel: r.report ? r.report.typeLabel : null,
            createdAt: r.createdAt
          };
        })
        .sort(function (a, b) { return b.createdAt - a.createdAt; });
      return ok(rs);
    },

    /* --------------------------------------------------------
     * PUT  /api/v1/progress/:code     （模拟 localStorage 双写之一）
     * 请求: { code, deviceId, categoryId, answers, current }
     * 每答一题即调用；服务端以 code 维度落盘
     * -------------------------------------------------------- */
    saveProgress: async function (payload) {
      await delay(120); // 进度保存可稍轻量
      S.saveProgress({
        code: payload.code.toUpperCase().trim(),
        categoryId: payload.categoryId,
        deviceId: payload.deviceId,
        variant: payload.variant || null,
        answers: payload.answers || {},
        current: typeof payload.current === 'number' ? payload.current : 0,
        updatedAt: Date.now()
      });
      return ok({ saved: true });
    },

    /* --------------------------------------------------------
     * GET  /api/v1/progress/:code?deviceId=
     * 拉取服务端进度（用于换浏览器/恢复现场）
     * -------------------------------------------------------- */
    getProgress: async function (code, deviceId) {
      await net();
      const rec = S.getProgress(code);
      if (!rec) return ok(null);
      if (rec.deviceId && rec.deviceId !== deviceId) return err('FORBIDDEN', '进度与当前设备不匹配');
      return ok({ current: rec.current, answers: rec.answers, updatedAt: rec.updatedAt });
    },

    /* --------------------------------------------------------
     * POST /api/v1/results
     * 请求: { code, categoryId, deviceId, report, answers }
     * 服务端计算并持久化结果，回写专属码台账
     * -------------------------------------------------------- */
    submitResult: async function (payload) {
      await net();
      const codeRec = S.findCode(payload.code);
      if (!codeRec) return err('CODE_NOT_FOUND', '专属码不存在');
      if (codeRec.deviceId !== payload.deviceId) return err('FORBIDDEN', '设备与绑定不符');
      const result = S.createResult({
        code: payload.code.toUpperCase().trim(),
        categoryId: payload.categoryId,
        deviceId: payload.deviceId,
        report: payload.report,
        answers: payload.answers || {},
        createdAt: Date.now()
      });
      codeRec.resultId = result.id;
      S.saveCode(codeRec);
      return ok({ resultId: result.id });
    },

    /* --------------------------------------------------------
     * GET /api/v1/results/:id?deviceId=
     * 取单条结果报告
     * -------------------------------------------------------- */
    getResult: async function (id, deviceId) {
      await net();
      const r = S.getResult(id);
      if (!r) return err('NOT_FOUND', '结果不存在');
      if (r.deviceId !== deviceId) return err('FORBIDDEN', '无权访问该结果');
      return ok(r);
    },

    /* --------------------------------------------------------
     * POST /api/v1/results/:id/ai
     * 把 AI 深度解读正文并入结果记录（与报告一同持久化）
     * 请求: { resultId, deviceId, aiText, model }
     * -------------------------------------------------------- */
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

    /* --------------------------------------------------------
     * POST /api/v1/codes/demo-purchase    （仅演示入口，非正式 API）
     * 模拟"在第三方购买后获得激活码"：生成一张未使用码返回给前端展示
     * -------------------------------------------------------- */
    demoPurchase: async function (categoryId) {
      await net();
      const rec = S.purchaseCode(categoryId);
      if (!rec) return err('CATEGORY_CLOSED', '该门类暂未开放');
      return ok({ code: rec.code, categoryId: rec.categoryId });
    }
  };

  global.Innerway = global.Innerway || {};
  global.Innerway.api = api;
})(window);

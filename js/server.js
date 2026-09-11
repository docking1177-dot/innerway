/* ============================================================
 * server.js · 模拟服务端存储（浏览器端本地模拟）
 * ------------------------------------------------------------
 * 在真实架构中，以下数据全部存储于后端数据库（如 PostgreSQL /
 * MySQL），并通过 REST API 访问（见 api.js 中的接口注释与
 * docs/后端接口说明.md）。原型将数据写入 localStorage 的
 * iw.srv.* 命名空间，模拟"独立于客户端缓存"的服务端存储。
 *
 * 数据域：
 *  - iw.srv.seedVersion  种子版本（幂等重置）
 *  - iw.srv.codes        专属码台账
 *  - iw.srv.progress     答题进度（按专属码维度）
 *  - iw.srv.results      测评结果（含评估报告）
 * ============================================================ */
(function (global) {
  'use strict';

  const NS = 'iw.srv.';
  const SEED_VERSION = '1.0.0';
  const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 去除易混淆字符
  const DEMO_PREFIX = 'IW';

  /* ---------- 底层读写 ---------- */
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(NS + key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  function write(key, value) {
    try { localStorage.setItem(NS + key, JSON.stringify(value)); } catch (e) { /* 存储满等场景忽略 */ }
  }
  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function randCode(len) {
    let s = '';
    for (let i = 0; i < len; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    return s;
  }
  function makeCode(categoryCode) {
    // 真实产品中：码由第三方平台在用户购买时调后端批量生成并下发
    return DEMO_PREFIX + '-' + categoryCode + '-' + randCode(4) + randCode(4);
  }

  /* ---------- 种子 ---------- */
  function ensureSeeded() {
    const ver = read('seedVersion', '');
    if (ver === SEED_VERSION) return;
    // 演示预置：每个开放门类预生成若干"已售出未激活"的码
    const codes = [];
    ['mbti', 'holland'].forEach(function (cid) {
      for (let i = 0; i < 3; i++) {
        codes.push({
          code: makeCode(cid.toUpperCase()),
          categoryId: cid,
          status: 'unused',          // unused | bound
          deviceId: null,
          activatedAt: null,
          resultId: null,
          createdAt: Date.now()
        });
      }
    });
    write('codes', codes);
    write('progress', []);
    write('results', []);
    write('seedVersion', SEED_VERSION);
  }

  /* ---------- 专属码 ---------- */
  function findCode(code) {
    return read('codes', []).find(function (c) { return c.code === code.toUpperCase().trim(); }) || null;
  }
  function listCodes() { return read('codes', []); }
  function saveCode(codeRecord) {
    const codes = read('codes', []);
    const idx = codes.findIndex(function (c) { return c.code === codeRecord.code; });
    if (idx >= 0) codes[idx] = codeRecord; else codes.push(codeRecord);
    write('codes', codes);
  }
  // 模拟"第三方购买发码"：新增一条未使用码
  function purchaseCode(categoryId) {
    const cat = (global.Innerway && global.Innerway.data && global.Innerway.data.getCategory(categoryId)) || null;
    if (!cat || !cat.open) return null;
    const record = {
      code: makeCode(categoryId.toUpperCase()),
      categoryId: categoryId,
      status: 'unused',
      deviceId: null,
      activatedAt: null,
      resultId: null,
      createdAt: Date.now()
    };
    saveCode(record);
    return record;
  }

  /* ---------- 进度（按码维度） ---------- */
  function getProgress(code) {
    return read('progress', []).find(function (p) { return p.code === code.toUpperCase().trim(); }) || null;
  }
  function saveProgress(rec) {
    const list = read('progress', []);
    const idx = list.findIndex(function (p) { return p.code === rec.code; });
    if (idx >= 0) list[idx] = rec; else list.push(rec);
    write('progress', list);
  }

  /* ---------- 结果 ---------- */
  function createResult(rec) {
    const list = read('results', []);
    const id = uid('rs');
    rec.id = id;
    list.push(rec);
    write('results', list);
    return rec;
  }
  function getResult(id) {
    return read('results', []).find(function (r) { return r.id === id; }) || null;
  }
  // 把 AI 深度解读正文并入结果记录（随结果一起"云端"持久化，回看自动带出）
  function saveResultAI(id, ai) {
    const list = read('results', []);
    const idx = list.findIndex(function (r) { return r.id === id; });
    if (idx < 0) return null;
    list[idx].ai = ai;
    write('results', list);
    return list[idx];
  }
  function listResultsByDevice(deviceId) {
    return read('results', []).filter(function (r) { return r.deviceId === deviceId; });
  }
  function listResultsByCode(code) {
    return read('results', []).filter(function (r) { return r.code === code.toUpperCase().trim(); });
  }

  /* ---------- 查询：某设备已绑定（进行中）的门类 ---------- */
  function listBoundByDevice(deviceId) {
    return read('codes', []).filter(function (c) { return c.deviceId === deviceId && c.status === 'bound'; });
  }

  global.Innerway = global.Innerway || {};
  global.Innerway.server = {
    ensureSeeded: ensureSeeded,
    findCode: findCode,
    saveCode: saveCode,
    purchaseCode: purchaseCode,
    getProgress: getProgress,
    saveProgress: saveProgress,
    createResult: createResult,
    getResult: getResult,
    saveResultAI: saveResultAI,
    listResultsByDevice: listResultsByDevice,
    listResultsByCode: listResultsByCode,
    listBoundByDevice: listBoundByDevice,
    makeCode: makeCode,
    uid: uid,
    // 演示控制台：清空服务端模拟库
    wipe: function () {
      try {
        ['codes', 'progress', 'results', 'seedVersion'].forEach(function (k) { localStorage.removeItem(NS + k); });
      } catch (e) { /* ignore */ }
    }
  };
})(window);

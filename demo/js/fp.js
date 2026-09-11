/* ============================================================
 * fp.js · 设备指纹（浏览器端）
 * ------------------------------------------------------------
 * 说明：真实后端方案中，设备标识必须由"客户端指纹 + 服务端签发
 * 设备票据（绑定随机盐 + HMAC 签名）"共同构成，不能信任纯客户端
 * 上报的指纹字符串。本模块仅负责在原型内生成一个稳定的设备 ID，
 * 用于驱动整条绑定/校验演示链路。详见 docs/后端接口说明.md。
 * ============================================================ */
(function (global) {
  'use strict';
  const FP_STORE_KEY = 'iw.device.v1';
  const FP_CACHE_KEY = 'iw.device.fp.cache';

  // FNV-1a 32bit（非加密用途；真实服务端用 HMAC-SHA256）
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
  }

  function stableHash(str) {
    // 双轮哈希，尽量摊平输入中的模式噪声
    return fnv1a(str) + fnv1a('iw::' + str.split('').reverse().join(''));
  }

  // Canvas 指纹：绘制带噪点的渐变文本与几何图形后取像素摘要
  function canvasSig() {
    try {
      const c = document.createElement('canvas');
      c.width = 240; c.height = 60;
      const ctx = c.getContext('2d');
      if (!ctx) return 'nocanvas';
      ctx.textBaseline = 'top';
      ctx.font = '14px "Arial"';
      ctx.fillStyle = '#f2c94c';
      ctx.fillRect(0, 0, 240, 60);
      ctx.fillStyle = '#069';
      ctx.font = '16px "Georgia"';
      ctx.fillText('Innerway\u2603', 8, 8);
      ctx.fillStyle = 'rgba(102,204,0,.7)';
      ctx.font = 'italic 15px "Times New Roman"';
      ctx.fillText('\u2764\u26a0\u26a1', 8, 32);
      ctx.strokeStyle = '#000';
      ctx.beginPath();
      ctx.arc(190, 30, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(10,10,10,.35)';
      ctx.fillRect(160, 8, 2, 44);
      // 读取像素并做轻量摘要（不同 GPU/字体渲染会产生不同噪声）
      const d = ctx.getImageData(0, 0, 240, 60).data;
      let sum = 0, mix = 0;
      for (let i = 0; i < d.length; i += 1973) { // 采样
        sum = (sum + d[i]) % 100000;
        mix = (mix * 31 + d[i]) >>> 0;
      }
      return 'canvas:' + sum.toString(36) + ':' + (mix % 100000).toString(36);
    } catch (e) {
      return 'canvas:disabled';
    }
  }

  function collectSignals() {
    const nav = global.navigator || {};
    const screen = global.screen || {};
    const signals = {
      ua: nav.userAgent || '',
      lang: (nav.language || '') + '|' + (nav.languages || []).join(','),
      platform: nav.platform || '',
      cores: nav.hardwareConcurrency || '',
      memory: nav.deviceMemory || '',
      touch: ('ontouchstart' in global) || (nav.maxTouchPoints > 0) ? '1' : '0',
      scr: [screen.width, screen.height, screen.colorDepth, screen.pixelDepth, screen.availWidth, screen.availHeight].join('x'),
      tz: (function () { try { return new Date().getTimezoneOffset(); } catch (e) { return ''; } })(),
      canvas: canvasSig(),
      webgl: (function () {
        try {
          const c = document.createElement('canvas');
          const gl = c.getContext('webgl');
          if (!gl) return 'nowebgl';
          const ext = gl.getExtension('WEBGL_debug_renderer_info');
          return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'webgl';
        } catch (e) { return 'no'; }
      })(),
      audio: (function () {
        try {
          const ctx = new (global.OfflineAudioContext || global.webkitOfflineAudioContext)(1, 44100, 44100);
          const o = ctx.createOscillator();
          o.frequency.value = 196;
          o.type = 'triangle';
          o.connect(ctx.destination);
          o.start(0);
          return ctx.startRendering ? 'audio:ok' : 'audio:old';
        } catch (e) { return 'audio:no'; }
      })(),
      storage: (function () { try { return !!global.localStorage ? 'ls:1' : 'ls:0'; } catch (e) { return 'ls:0'; } })()
    };
    return signals;
  }

  function computeRawFingerprint() {
    const s = collectSignals();
    // 按固定字段顺序拼接，保证稳定性
    const parts = [
      s.ua, s.lang, s.platform, s.cores, s.memory, s.touch, s.scr,
      s.tz, s.canvas, s.webgl, s.audio, s.storage
    ];
    return { hash: stableHash(parts.join('||')), signals: s };
  }

  // 生成最终设备 ID：指纹哈希 + 随机盐，落盘后保持稳定
  // （等价于服务端票据模式中"指纹 -> 签发 deviceToken"的过程）
  function ensureDeviceId() {
    try {
      const raw = localStorage.getItem(FP_STORE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.deviceId && parsed.createdAt) return parsed;
        } catch (e) { /* 损坏则重建 */ }
      }
      const fp = computeRawFingerprint();
      const salt = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      const deviceId = 'dv_' + stableHash(fp.hash + '::' + salt).slice(0, 16);
      const record = { deviceId: deviceId, fpHash: fp.hash, createdAt: Date.now() };
      localStorage.setItem(FP_STORE_KEY, JSON.stringify(record));
      localStorage.setItem(FP_CACHE_KEY, JSON.stringify(fp.signals));
      return record;
    } catch (e) {
      return { deviceId: 'dv_' + Math.random().toString(36).slice(2, 12), fpHash: '', createdAt: Date.now() };
    }
  }

  function getFingerprintHash() {
    try {
      const raw = localStorage.getItem(FP_STORE_KEY);
      if (raw) return (JSON.parse(raw).fpHash) || '';
    } catch (e) { /* ignore */ }
    return '';
  }

  // 演示用：模拟"换了一台设备"——清空设备档案，下次访问会重新生成新 ID
  function simulateNewDevice() {
    try { localStorage.removeItem(FP_STORE_KEY); } catch (e) { /* ignore */ }
  }

  global.Innerway = global.Innerway || {};
  global.Innerway.fp = {
    ensureDeviceId: ensureDeviceId,
    getFingerprintHash: getFingerprintHash,
    simulateNewDevice: simulateNewDevice
  };
})(window);

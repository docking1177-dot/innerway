/* ============================================================
 * data-spatial.js · 空间偏好（热区点击情境）题库 v1
 * ------------------------------------------------------------
 * 题型：非选择题的「空间偏好」——展示一张场景图，用户在图上
 * 点击“最可能停留/站/看的位置”，每个位置对应 MBTI E/I 倾向。
 *
 * 结构：每题 { n, type:'hotspot', d:'EI', id, title, q,
 *          svg: 场景内部装饰（SVG 片段，坐标系 1000×640）,
 *          zones: [{ id, name, pole(E|I), pts:"x,y x,y …" }] }
 * 作答记录：q.answers[题号下标] = 所点 zone.id（字符串）。
 *
 * 计分：每个场景所选 zone 的 pole 计 1 次 → E/I 各场景内 3:3 平衡，
 *   跨场景累计后输出方向与强弱（探索性参考，非正式量表、非诊断）。
 * 热区多边形互不重叠；点选判定用 point-in-polygon，命中唯一。
 * svg 与 zone 坐标都定义在 1000×640 逻辑空间 → 响应式等比自适应。
 * ============================================================ */
(function (global) {
  'use strict';

  var FLOOR = '<rect x="12" y="12" width="976" height="616" rx="18" fill="#F7F0E0" stroke="#E6DCC6" stroke-width="2"/>';

  var BANK = [
    {
      n: 0, type: 'hotspot', d: 'EI', id: 'cafe',
      title: '咖啡馆',
      q: '走进一间熟悉的咖啡馆，如果会待上一小时，你更可能待在哪里？',
      svg: FLOOR +
        '<rect x="60" y="96" width="236" height="30" rx="8" fill="#D9CCB4"/>' +
        '<circle cx="112" cy="170" r="15" fill="#C8B795"/><circle cx="168" cy="170" r="15" fill="#C8B795"/>' +
        '<circle cx="224" cy="170" r="15" fill="#C8B795"/><circle cx="280" cy="170" r="15" fill="#C8B795"/>' +
        '<rect x="78" y="356" width="240" height="46" rx="12" fill="#CBBFA6"/>' +
        '<rect x="78" y="446" width="240" height="46" rx="12" fill="#CBBFA6"/>' +
        '<rect x="150" y="402" width="96" height="44" rx="8" fill="#E4D9C2"/>' +
        '<rect x="455" y="600" width="240" height="26" fill="#EFE9DB"/>' +
        '<rect x="483" y="478" width="184" height="20" rx="6" fill="#DED2BA"/>' +
        '<line x1="360" y1="70" x2="555" y2="70" stroke="#E4DCC8" stroke-width="3"/>' +
        '<circle cx="420" cy="180" r="20" fill="#CBBFA6"/><circle cx="468" cy="180" r="20" fill="#CBBFA6"/>' +
        '<rect x="408" y="196" width="72" height="26" rx="8" fill="#E4D9C2"/>' +
        '<rect x="640" y="150" width="120" height="46" rx="10" fill="#D9CCB4"/>' +
        '<circle cx="820" cy="170" r="18" fill="#CBBFA6"/>' +
        '<circle cx="820" cy="400" r="34" fill="#CBBFA6"/><circle cx="906" cy="470" r="16" fill="#D9CCB4"/>',
      zones: [
        { id: 'door', name: '门口入口处', pole: 'E', pts: '455,600 695,600 695,468 470,468' },
        { id: 'bar', name: '吧台旁', pole: 'E', pts: '60,60 300,60 300,246 60,246' },
        { id: 'sofa', name: '多人沙发区', pole: 'E', pts: '60,344 335,344 335,524 60,524' },
        { id: 'win', name: '靠窗单人座', pole: 'I', pts: '360,60 555,60 555,252 360,252' },
        { id: 'corner', name: '角落安静位', pole: 'I', pts: '742,288 960,288 960,600 742,600' },
        { id: 'wall', name: '靠墙小桌', pole: 'I', pts: '586,60 960,60 960,242 586,242' }
      ]
    },
    {
      n: 1, type: 'hotspot', d: 'EI', id: 'library',
      title: '图书馆',
      q: '在图书馆休息的间隙，你更可能出现在哪里？',
      svg: FLOOR +
        '<rect x="70" y="480" width="150" height="60" rx="10" fill="#D9CCB4"/>' +
        '<rect x="80" y="90" width="190" height="100" rx="12" fill="#E4D9C2"/>' +
        '<rect x="390" y="360" width="220" height="100" rx="8" fill="#E4D9C2"/>' +
        '<rect x="690" y="80" width="10" height="150" fill="#D9CCB4"/>' +
        '<rect x="726" y="80" width="10" height="150" fill="#D9CCB4"/>' +
        '<rect x="762" y="80" width="10" height="150" fill="#D9CCB4"/>' +
        '<rect x="798" y="80" width="10" height="150" fill="#D9CCB4"/>' +
        '<rect x="834" y="80" width="10" height="150" fill="#D9CCB4"/>' +
        '<rect x="870" y="80" width="10" height="150" fill="#D9CCB4"/>' +
        '<circle cx="400" cy="120" r="16" fill="#CBBFA6"/>' +
        '<rect x="790" y="500" width="110" height="44" rx="8" fill="#E4D9C2"/>',
      zones: [
        { id: 'desk', name: '检索服务台', pole: 'E', pts: '40,470 270,470 270,600 40,600' },
        { id: 'study', name: '小组研讨间', pole: 'E', pts: '40,40 310,40 310,228 40,228' },
        { id: 'printer', name: '打印·饮水区', pole: 'E', pts: '756,470 960,470 960,600 756,600' },
        { id: 'hall', name: '大厅自习位', pole: 'I', pts: '350,306 640,306 640,516 350,516' },
        { id: 'window', name: '窗边单人位', pole: 'I', pts: '352,40 628,40 628,196 352,196' },
        { id: 'shelf', name: '书架间深处', pole: 'I', pts: '672,40 960,40 960,428 672,428' }
      ]
    },
    {
      n: 2, type: 'hotspot', d: 'EI', id: 'party',
      title: '朋友聚会',
      q: '朋友家聚会进行到一半，你通常会待在哪里？',
      svg: FLOOR +
        '<rect x="300" y="210" width="400" height="220" rx="14" fill="#DED2BA"/>' +
        '<rect x="330" y="230" width="150" height="52" rx="12" fill="#B9A98C"/>' +
        '<rect x="520" y="230" width="150" height="52" rx="12" fill="#B9A98C"/>' +
        '<rect x="330" y="360" width="150" height="52" rx="12" fill="#B9A98C"/>' +
        '<rect x="520" y="360" width="150" height="52" rx="12" fill="#B9A98C"/>' +
        '<rect x="455" y="300" width="100" height="80" rx="8" fill="#E4D9C2"/>' +
        '<rect x="80" y="90" width="130" height="90" rx="10" fill="#E4D9C2"/>' +
        '<rect x="400" y="520" width="250" height="52" rx="12" fill="#D9CCB4"/>' +
        '<circle cx="840" cy="100" r="20" fill="#CBBFA6"/>' +
        '<circle cx="880" cy="400" r="26" fill="#CBBFA6"/>' +
        '<rect x="70" y="556" width="150" height="30" rx="8" fill="#E4D9C2"/>',
      zones: [
        { id: 'sofa', name: '主沙发区', pole: 'E', pts: '280,180 720,180 720,452 280,452' },
        { id: 'kitchen', name: '厨房吧台边', pole: 'E', pts: '40,40 246,40 246,246 40,246' },
        { id: 'dining', name: '餐桌边长谈', pole: 'E', pts: '366,492 686,492 686,600 366,600' },
        { id: 'balcony', name: '阳台单人椅', pole: 'I', pts: '798,40 960,40 960,244 798,244' },
        { id: 'reading', name: '窗边单人沙发', pole: 'I', pts: '790,304 960,304 960,600 790,600' },
        { id: 'entry', name: '玄关安静角落', pole: 'I', pts: '40,540 250,540 250,600 40,600' }
      ]
    },
    {
      n: 3, type: 'hotspot', d: 'EI', id: 'travel',
      title: '旅行风景',
      q: '到达一处风景开阔的景区，自由活动一小时，你会待在？',
      svg: FLOOR +
        '<ellipse cx="700" cy="520" rx="320" ry="140" fill="#CFE0DC"/>' +
        '<polygon points="0,250 150,90 320,215 500,80 700,205 880,95 1000,170 1000,330 0,330" fill="#B9C4B4"/>' +
        '<polygon points="60,64 150,64 105,20" fill="#A6B4A0"/>' +
        '<rect x="150" y="120" width="120" height="52" rx="6" fill="#CBBFA6"/>' +
        '<polygon points="140,120 280,120 210,78" fill="#A9826A"/>' +
        '<rect x="730" y="196" width="226" height="24" rx="8" fill="#D9CCB4"/>' +
        '<line x1="742" y1="190" x2="744" y2="232" stroke="#C9BDA6" stroke-width="3"/>' +
        '<line x1="944" y1="190" x2="942" y2="232" stroke="#C9BDA6" stroke-width="3"/>' +
        '<rect x="70" y="446" width="100" height="36" rx="6" fill="#D9CCB4"/>' +
        '<rect x="185" y="446" width="100" height="36" rx="6" fill="#C8B795"/>' +
        '<rect x="300" y="446" width="100" height="36" rx="6" fill="#D9CCB4"/>' +
        '<line x1="120" y1="482" x2="120" y2="540" stroke="#C8B795" stroke-width="4"/>' +
        '<line x1="235" y1="482" x2="235" y2="540" stroke="#B9A98C" stroke-width="4"/>' +
        '<line x1="350" y1="482" x2="350" y2="540" stroke="#C8B795" stroke-width="4"/>' +
        '<rect x="786" y="536" width="150" height="22" rx="6" fill="#D9CCB4"/>' +
        '<circle cx="838" cy="566" r="16" fill="#C8B795"/><circle cx="902" cy="576" r="13" fill="#C8B795"/>' +
        '<circle cx="712" cy="360" r="46" fill="#A9B88F"/>' +
        '<rect x="762" y="372" width="116" height="20" rx="8" fill="#C8B795"/>' +
        '<circle cx="508" cy="576" r="14" fill="#C9C2B4"/><circle cx="546" cy="562" r="11" fill="#D3CCBE"/>' +
        '<circle cx="586" cy="580" r="12" fill="#C9C2B4"/><circle cx="626" cy="566" r="9" fill="#D3CCBE"/>',
      zones: [
        { id: 'plaza', name: '观景台人群区', pole: 'E', pts: '720,60 960,60 960,300 720,300' },
        { id: 'market', name: '市集摊边', pole: 'E', pts: '40,420 420,420 420,600 40,600' },
        { id: 'dock', name: '游船码头', pole: 'E', pts: '740,470 960,470 960,600 740,600' },
        { id: 'pavilion', name: '山顶凉亭', pole: 'I', pts: '40,60 350,60 350,240 40,240' },
        { id: 'bench', name: '树荫长椅', pole: 'I', pts: '620,330 960,330 960,430 620,430' },
        { id: 'cove', name: '湖边安静角落', pole: 'I', pts: '440,500 700,500 700,600 440,600' }
      ]
    }
  ];

  var variants = {
    main: {
      label: '空间偏好',
      total: BANK.length,
      duration: '4 场景 · 约 1–2 分钟',
      bank: BANK
    }
  };

  /* 展示顺序由题库决定（热区互不重叠，命中唯一） */
  global.Innerway = global.Innerway || {};
  global.Innerway.spatial = {
    variants: variants,
    dims: { E: { name: '靠近人群', desc: '更常在入口、吧台、群体与热闹点位停留' }, I: { name: '偏向独处', desc: '更常选窗边、角落、安静与低打扰点位' } }
  };
})(window);

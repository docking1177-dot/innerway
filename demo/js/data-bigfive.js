/* ============================================================
 * data-bigfive.js · 大五人格测评题库（IPIP-NEO-120 · 120 题完整版）
 * ------------------------------------------------------------
 * 量表依据：Johnson, J. A. (2014). Measuring thirty facets of the
 *   Five Factor Model with a 120-item public domain inventory:
 *   Development of the IPIP-NEO-120. Journal of Research in
 *   Personality, 51, 78-89. 题项选自 IPIP（International
 *   Personality Item Pool, Goldberg 等）公共领域题池。
 * 结构：30 个 facet（N/E/O/A/C 每域 6 个）× 每 facet 4 题 = 120 题；
 *   5 点自评（1=非常不符合 → 5=非常符合）。
 * 授权口径：IPIP 题项为公共领域，可免费复制/改编/翻译并用于任何
 *   目的（含商业），无需许可与付费（ipip.ori.org）。本文本为忠实
 *   中文译制（未增删题项，保留全部 +keyed / -keyed 计分方向）。
 *   非临床诊断工具，面向 16 岁及以上成年人。
 * ============================================================ */
(function (global) {
  'use strict';

  var P5 = [
    { v: 1, label: '非常不符合' },
    { v: 2, label: '较不符合' },
    { v: 3, label: '一般 · 说不清' },
    { v: 4, label: '比较符合' },
    { v: 5, label: '非常符合' }
  ];

  var DL = '大五人格'; // 作答页中性维度标签

  /* g = facet 代码（N1..C6），r=1 表示 -keyed 反向计分 */
  var BANK = [
    { id: 'bf01',  g: 'N1', o: 3, dl: DL, q: '我常为事情担忧。', p: P5 },
    { id: 'bf02',  g: 'E1', o: 3, dl: DL, q: '我能轻松交到朋友。', p: P5 },
    { id: 'bf03',  g: 'O1', o: 3, dl: DL, q: '我有生动的想象力。', p: P5 },
    { id: 'bf04',  g: 'A1', o: 3, dl: DL, q: '我信任他人。', p: P5 },
    { id: 'bf05',  g: 'C1', o: 3, dl: DL, q: '我能顺利完成各项任务。', p: P5 },
    { id: 'bf06',  g: 'N2', o: 3, dl: DL, q: '我很容易生气。', p: P5 },
    { id: 'bf07',  g: 'E2', o: 3, dl: DL, q: '我喜欢大型聚会。', p: P5 },
    { id: 'bf08',  g: 'O2', o: 3, dl: DL, q: '我相信艺术很重要。', p: P5 },
    { id: 'bf09',  g: 'A2', o: 3, dl: DL, r: 1, q: '我会利用别人达到自己的目的。', p: P5 },
    { id: 'bf10',  g: 'C2', o: 3, dl: DL, q: '我喜欢收拾整理。', p: P5 },
    { id: 'bf11',  g: 'N3', o: 3, dl: DL, q: '我常常情绪低落。', p: P5 },
    { id: 'bf12',  g: 'E3', o: 3, dl: DL, q: '我愿意主动负责、牵头。', p: P5 },
    { id: 'bf13',  g: 'O3', o: 3, dl: DL, q: '我的情感体验很强烈。', p: P5 },
    { id: 'bf14',  g: 'A3', o: 3, dl: DL, q: '我乐于帮助别人。', p: P5 },
    { id: 'bf15',  g: 'C3', o: 3, dl: DL, q: '我信守承诺。', p: P5 },
    { id: 'bf16',  g: 'N4', o: 3, dl: DL, q: '我很难主动接近别人。', p: P5 },
    { id: 'bf17',  g: 'E4', o: 3, dl: DL, q: '我总是很忙碌。', p: P5 },
    { id: 'bf18',  g: 'O4', o: 3, dl: DL, q: '比起一成不变，我更喜欢丰富多样。', p: P5 },
    { id: 'bf19',  g: 'A4', o: 3, dl: DL, r: 1, q: '我喜欢与人争辩较量。', p: P5 },
    { id: 'bf20',  g: 'C4', o: 3, dl: DL, q: '我做事很努力。', p: P5 },
    { id: 'bf21',  g: 'N5', o: 3, dl: DL, q: '我会一时放纵、不知节制。', p: P5 },
    { id: 'bf22',  g: 'E5', o: 3, dl: DL, q: '我喜欢刺激兴奋的感觉。', p: P5 },
    { id: 'bf23',  g: 'O5', o: 3, dl: DL, q: '我喜欢阅读有挑战性的内容。', p: P5 },
    { id: 'bf24',  g: 'A5', o: 3, dl: DL, r: 1, q: '我认为自己比别人强。', p: P5 },
    { id: 'bf25',  g: 'C5', o: 3, dl: DL, q: '我总是有备而来。', p: P5 },
    { id: 'bf26',  g: 'N6', o: 3, dl: DL, q: '我容易惊慌失措。', p: P5 },
    { id: 'bf27',  g: 'E6', o: 3, dl: DL, q: '我身上散发着快乐。', p: P5 },
    { id: 'bf28',  g: 'O6', o: 3, dl: DL, q: '选举时我更倾向自由派或进步派的立场。', p: P5 },
    { id: 'bf29',  g: 'A6', o: 3, dl: DL, q: '我同情无家可归的人。', p: P5 },
    { id: 'bf30',  g: 'C6', o: 3, dl: DL, r: 1, q: '我会不假思索地一头扎进某些事。', p: P5 },
    { id: 'bf31',  g: 'N1', o: 3, dl: DL, q: '我总是担心最坏的情况发生。', p: P5 },
    { id: 'bf32',  g: 'E1', o: 3, dl: DL, q: '和别人在一起时我感到自在。', p: P5 },
    { id: 'bf33',  g: 'O1', o: 3, dl: DL, q: '我喜欢天马行空地幻想。', p: P5 },
    { id: 'bf34',  g: 'A1', o: 3, dl: DL, q: '我相信别人是出于好意。', p: P5 },
    { id: 'bf35',  g: 'C1', o: 3, dl: DL, q: '我在自己做的事情上很出色。', p: P5 },
    { id: 'bf36',  g: 'N2', o: 3, dl: DL, q: '我很容易被惹恼。', p: P5 },
    { id: 'bf37',  g: 'E2', o: 3, dl: DL, q: '聚会上我会和许多人交谈。', p: P5 },
    { id: 'bf38',  g: 'O2', o: 3, dl: DL, q: '我能看到别人注意不到的美。', p: P5 },
    { id: 'bf39',  g: 'A2', o: 3, dl: DL, r: 1, q: '为了领先我会投机取巧。', p: P5 },
    { id: 'bf40',  g: 'C2', o: 3, dl: DL, r: 1, q: '我常忘记把东西放回原位。', p: P5 },
    { id: 'bf41',  g: 'N3', o: 3, dl: DL, q: '我不喜欢自己。', p: P5 },
    { id: 'bf42',  g: 'E3', o: 3, dl: DL, q: '我试着带领别人。', p: P5 },
    { id: 'bf43',  g: 'O3', o: 3, dl: DL, q: '我能感受到别人的情绪。', p: P5 },
    { id: 'bf44',  g: 'A3', o: 3, dl: DL, q: '我关心他人。', p: P5 },
    { id: 'bf45',  g: 'C3', o: 3, dl: DL, q: '我说真话。', p: P5 },
    { id: 'bf46',  g: 'N4', o: 3, dl: DL, q: '我害怕引起别人的注意。', p: P5 },
    { id: 'bf47',  g: 'E4', o: 3, dl: DL, q: '我总是忙个不停。', p: P5 },
    { id: 'bf48',  g: 'O4', o: 3, dl: DL, r: 1, q: '我宁愿坚持自己熟悉的东西。', p: P5 },
    { id: 'bf49',  g: 'A4', o: 3, dl: DL, r: 1, q: '我会对人吼叫。', p: P5 },
    { id: 'bf50',  g: 'C4', o: 3, dl: DL, q: '我会做得比别人期望的更多。', p: P5 },
    { id: 'bf51',  g: 'N5', o: 3, dl: DL, r: 1, q: '我很少放纵自己。', p: P5 },
    { id: 'bf52',  g: 'E5', o: 3, dl: DL, q: '我喜欢寻求冒险。', p: P5 },
    { id: 'bf53',  g: 'O5', o: 3, dl: DL, r: 1, q: '我会回避哲学讨论。', p: P5 },
    { id: 'bf54',  g: 'A5', o: 3, dl: DL, r: 1, q: '我自视甚高。', p: P5 },
    { id: 'bf55',  g: 'C5', o: 3, dl: DL, q: '我会把自己的计划落到实处。', p: P5 },
    { id: 'bf56',  g: 'N6', o: 3, dl: DL, q: '事情太多时我会不知所措。', p: P5 },
    { id: 'bf57',  g: 'E6', o: 3, dl: DL, q: '我总能玩得很尽兴。', p: P5 },
    { id: 'bf58',  g: 'O6', o: 3, dl: DL, q: '我相信是非对错并非绝对。', p: P5 },
    { id: 'bf59',  g: 'A6', o: 3, dl: DL, q: '我同情境遇不如我的人。', p: P5 },
    { id: 'bf60',  g: 'C6', o: 3, dl: DL, r: 1, q: '我会草率地做决定。', p: P5 },
    { id: 'bf61',  g: 'N1', o: 3, dl: DL, q: '我害怕很多事情。', p: P5 },
    { id: 'bf62',  g: 'E1', o: 3, dl: DL, r: 1, q: '我会回避与他人的接触。', p: P5 },
    { id: 'bf63',  g: 'O1', o: 3, dl: DL, q: '我喜欢做白日梦。', p: P5 },
    { id: 'bf64',  g: 'A1', o: 3, dl: DL, q: '我相信别人说的话。', p: P5 },
    { id: 'bf65',  g: 'C1', o: 3, dl: DL, q: '我能顺利地处理任务。', p: P5 },
    { id: 'bf66',  g: 'N2', o: 3, dl: DL, q: '我会发脾气。', p: P5 },
    { id: 'bf67',  g: 'E2', o: 3, dl: DL, r: 1, q: '我更喜欢独处。', p: P5 },
    { id: 'bf68',  g: 'O2', o: 3, dl: DL, r: 1, q: '我不喜欢诗歌。', p: P5 },
    { id: 'bf69',  g: 'A2', o: 3, dl: DL, r: 1, q: '我会占别人的便宜。', p: P5 },
    { id: 'bf70',  g: 'C2', o: 3, dl: DL, r: 1, q: '我的房间会乱糟糟的。', p: P5 },
    { id: 'bf71',  g: 'N3', o: 3, dl: DL, q: '我常常闷闷不乐。', p: P5 },
    { id: 'bf72',  g: 'E3', o: 3, dl: DL, q: '我喜欢掌控局面。', p: P5 },
    { id: 'bf73',  g: 'O3', o: 3, dl: DL, r: 1, q: '我很少留意自己的情绪反应。', p: P5 },
    { id: 'bf74',  g: 'A3', o: 3, dl: DL, r: 1, q: '我对别人的感受无动于衷。', p: P5 },
    { id: 'bf75',  g: 'C3', o: 3, dl: DL, r: 1, q: '我会违反规则。', p: P5 },
    { id: 'bf76',  g: 'N4', o: 3, dl: DL, q: '只有和朋友在一起我才觉得自在。', p: P5 },
    { id: 'bf77',  g: 'E4', o: 3, dl: DL, q: '空闲时间我也会做很多事。', p: P5 },
    { id: 'bf78',  g: 'O4', o: 3, dl: DL, r: 1, q: '我不喜欢变化。', p: P5 },
    { id: 'bf79',  g: 'A4', o: 3, dl: DL, r: 1, q: '我会侮辱别人。', p: P5 },
    { id: 'bf80',  g: 'C4', o: 3, dl: DL, r: 1, q: '做事我只求差不多、能过就好。', p: P5 },
    { id: 'bf81',  g: 'N5', o: 3, dl: DL, r: 1, q: '我能轻松抵制诱惑。', p: P5 },
    { id: 'bf82',  g: 'E5', o: 3, dl: DL, q: '我喜欢不管不顾、不计后果的感觉。', p: P5 },
    { id: 'bf83',  g: 'O5', o: 3, dl: DL, r: 1, q: '我难以理解抽象的想法。', p: P5 },
    { id: 'bf84',  g: 'A5', o: 3, dl: DL, r: 1, q: '我对自己评价很高。', p: P5 },
    { id: 'bf85',  g: 'C5', o: 3, dl: DL, r: 1, q: '我会浪费时间。', p: P5 },
    { id: 'bf86',  g: 'N6', o: 3, dl: DL, q: '我觉得自己应付不了眼前的事。', p: P5 },
    { id: 'bf87',  g: 'E6', o: 3, dl: DL, q: '我热爱生活。', p: P5 },
    { id: 'bf88',  g: 'O6', o: 3, dl: DL, r: 1, q: '选举时我更倾向保守派的立场。', p: P5 },
    { id: 'bf89',  g: 'A6', o: 3, dl: DL, r: 1, q: '我对别人的问题不感兴趣。', p: P5 },
    { id: 'bf90',  g: 'C6', o: 3, dl: DL, r: 1, q: '我会急匆匆地投入做事。', p: P5 },
    { id: 'bf91',  g: 'N1', o: 3, dl: DL, q: '我很容易感到压力山大。', p: P5 },
    { id: 'bf92',  g: 'E1', o: 3, dl: DL, r: 1, q: '我会和别人保持距离。', p: P5 },
    { id: 'bf93',  g: 'O1', o: 3, dl: DL, q: '我喜欢沉浸在思考中。', p: P5 },
    { id: 'bf94',  g: 'A1', o: 3, dl: DL, r: 1, q: '我不信任别人。', p: P5 },
    { id: 'bf95',  g: 'C1', o: 3, dl: DL, q: '我知道如何把事情做成。', p: P5 },
    { id: 'bf96',  g: 'N2', o: 3, dl: DL, r: 1, q: '我不容易被惹恼。', p: P5 },
    { id: 'bf97',  g: 'E2', o: 3, dl: DL, r: 1, q: '我会避开人多的地方。', p: P5 },
    { id: 'bf98',  g: 'O2', o: 3, dl: DL, r: 1, q: '我不喜欢去美术馆。', p: P5 },
    { id: 'bf99',  g: 'A2', o: 3, dl: DL, r: 1, q: '我会阻挠别人的计划。', p: P5 },
    { id: 'bf100', g: 'C2', o: 3, dl: DL, r: 1, q: '我的随身物品会到处乱放。', p: P5 },
    { id: 'bf101', g: 'N3', o: 3, dl: DL, r: 1, q: '我对自己感到自在。', p: P5 },
    { id: 'bf102', g: 'E3', o: 3, dl: DL, r: 1, q: '我习惯等着别人带头。', p: P5 },
    { id: 'bf103', g: 'O3', o: 3, dl: DL, r: 1, q: '我不理解那些容易情绪化的人。', p: P5 },
    { id: 'bf104', g: 'A3', o: 3, dl: DL, r: 1, q: '我不愿为别人花时间。', p: P5 },
    { id: 'bf105', g: 'C3', o: 3, dl: DL, r: 1, q: '我会违背承诺。', p: P5 },
    { id: 'bf106', g: 'N4', o: 3, dl: DL, r: 1, q: '再难的社交场合也不会让我困扰。', p: P5 },
    { id: 'bf107', g: 'E4', o: 3, dl: DL, r: 1, q: '我喜欢轻松悠闲、不紧不慢。', p: P5 },
    { id: 'bf108', g: 'O4', o: 3, dl: DL, r: 1, q: '我固守传统的方式。', p: P5 },
    { id: 'bf109', g: 'A4', o: 3, dl: DL, r: 1, q: '我会报复别人。', p: P5 },
    { id: 'bf110', g: 'C4', o: 3, dl: DL, r: 1, q: '我在工作或学业上投入很少的时间精力。', p: P5 },
    { id: 'bf111', g: 'N5', o: 3, dl: DL, r: 1, q: '我能控制自己的欲望和冲动。', p: P5 },
    { id: 'bf112', g: 'E5', o: 3, dl: DL, q: '我会表现得狂野疯狂。', p: P5 },
    { id: 'bf113', g: 'O5', o: 3, dl: DL, r: 1, q: '我对理论性的讨论不感兴趣。', p: P5 },
    { id: 'bf114', g: 'A5', o: 3, dl: DL, r: 1, q: '我会夸耀自己的优点。', p: P5 },
    { id: 'bf115', g: 'C5', o: 3, dl: DL, r: 1, q: '我很难开始动手做事。', p: P5 },
    { id: 'bf116', g: 'N6', o: 3, dl: DL, r: 1, q: '压力之下我依然保持冷静。', p: P5 },
    { id: 'bf117', g: 'E6', o: 3, dl: DL, q: '我总是看到生活积极的一面。', p: P5 },
    { id: 'bf118', g: 'O6', o: 3, dl: DL, r: 1, q: '我认为应该严厉打击犯罪。', p: P5 },
    { id: 'bf119', g: 'A6', o: 3, dl: DL, r: 1, q: '我尽量不去想那些贫困的人。', p: P5 },
    { id: 'bf120', g: 'C6', o: 3, dl: DL, r: 1, q: '我会不假思索地行动。', p: P5 }
  ];

  global.Innerway = global.Innerway || {};
  global.Innerway.bigfive = {
    variants: {
      main: {
        key: 'main',
        label: '大五人格 · IPIP-NEO-120 完整版',
        en: 'Big Five · IPIP-NEO-120',
        duration: '120 题 · 约 15–20 分钟',
        total: BANK.length,
        hint: '请根据你「平时的真实状态」作答：1=非常不符合，5=非常符合。本卷为公开的 IPIP-NEO-120 完整 120 题（30 个子维度，每维 4 题），凭第一直觉作答即可，没有对错之分。',
        bank: BANK
      }
    }
  };
})(window);

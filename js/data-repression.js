/* ============================================================
 * data-repression.js · 性压抑评估（SRI）题库 v1
 * ------------------------------------------------------------
 * 依据与授权口径（重要）：
 *   题目结构参考开源实现 sexual-repression-calculator（GitHub 上存在多份
 *   MIT fork，以 README 明示 MIT 许可证的仓库为参照；使用时建议固定仓库
 *   commit 存档）。注意：MIT 许可证仅覆盖该仓库作者自行编写的代码，不能
 *   延伸覆盖其收录的各量表（SIS/SES、Mosher 性内疚、KISS-9、SOS、BSAS）
 *   的题目文本、计分结构与常模数据——后者的权利归各原作者/出版方所有。
 *   本文件为面向本项目的成人中文编译题本，未取得商业授权；上线商用前
 *   须逐量表向原作者确认许可（详见 docs/性压抑SRI接入说明.md）。
 * 结构：{ variant: "quick"|"full", bank[], scales[], norms, levels }
 *   每题 { n: 现场序号, id, g: 分组前缀(ses/sis1/sis2/mg/ks/sos/bsas),
 *          o: 0=同意度 1=频率, r: 0|1 反向, q: 题干, p:[[分值,标签]…] }
 * 说明：仓库 README 标注 39/117，但其运行时默认成人题集实为 38/126，
 *   本模块采用后者（忠实于题目与计分）。未成年/无性经验自适应分支
 *   未纳入，见 docs/性压抑SRI接入说明.md。
 * ============================================================ */
(function (global) {
  'use strict';

  var bankQuick = [
{n:0,id:"ses_1",g:"ses",o:0,r:0,q:"当我看到有吸引力的人时，我很容易产生性幻想",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:1,id:"ses_2",g:"ses",o:0,r:0,q:"性的画面或故事很容易让我兴奋",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:2,id:"ses_3",g:"ses",o:0,r:0,q:"我很容易被性唤起",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:3,id:"ses_4",g:"ses",o:0,r:0,q:"看到裸体会让我性兴奋",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:4,id:"sis1_1",g:"sis1",o:0,r:0,q:"如果我担心性表现，我就很难维持性兴奋",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:5,id:"sis1_2",g:"sis1",o:0,r:0,q:"除非我确信不会让伴侣失望，否则我很难放松享受性生活",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:6,id:"sis1_3",g:"sis1",o:0,r:0,q:"当我想到可能无法满足伴侣时，我会失去性兴趣",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:7,id:"sis1_4",g:"sis1",o:0,r:0,q:"如果我担心自己的性表现，我就很难专注于性快感",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:8,id:"sis1_5",g:"sis1",o:0,r:0,q:"性活动中的分心想法会让我失去性兴奋",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:9,id:"sis2_1",g:"sis2",o:0,r:0,q:"如果我认为有被发现的风险，我不太可能寻求性活动",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:10,id:"sis2_2",g:"sis2",o:0,r:0,q:"担心性传播疾病会降低我的性兴趣",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:11,id:"sis2_3",g:"sis2",o:0,r:0,q:"如果存在风险，我很难保持性兴奋",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:12,id:"sis2_4",g:"sis2",o:0,r:0,q:"担心怀孕会影响我的性兴趣",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:13,id:"sis2_5",g:"sis2",o:0,r:0,q:"陌生或不熟悉的环境会让我难以性兴奋",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:14,id:"mg_1",g:"mg",o:0,r:0,q:"性是某种肮脏的东西",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:15,id:"mg_2",g:"mg",o:0,r:0,q:"自慰是有害的",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:16,id:"mg_3",g:"mg",o:0,r:0,q:"只有在婚姻中性行为才是道德的",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:17,id:"mg_4",g:"mg",o:0,r:0,q:"有性欲望让我感到内疚",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:18,id:"mg_5",g:"mg",o:0,r:0,q:"性幻想是错误的",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:19,id:"mg_6",g:"mg",o:0,r:0,q:"我因自己的性想法而感到羞耻",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:20,id:"mg_7",g:"mg",o:0,r:0,q:"性是只有在特定条件下才能接受的东西",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:21,id:"mg_8",g:"mg",o:0,r:0,q:"我担心我的性行为在道德上是错误的",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:22,id:"mg_9",g:"mg",o:0,r:0,q:"享受性快感让我感到内疚",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:23,id:"mg_10",g:"mg",o:0,r:0,q:"性冲动是需要控制的",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:24,id:"ks_1",g:"ks",o:1,r:0,q:"我对自己的性身体感到羞耻",p:[{v:1,label:"从不"},{v:2,label:"很少"},{v:3,label:"有时"},{v:4,label:"经常"},{v:5,label:"总是"}]},
{n:25,id:"ks_2",g:"ks",o:1,r:0,q:"我为自己的性想法感到羞耻",p:[{v:1,label:"从不"},{v:2,label:"很少"},{v:3,label:"有时"},{v:4,label:"经常"},{v:5,label:"总是"}]},
{n:26,id:"ks_3",g:"ks",o:1,r:0,q:"我为自己的性欲望感到羞耻",p:[{v:1,label:"从不"},{v:2,label:"很少"},{v:3,label:"有时"},{v:4,label:"经常"},{v:5,label:"总是"}]},
{n:27,id:"ks_4",g:"ks",o:1,r:0,q:"我为自己的性行为感到羞耻",p:[{v:1,label:"从不"},{v:2,label:"很少"},{v:3,label:"有时"},{v:4,label:"经常"},{v:5,label:"总是"}]},
{n:28,id:"ks_5",g:"ks",o:1,r:0,q:"我为自己的性感受感到羞耻",p:[{v:1,label:"从不"},{v:2,label:"很少"},{v:3,label:"有时"},{v:4,label:"经常"},{v:5,label:"总是"}]},
{n:29,id:"ks_6",g:"ks",o:1,r:0,q:"我觉得我的性本质在某种程度上是有缺陷的",p:[{v:1,label:"从不"},{v:2,label:"很少"},{v:3,label:"有时"},{v:4,label:"经常"},{v:5,label:"总是"}]},
{n:30,id:"ks_7",g:"ks",o:1,r:0,q:"我希望我能改变自己的性身份",p:[{v:1,label:"从不"},{v:2,label:"很少"},{v:3,label:"有时"},{v:4,label:"经常"},{v:5,label:"总是"}]},
{n:31,id:"ks_8",g:"ks",o:1,r:0,q:"我觉得作为一个性存在，我让重要的人失望了",p:[{v:1,label:"从不"},{v:2,label:"很少"},{v:3,label:"有时"},{v:4,label:"经常"},{v:5,label:"总是"}]},
{n:32,id:"ks_9",g:"ks",o:1,r:0,q:"我觉得我的性方面不如其他人",p:[{v:1,label:"从不"},{v:2,label:"很少"},{v:3,label:"有时"},{v:4,label:"经常"},{v:5,label:"总是"}]},
{n:33,id:"sos_1",g:"sos",o:0,r:0,q:"我对色情内容感到不舒服",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:34,id:"sos_2",g:"sos",o:0,r:0,q:"性相关的话题让我感到尴尬",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:35,id:"sos_3",g:"sos",o:0,r:0,q:"我倾向于避免性暗示的内容",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:36,id:"sos_4",g:"sos",o:0,r:0,q:"看到性相关的图像会让我感到不安",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:37,id:"sos_5",g:"sos",o:0,r:0,q:"我觉得公开讨论性是不合适的",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]}
  ];
  bankQuick.variant = "quick";

  var bankFull = [
{n:0,id:"ses_1",g:"ses",o:0,r:0,q:"当我看到有吸引力的人时，我很容易产生性幻想",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:1,id:"ses_2",g:"ses",o:0,r:0,q:"性的画面或故事很容易让我兴奋",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:2,id:"ses_3",g:"ses",o:0,r:0,q:"我很容易被性唤起",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:3,id:"ses_4",g:"ses",o:0,r:0,q:"看到裸体会让我性兴奋",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:4,id:"ses_5",g:"ses",o:0,r:0,q:"当我幻想与某人发生性关系时，我很容易被唤起",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:5,id:"ses_6",g:"ses",o:0,r:0,q:"性兴奋来得快去得也快",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:6,id:"ses_7",g:"ses",o:0,r:0,q:"当某人性感地触摸我时，我很容易被唤起",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:7,id:"ses_8",g:"ses",o:0,r:0,q:"某些气味会让我想起性并让我兴奋",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:8,id:"ses_9",g:"ses",o:0,r:0,q:"我很容易对不熟悉的人产生性兴趣",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:9,id:"ses_10",g:"ses",o:0,r:0,q:"当我听到别人谈论性时，我很容易被唤起",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:10,id:"ses_11",g:"ses",o:0,r:0,q:"音乐可以让我想起性并让我兴奋",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:11,id:"ses_12",g:"ses",o:0,r:0,q:"很多事情都能让我想起性",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:12,id:"ses_13",g:"ses",o:0,r:0,q:"我觉得自己性欲很强",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:13,id:"ses_14",g:"ses",o:0,r:0,q:"当我看电影中的浪漫场景时，我想到性",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:14,id:"ses_15",g:"ses",o:0,r:0,q:"我容易被多种类型的人吸引",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:15,id:"ses_16",g:"ses",o:0,r:0,q:"我经常发现自己在想性",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:16,id:"sis1_1",g:"sis1",o:0,r:0,q:"如果我担心性表现，我就很难维持性兴奋",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:17,id:"sis1_2",g:"sis1",o:0,r:0,q:"除非我确信不会让伴侣失望，否则我很难放松享受性生活",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:18,id:"sis1_3",g:"sis1",o:0,r:0,q:"当我想到可能无法满足伴侣时，我会失去性兴趣",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:19,id:"sis1_4",g:"sis1",o:0,r:0,q:"如果我担心自己的性表现，我就很难专注于性快感",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:20,id:"sis1_5",g:"sis1",o:0,r:0,q:"性活动中的分心想法会让我失去性兴奋",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:21,id:"sis1_6",g:"sis1",o:0,r:0,q:"我需要我的生殖器被伴侣完全接受，否则我无法保持兴奋",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:22,id:"sis1_7",g:"sis1",o:0,r:0,q:"除非我确信伴侣对我有性吸引力，否则我很难专注于自己的快感",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:23,id:"sis1_8",g:"sis1",o:0,r:0,q:"如果我担心我的性表现会如何被评判，我会失去性兴奋",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:24,id:"sis1_9",g:"sis1",o:0,r:0,q:"除非我觉得自己在性方面有能力，否则我无法享受性",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:25,id:"sis1_10",g:"sis1",o:0,r:0,q:"我无法专注于性快感，因为我担心我的身体外观",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:26,id:"sis1_11",g:"sis1",o:0,r:0,q:"当我担心是否会达到高潮时，我很难保持性兴奋",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:27,id:"sis1_12",g:"sis1",o:0,r:0,q:"如果我觉得我被迫发生性关系，我会失去性兴趣",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:28,id:"sis1_13",g:"sis1",o:0,r:0,q:"除非感觉安全，否则我无法被性唤起",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:29,id:"sis1_14",g:"sis1",o:0,r:0,q:"如果我不确定我能满足伴侣，我很难变得兴奋",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:30,id:"sis2_1",g:"sis2",o:0,r:0,q:"如果我认为有被发现的风险，我不太可能寻求性活动",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:31,id:"sis2_2",g:"sis2",o:0,r:0,q:"担心性传播疾病会降低我的性兴趣",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:32,id:"sis2_3",g:"sis2",o:0,r:0,q:"如果存在风险，我很难保持性兴奋",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:33,id:"sis2_4",g:"sis2",o:0,r:0,q:"担心怀孕会影响我的性兴趣",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:34,id:"sis2_5",g:"sis2",o:0,r:0,q:"陌生或不熟悉的环境会让我难以性兴奋",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:35,id:"sis2_6",g:"sis2",o:0,r:0,q:"如果有人可能听到我们，我不太可能被性唤起",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:36,id:"sis2_7",g:"sis2",o:0,r:0,q:"当我第一次与某人发生性关系时，我很难被唤起",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:37,id:"sis2_8",g:"sis2",o:0,r:0,q:"如果我无法专注于正在发生的事情，我会失去性兴奋",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:38,id:"sis2_9",g:"sis2",o:0,r:0,q:"除非我的伴侣似乎真正想要性，否则我很难保持兴奋",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:39,id:"sis2_10",g:"sis2",o:0,r:0,q:"当我觉得我的伴侣没有完全投入时，我会失去性兴趣",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:40,id:"sis2_11",g:"sis2",o:0,r:0,q:"我需要感到与伴侣的强烈情感联系才能享受性",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:41,id:"sis2_12",g:"sis2",o:0,r:0,q:"药物或酒精会让我很难被性唤起",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:42,id:"sis2_13",g:"sis2",o:0,r:0,q:"除非情绪合适，否则我无法真正专注于性快感",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:43,id:"sis2_14",g:"sis2",o:0,r:0,q:"如果我担心伴侣的感受，我很难专注于自己的快感",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:44,id:"sis2_15",g:"sis2",o:0,r:0,q:"有时我担心性接触的意义，这会干扰我的性兴奋",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:45,id:"mg_1",g:"mg",o:0,r:0,q:"性是某种肮脏的东西",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:46,id:"mg_2",g:"mg",o:0,r:0,q:"自慰是有害的",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:47,id:"mg_3",g:"mg",o:0,r:0,q:"只有在婚姻中性行为才是道德的",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:48,id:"mg_4",g:"mg",o:0,r:0,q:"有性欲望让我感到内疚",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:49,id:"mg_5",g:"mg",o:0,r:0,q:"性幻想是错误的",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:50,id:"mg_6",g:"mg",o:0,r:0,q:"我因自己的性想法而感到羞耻",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:51,id:"mg_7",g:"mg",o:0,r:0,q:"性是只有在特定条件下才能接受的东西",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:52,id:"mg_8",g:"mg",o:0,r:0,q:"我担心我的性行为在道德上是错误的",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:53,id:"mg_9",g:"mg",o:0,r:0,q:"享受性快感让我感到内疚",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:54,id:"mg_10",g:"mg",o:0,r:0,q:"性冲动是需要控制的",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:55,id:"mg_11",g:"mg",o:0,r:0,q:"我觉得性欲望是人类低级的本能",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:56,id:"mg_12",g:"mg",o:0,r:0,q:"谈论性让我感到不舒服",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:57,id:"mg_13",g:"mg",o:0,r:0,q:"我觉得强烈的性欲是不好的",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:58,id:"mg_14",g:"mg",o:0,r:0,q:"我对自己过去的某些性经历感到后悔",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:59,id:"mg_15",g:"mg",o:0,r:0,q:"我觉得性行为应该只是为了生育",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:60,id:"mg_16",g:"mg",o:0,r:0,q:"我对自己的性想法感到不安",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:61,id:"mg_17",g:"mg",o:0,r:0,q:"我认为享受性是自私的表现",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:62,id:"mg_18",g:"mg",o:0,r:0,q:"我担心我的性行为会被他人判断",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:63,id:"mg_19",g:"mg",o:0,r:0,q:"我觉得纯洁比性经验更重要",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:64,id:"mg_20",g:"mg",o:0,r:0,q:"我对自己的性身体感到不适",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:65,id:"mg_21",g:"mg",o:0,r:0,q:"我认为性应该是神圣的，不应该随便对待",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:66,id:"mg_22",g:"mg",o:0,r:0,q:"我对自己的性冲动感到困扰",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:67,id:"mg_23",g:"mg",o:0,r:0,q:"我觉得性活动会让我变得不纯洁",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:68,id:"mg_24",g:"mg",o:0,r:0,q:"我担心性行为会影响我的品格",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:69,id:"mg_25",g:"mg",o:0,r:0,q:"我认为好人不应该有太多性想法",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:70,id:"mg_26",g:"mg",o:0,r:0,q:"我对自己的性历史感到羞愧",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:71,id:"mg_27",g:"mg",o:0,r:0,q:"我觉得性欲望会分散我对重要事情的注意力",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:72,id:"mg_28",g:"mg",o:0,r:0,q:"我认为控制性冲动是道德修养的体现",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:73,id:"ks_1",g:"ks",o:1,r:0,q:"我对自己的性身体感到羞耻",p:[{v:1,label:"从不"},{v:2,label:"很少"},{v:3,label:"有时"},{v:4,label:"经常"},{v:5,label:"总是"}]},
{n:74,id:"ks_2",g:"ks",o:1,r:0,q:"我为自己的性想法感到羞耻",p:[{v:1,label:"从不"},{v:2,label:"很少"},{v:3,label:"有时"},{v:4,label:"经常"},{v:5,label:"总是"}]},
{n:75,id:"ks_3",g:"ks",o:1,r:0,q:"我为自己的性欲望感到羞耻",p:[{v:1,label:"从不"},{v:2,label:"很少"},{v:3,label:"有时"},{v:4,label:"经常"},{v:5,label:"总是"}]},
{n:76,id:"ks_4",g:"ks",o:1,r:0,q:"我为自己的性行为感到羞耻",p:[{v:1,label:"从不"},{v:2,label:"很少"},{v:3,label:"有时"},{v:4,label:"经常"},{v:5,label:"总是"}]},
{n:77,id:"ks_5",g:"ks",o:1,r:0,q:"我为自己的性感受感到羞耻",p:[{v:1,label:"从不"},{v:2,label:"很少"},{v:3,label:"有时"},{v:4,label:"经常"},{v:5,label:"总是"}]},
{n:78,id:"ks_6",g:"ks",o:1,r:0,q:"我觉得我的性本质在某种程度上是有缺陷的",p:[{v:1,label:"从不"},{v:2,label:"很少"},{v:3,label:"有时"},{v:4,label:"经常"},{v:5,label:"总是"}]},
{n:79,id:"ks_7",g:"ks",o:1,r:0,q:"我希望我能改变自己的性身份",p:[{v:1,label:"从不"},{v:2,label:"很少"},{v:3,label:"有时"},{v:4,label:"经常"},{v:5,label:"总是"}]},
{n:80,id:"ks_8",g:"ks",o:1,r:0,q:"我觉得作为一个性存在，我让重要的人失望了",p:[{v:1,label:"从不"},{v:2,label:"很少"},{v:3,label:"有时"},{v:4,label:"经常"},{v:5,label:"总是"}]},
{n:81,id:"ks_9",g:"ks",o:1,r:0,q:"我觉得我的性方面不如其他人",p:[{v:1,label:"从不"},{v:2,label:"很少"},{v:3,label:"有时"},{v:4,label:"经常"},{v:5,label:"总是"}]},
{n:82,id:"sos_1",g:"sos",o:0,r:0,q:"我对色情内容感到不舒服",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:83,id:"sos_2",g:"sos",o:0,r:0,q:"性相关的话题让我感到尴尬",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:84,id:"sos_3",g:"sos",o:0,r:0,q:"我倾向于避免性暗示的内容",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:85,id:"sos_4",g:"sos",o:0,r:0,q:"看到性相关的图像会让我感到不安",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:86,id:"sos_5",g:"sos",o:0,r:0,q:"我觉得公开讨论性是不合适的",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:87,id:"sos_6",g:"sos",o:0,r:0,q:"我认为过多接触性内容对人有害",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:88,id:"sos_7",g:"sos",o:0,r:0,q:"我觉得大多数性教育材料过于露骨",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:89,id:"sos_8",g:"sos",o:0,r:0,q:"我认为性应该是私密的，不应该公开讨论",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:90,id:"sos_9",g:"sos",o:0,r:0,q:"我对媒体中的性内容感到反感",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:91,id:"sos_10",g:"sos",o:0,r:0,q:"我觉得社会对性过于开放",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:92,id:"sos_11",g:"sos",o:0,r:0,q:"我认为年轻人接触性信息太早了",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:93,id:"sos_12",g:"sos",o:0,r:0,q:"我对性俱乐部或成人娱乐场所持负面态度",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:94,id:"sos_13",g:"sos",o:0,r:0,q:"我认为性研究是不必要的",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:95,id:"sos_14",g:"sos",o:0,r:0,q:"我觉得公开展示亲密行为是不合适的",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:96,id:"sos_15",g:"sos",o:0,r:0,q:"我对性玩具或性用品感到不适",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:97,id:"sos_16",g:"sos",o:0,r:0,q:"我认为性应该是自然发生的，不需要特别关注",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:98,id:"sos_17",g:"sos",o:0,r:0,q:"我对性多样性的概念感到困扰",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:99,id:"sos_18",g:"sos",o:0,r:0,q:"我觉得性咨询或性治疗是令人尴尬的",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:100,id:"sos_19",g:"sos",o:0,r:0,q:"我认为传统的性价值观更可取",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:101,id:"sos_20",g:"sos",o:0,r:0,q:"我对现代社会的性自由持谨慎态度",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:102,id:"sos_21",g:"sos",o:0,r:0,q:"我认为过多的性信息会让人困惑",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:103,id:"bsas_perm_1",g:"bsas",o:0,r:0,q:"我不需要与某人有感情承诺就可以和他们发生性关系",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:104,id:"bsas_perm_2",g:"bsas",o:0,r:0,q:"我觉得婚前性行为是可以接受的",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:105,id:"bsas_perm_3",g:"bsas",o:0,r:0,q:"我认为一夜情是可以接受的",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:106,id:"bsas_perm_4",g:"bsas",o:0,r:0,q:"我觉得有多个性伴侣是可以的",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:107,id:"bsas_perm_5",g:"bsas",o:0,r:1,q:"我认为性应该只发生在已婚夫妇之间",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:108,id:"bsas_perm_6",g:"bsas",o:0,r:0,q:"我觉得性自由是重要的",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:109,id:"bsas_birth_1",g:"bsas",o:0,r:0,q:"避孕是双方的责任",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:110,id:"bsas_birth_2",g:"bsas",o:0,r:1,q:"女性应该负责避孕",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:111,id:"bsas_birth_3",g:"bsas",o:0,r:1,q:"男性应该负责避孕",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:112,id:"bsas_birth_4",g:"bsas",o:0,r:0,q:"使用避孕措施是明智的",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:113,id:"bsas_birth_5",g:"bsas",o:0,r:0,q:"我支持计划生育",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:114,id:"bsas_birth_6",g:"bsas",o:0,r:0,q:"性教育应该包括避孕信息",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:115,id:"bsas_comm_1",g:"bsas",o:0,r:1,q:"谈论性是困难的",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:116,id:"bsas_comm_2",g:"bsas",o:0,r:0,q:"我觉得和伴侣讨论性是重要的",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:117,id:"bsas_comm_3",g:"bsas",o:0,r:1,q:"我觉得表达性需求是困难的",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:118,id:"bsas_comm_4",g:"bsas",o:0,r:0,q:"我能轻松地和朋友谈论性",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:119,id:"bsas_comm_5",g:"bsas",o:0,r:0,q:"我认为开放的性沟通是健康关系的关键",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:120,id:"bsas_inst_1",g:"bsas",o:0,r:0,q:"性主要是为了身体快感",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:121,id:"bsas_inst_2",g:"bsas",o:0,r:0,q:"性最重要的部分是享受",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:122,id:"bsas_inst_3",g:"bsas",o:0,r:0,q:"性不需要爱情",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:123,id:"bsas_inst_4",g:"bsas",o:0,r:0,q:"性可以是纯粹的身体活动",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:124,id:"bsas_inst_5",g:"bsas",o:0,r:1,q:"性主要是为了情感联系",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]},
{n:125,id:"bsas_inst_6",g:"bsas",o:0,r:1,q:"我觉得性应该总是浪漫的",p:[{v:1,label:"非常不同意"},{v:2,label:"不同意"},{v:3,label:"中性"},{v:4,label:"同意"},{v:5,label:"非常同意"}]}
  ];
  bankFull.variant = "full";

  var levels = [
    { key: "very-low", min: 0, max: 20, label: "很低 · 较少压抑" },
    { key: "low", min: 20, max: 40, label: "偏低 · 轻度压抑" },
    { key: "moderate", min: 40, max: 60, label: "中等 · 中度压抑" },
    { key: "high", min: 60, max: 80, label: "偏高 · 较高压抑" },
    { key: "very-high", min: 80, max: 101, label: "很高 · 高度压抑" }
  ];

  var variants = {
    quick: { label: "快速测试", duration: "约 8–15 分钟", bank: bankQuick, total: 38, scales: [{k:"sis_ses_sf",n:0,c:14,t:"SIS/SES-SF 性抑制/性兴奋量表（简版）"},{k:"mosher_guilt",n:1,c:10,t:"Mosher 性内疚量表（10 项）"},{k:"kiss9_shame",n:2,c:9,t:"KISS-9 性羞耻量表"},{k:"sos_screening",n:3,c:5,t:"SOS 性观感筛查（5 项）"}] },
    full: { label: "完整测试", duration: "约 25–40 分钟", bank: bankFull, total: 126, scales: [{k:"sis_ses_full",n:0,c:45,t:"SIS/SES 性抑制/性兴奋量表（完整版 45 项）"},{k:"mosher_guilt_full",n:1,c:28,t:"Mosher 性内疚量表（完整版 28 项）"},{k:"kiss9_shame",n:2,c:9,t:"KISS-9 性羞耻量表"},{k:"sos_full",n:3,c:21,t:"SOS 性观感量表（完整版 21 项）"},{k:"bsas_brief",n:4,c:23,t:"BSAS 性态度量表（简版 23 项）"}] }
  };

  global.Innerway = global.Innerway || {};
  global.Innerway.repression = { variants: variants, levels: levels, norms: {"quick":{"sos":{"mean":15.3,"sd":4.6},"guilt":{"mean":25.6,"sd":7.8},"shame":{"mean":18.7,"sd":6.4},"sis":{"mean":35.2,"sd":8.9},"ses":{"mean":16.8,"sd":3.7}},"full":{"sos":{"mean":63,"sd":12.8},"guilt":{"mean":62.7,"sd":19.2},"shame":{"mean":18.7,"sd":6.4},"sis":{"mean":87.5,"sd":18.3},"ses":{"mean":42.8,"sd":9.2},"bsas":{"mean":69.2,"sd":15.4}}} };
})(window);

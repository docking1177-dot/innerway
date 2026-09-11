/* ============================================================
 * data-tat.js · 主题统觉叙事测验（TAT 式）· 原创意象图版 v1
 * ------------------------------------------------------------
 * 题型的「方法」借鉴主题统觉测验（Thematic Apperception Test，
 * Morgan & Murray, 1935）的投射原理：给出一幅多义、模糊的画面，
 * 请用户凭第一直觉编写一个"有前因、有当下、有结局"的故事。
 *
 * 图版合规说明（重要）：
 *   - Murray TAT 原版图版（1943/1971）在美国仍受版权保护，
 *     哈佛大学出版社要求图版不得公开展示（版权至约 2038 年底）。
 *   - 本站图版均为原创构图：前 4 幅为本站原创意象照片
 *     （assets/tat/，含平台水印，随图版整体换新时一并处理），
 *     其余 6 幅为本站原创几何意象图；全部仅作开放性投射素材，
 *     不复制、不近似、不重新演绎任何原版卡片构图；故事引导语
 *     为本站自撰。
 *   - 本门类是自我探索用途的演示/教育内容，非正式心理测量，
 *     无计分常模、不构成诊断，报告已含免责声明。
 *   - 写作疲劳友好：共 10 幅，写满 2 幅即可随时提前提交，
 *     未写画面不必作答。
 *
 * 结构：每题 { n, type:'story', id, title(图名，中性), scene(画面客观描述),
 *          q(引导语), img(意象照片相对路径，仅前 4 幅)，
 *          svg(完整 <svg> 几何意象图：照片缺失时的兜底 / 后 6 幅的图版) }
 * 作答记录：q.answers[题号下标] = 用户故事全文（字符串，非空即已答）。
 * ============================================================ */
(function (global) {
  'use strict';

  /* 每幅图一个完整 <svg>：viewBox 0 0 1000 620，宽高比固定、可响应缩放 */
  var C1 = '<svg viewBox="0 0 1000 620" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="多义意象图一">' +
    /* 室内：墙面 + 地面 */
    '<rect x="0" y="0" width="1000" height="368" fill="#E9DFC9"/>' +
    '<rect x="0" y="368" width="1000" height="252" fill="#DED1B4"/>' +
    '<line x1="0" y1="368" x2="1000" y2="368" stroke="#D2C19E" stroke-width="2"/>' +
    /* 大窗（画面主体） */
    '<rect x="236" y="76" width="528" height="252" fill="#EFE7D5" stroke="#7A6A54" stroke-width="10"/>' +
    /* 窗外：天空层次 + 圆日 + 远山剪影 */
    '<rect x="241" y="81" width="518" height="142" fill="#F6EFDF"/>' +
    '<circle cx="656" cy="150" r="34" fill="#E2C38F" opacity=".9"/>' +
    '<polygon points="241,223 352,132 470,216 598,120 759,223" fill="#C7B79A"/>' +
    '<polygon points="598,120 650,158 641,120 716,168 759,120 759,223 598,223" fill="#A9A28D"/>' +
    /* 窗棂 */
    '<line x1="500" y1="81" x2="500" y2="323" stroke="#7A6A54" stroke-width="8"/>' +
    '<line x1="241" y1="202" x2="759" y2="202" stroke="#7A6A54" stroke-width="6"/>' +
    /* 窗台下的暗部人物剪影（逆光坐在椅中） */
    '<ellipse cx="420" cy="486" rx="128" ry="14" fill="#D6C5A2" opacity=".6"/>' +
    '<rect x="330" y="448" width="180" height="10" rx="5" fill="#6E5F4B"/>' +
    '<rect x="342" y="458" width="12" height="74" fill="#6E5F4B"/><rect x="486" y="458" width="12" height="74" fill="#6E5F4B"/>' +
    '<rect x="322" y="416" width="196" height="40" rx="10" fill="#6E5F4B"/>' +
    '<path d="M398 416c-2-44-6-88 6-126" fill="none" stroke="#57503F" stroke-width="20" stroke-linecap="round"/>' +
    '<circle cx="412" cy="258" r="27" fill="#57503F"/>' +
    '<ellipse cx="356" cy="534" rx="60" ry="10" fill="#D6C5A2" opacity=".5"/>' +
    '<rect x="320" y="520" width="120" height="14" rx="4" fill="#6E5F4B"/>' +
    /* 地面光带（从窗漏下） */
    '<polygon points="300,368 730,368 640,620 330,620" fill="#EFDCAF" opacity=".22"/>' +
    '</svg>';

  var C2 = '<svg viewBox="0 0 1000 620" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="多义意象图二">' +
    /* 天空 + 草地 */
    '<rect x="0" y="0" width="1000" height="150" fill="#EAE3D2"/>' +
    '<rect x="0" y="150" width="1000" height="470" fill="#D3DAC3"/>' +
    '<path d="M0 196 Q 250 158 540 200 T 1000 178 L1000 150 L0 150 Z" fill="#E3E6D4"/>' +
    /* 远景树冠 */
    '<ellipse cx="190" cy="96" rx="130" ry="58" fill="#B9C2A4"/>' +
    '<rect x="178" y="136" width="24" height="52" fill="#9AA58A"/>' +
    '<ellipse cx="852" cy="82" rx="96" ry="46" fill="#C1C7AC"/>' +
    '<rect x="844" y="114" width="16" height="46" fill="#A6AE94"/>' +
    /* 中景一株树 */
    '<rect x="90" y="220" width="30" height="150" fill="#9AA58A"/>' +
    '<ellipse cx="105" cy="196" rx="110" ry="70" fill="#AEB89A"/>' +
    /* 长椅 */
    '<rect x="330" y="424" width="360" height="22" rx="10" fill="#8A7458"/>' +
    '<rect x="330" y="376" width="360" height="26" rx="12" fill="#8A7458"/>' +
    '<path d="M336 400 C 420 372 610 372 684 400 L 684 424 L 336 424 Z" fill="#9C8766"/>' +
    '<rect x="352" y="446" width="18" height="80" fill="#7C6950"/><rect x="650" y="446" width="18" height="80" fill="#7C6950"/>' +
    '<rect x="316" y="432" width="22" height="26" rx="6" fill="#7C6950"/><rect x="682" y="432" width="22" height="26" rx="6" fill="#7C6950"/>' +
    /* 两端两个人物剪影（中间空着一段） */
    '<path d="M400 452c-2-26-4-56 4-84" fill="none" stroke="#5A5B45" stroke-width="22" stroke-linecap="round"/>' +
    '<circle cx="410" cy="338" r="28" fill="#5A5B45"/>' +
    '<path d="M376 452h64l-4 34h-54z" fill="#5A5B45"/>' +
    '<path d="M640 452c-2-24-4-52 4-78" fill="none" stroke="#6A6150" stroke-width="20" stroke-linecap="round"/>' +
    '<circle cx="648" cy="344" r="25" fill="#6A6150"/>' +
    '<path d="M622 452h56l-4 30h-50z" fill="#6A6150"/>' +
    /* 两人之间的空位：一片落叶/飞鸟 */
    '<path d="M524 330q14-22 34-10-20 6-34 10z" fill="#B08D57" opacity=".8"/>' +
    '</svg>';

  /* 图三：黄昏岔路口 + 一个立姿背影 */
  var C3 = '<svg viewBox="0 0 1000 620" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="多义意象图三">' +
    '<rect x="0" y="0" width="1000" height="250" fill="#EFE2CC"/>' +
    '<rect x="0" y="250" width="1000" height="370" fill="#DCCCA8"/>' +
    '<circle cx="506" cy="168" r="64" fill="#E8CDA0" opacity=".6"/>' +
    /* 远山淡影 */
    '<path d="M0 250 L 120 168 L 260 250 Z" fill="#D2C2A0" opacity=".8"/>' +
    '<path d="M740 250 L 880 150 L 1000 236 L1000 250 Z" fill="#D2C2A0" opacity=".8"/>' +
    /* 主路（近宽远窄，至岔口后分两支：左支向右上明亮，右支向右下幽暗） */
    '<polygon points="392,620 608,620 700,404 300,404" fill="#E4D5B2"/>' +
    '<polygon points="300,404 430,268 560,404" fill="#DCCBA4"/>' +
    '<polygon points="700,404 620,352 730,352 782,404" fill="#CDBA90"/>' +
    '<polygon points="560,404 620,352 730,352 782,404 700,404" fill="#BDAF87"/>' +
    /* 两支尽头的光/暗提示（抽象，不指向具体答案） */
    '<circle cx="470" cy="240" r="34" fill="#F3DFB4" opacity=".55"/>' +
    '<ellipse cx="752" cy="520" rx="60" ry="90" fill="#A99B7C" opacity=".5"/>' +
    /* 低矮草影 */
    '<path d="M250 620 q20-60 8-118" fill="none" stroke="#B7A683" stroke-width="6" stroke-linecap="round"/>' +
    '<path d="M760 620 q-16-52-4-104" fill="none" stroke="#B7A683" stroke-width="6" stroke-linecap="round"/>' +
    /* 岔口处的背影 */
    '<ellipse cx="500" cy="438" rx="40" ry="8" fill="#C9B894" opacity=".8"/>' +
    '<path d="M500 436c0-30 2-64-8-96" fill="none" stroke="#4F4E3E" stroke-width="18" stroke-linecap="round"/>' +
    '<circle cx="496" cy="318" r="22" fill="#4F4E3E"/>' +
    '<path d="M470 434h62l-6 60h-50z" fill="#4F4E3E"/>' +
    '</svg>';

  var C4 = '<svg viewBox="0 0 1000 620" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="多义意象图四">' +
    /* 半开的门：室内偏暗、门缝泄入强光 */
    '<rect x="0" y="0" width="1000" height="620" fill="#CBBBA0"/>' +
    '<rect x="0" y="0" width="1000" height="520" fill="#CFC0A6"/>' +
    '<rect x="0" y="520" width="1000" height="100" fill="#B9A988"/>' +
    '<line x1="0" y1="520" x2="1000" y2="520" stroke="#A8926F" stroke-width="2"/>' +
    /* 门框（偏右），门板半开向画内 */
    '<rect x="640" y="70" width="24" height="470" fill="#7C6A50"/>' +
    '<rect x="896" y="70" width="24" height="470" fill="#7C6A50"/>' +
    '<rect x="640" y="70" width="280" height="24" fill="#7C6A50"/>' +
    /* 门板（半开，向画面内倾斜） */
    '<polygon points="664,94 832,214 832,520 664,520" fill="#8E7A5C"/>' +
    '<polygon points="832,214 852,228 852,520 832,520" fill="#9C8866"/>' +
    '<circle cx="676" cy="318" r="10" fill="#C9B384"/>' +
    /* 门缝泄出的强光 */
    '<polygon points="852,228 864,238 864,520 852,520" fill="#F6E7C4" opacity=".92"/>' +
    '<polygon points="864,238 918,330 830,520 864,520" fill="#F1DCAA" opacity=".35"/>' +
    /* 门外光里一个极简立姿轮廓（站在光中） */
    '<path d="M972 120c0 40-4 86 2 128" fill="none" stroke="#E8D9B2" stroke-width="14" stroke-linecap="round" opacity=".9"/>' +
    '<circle cx="974" cy="96" r="19" fill="#E8D9B2" opacity=".9"/>' +
    /* 室内暗侧：一把面对门的空椅 */
    '<rect x="96" y="368" width="150" height="18" rx="8" fill="#6E6150"/>' +
    '<rect x="112" y="386" width="12" height="120" fill="#6E6150"/><rect x="220" y="386" width="12" height="120" fill="#6E6150"/>' +
    '<path d="M108 352 C 176 326 244 352 244 368 L 244 386 L 108 386 Z" fill="#7C6E58"/>' +
    '<rect x="70" y="360" width="22" height="30" rx="8" fill="#6E6150"/><rect x="250" y="360" width="22" height="30" rx="8" fill="#6E6150"/>' +
    '</svg>';

  /* ---- 后 6 幅：原创几何意象图（与照片组共用同一套开放多义风格） ---- */

  /* 图五：河与桥——河把路截断，对岸有桥与船，近处一个身影站在岸边 */
  var C5 = '<svg viewBox="0 0 1000 620" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="多义意象图五">' +
    '<rect x="0" y="0" width="1000" height="330" fill="#E9E1CE"/>' +
    '<rect x="0" y="330" width="1000" height="290" fill="#CBD1BB"/>' +
    '<line x1="0" y1="330" x2="1000" y2="330" stroke="#B4BBA3" stroke-width="3"/>' +
    '<rect x="0" y="330" width="1000" height="22" fill="#B9C0A6" opacity=".8"/>' +
    /* 桥拱与桥墩 */
    '<path d="M120 356 Q 500 196 890 356" fill="none" stroke="#7A6A54" stroke-width="18" stroke-linecap="round"/>' +
    '<line x1="330" y1="296" x2="330" y2="430" stroke="#8E7A5C" stroke-width="7"/>' +
    '<line x1="700" y1="292" x2="700" y2="430" stroke="#8E7A5C" stroke-width="7"/>' +
    /* 近岸：左前景地块 + 岸边立姿剪影 */
    '<polygon points="0,410 330,410 268,620 0,620" fill="#DBD0B2"/>' +
    '<path d="M0 410 Q 165 396 330 410" fill="none" stroke="#C7BA98" stroke-width="5"/>' +
    '<ellipse cx="112" cy="470" rx="40" ry="8" fill="#B9AC8B" opacity=".55"/>' +
    '<path d="M112 468c0-32 2-68-9-104" fill="none" stroke="#4F4E3E" stroke-width="17" stroke-linecap="round"/>' +
    '<circle cx="101" cy="340" r="21" fill="#4F4E3E"/>' +
    '<path d="M88 464h50l-8 52h-36z" fill="#4F4E3E"/>' +
    /* 河中小船 + 水纹 + 飞鸟 */
    '<path d="M690 540 L 836 540 L 812 574 L 714 574 Z" fill="#6E6150"/>' +
    '<line x1="762" y1="540" x2="762" y2="492" stroke="#4F4E3E" stroke-width="6"/>' +
    '<polygon points="762,492 806,510 762,530" fill="#B08D57" opacity=".92"/>' +
    '<path d="M620 592 q 16 -6 32 0 M700 606 q 14 -6 28 0" stroke="#A9B09A" stroke-width="4" fill="none"/>' +
    '<path d="M430 120 q 10 -12 20 0 M478 152 q 8 -10 16 0" stroke="#9A8F74" fill="none" stroke-width="4"/>' +
    '</svg>';

  /* 图六：山巅的旗——黄昏山丘上立着一面旗，一个人正朝山巅走去 */
  var C6 = '<svg viewBox="0 0 1000 620" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="多义意象图六">' +
    '<rect x="0" y="0" width="1000" height="620" fill="#EFE4CE"/>' +
    '<circle cx="220" cy="180" r="60" fill="#E7C998" opacity=".85"/>' +
    '<rect x="0" y="330" width="1000" height="290" fill="#DCCFA9"/>' +
    '<path d="M-20 380 Q 230 200 500 380" fill="none" stroke="#D7C69E" stroke-width="46" opacity=".95"/>' +
    /* 主山丘与山径 */
    '<path d="M520 620 L 812 200 L 1000 352 L 1000 620 Z" fill="#CBB58E"/>' +
    '<path d="M900 620 L 812 210" stroke="#D8C69C" stroke-width="12" opacity=".7" fill="none"/>' +
    /* 旗杆与旗 */
    '<line x1="812" y1="200" x2="812" y2="92" stroke="#5A4A35" stroke-width="9" stroke-linecap="round"/>' +
    '<polygon points="818,98 918,112 818,132" fill="#A95F4A"/>' +
    /* 山脚下走向山巅的身影 + 草丛 */
    '<ellipse cx="470" cy="498" rx="30" ry="7" fill="#C9B48C" opacity=".6"/>' +
    '<path d="M470 496c0-30 2-62-8-92" fill="none" stroke="#4F4E3E" stroke-width="17" stroke-linecap="round"/>' +
    '<circle cx="461" cy="380" r="19" fill="#4F4E3E"/>' +
    '<path d="M456 492h30l-5 44h-21z" fill="#4F4E3E"/>' +
    '<path d="M300 560 q 10 -18 4 -34 M860 566 q 10 -16 6 -30" stroke="#A7936C" stroke-width="5" stroke-linecap="round" fill="none"/>' +
    '</svg>';

  /* 图七：断线的风筝——旷野上空飘着一只风筝，线在风中松开，一个人仰头望着它 */
  var C7 = '<svg viewBox="0 0 1000 620" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="多义意象图七">' +
    '<rect x="0" y="0" width="1000" height="620" fill="#E9E4D2"/>' +
    '<circle cx="856" cy="110" r="42" fill="#F1DDB4" opacity=".9"/>' +
    '<ellipse cx="150" cy="110" rx="92" ry="26" fill="#F7F3E6"/><ellipse cx="200" cy="96" rx="56" ry="20" fill="#F7F3E6"/>' +
    '<path d="M0 548 Q 250 514 540 548 T 1000 540 L1000 620 L0 620 Z" fill="#CFD3B4"/>' +
    '<path d="M0 548 Q 250 514 540 548 T 1000 540" fill="none" stroke="#BAC09C" stroke-width="4"/>' +
    /* 风筝 + 断落松开的线 */
    '<polygon points="330,96 388,176 330,256 272,176" fill="#A98E5F"/>' +
    '<line x1="272" y1="176" x2="388" y2="176" stroke="#7C6A50" stroke-width="4"/>' +
    '<line x1="330" y1="96" x2="330" y2="256" stroke="#7C6A50" stroke-width="4"/>' +
    '<path d="M330 256 q 30 30 8 62 q -18 26 4 52" fill="none" stroke="#8E8468" stroke-width="5" stroke-linecap="round"/>' +
    '<path d="M300 196 Q 230 280 210 350 q -12 44 6 78 q 10 20 -6 34" fill="none" stroke="#8E8468" stroke-width="4"/>' +
    /* 抬头仰望的身影（一臂抬起指向风筝） */
    '<ellipse cx="746" cy="520" rx="30" ry="7" fill="#C0B184" opacity=".55"/>' +
    '<path d="M746 518c0-32 4-64-6-96" fill="none" stroke="#4F4E3E" stroke-width="17" stroke-linecap="round"/>' +
    '<circle cx="737" cy="398" r="19" fill="#4F4E3E"/>' +
    '<path d="M728 514h38l-6 46h-27z" fill="#4F4E3E"/>' +
    '<path d="M740 430 C 700 404 664 372 640 340" fill="none" stroke="#4F4E3E" stroke-width="12" stroke-linecap="round"/>' +
    '</svg>';

  /* 图八：茶凉之前——一张小桌两侧，一边坐着一个人，另一边是空椅与不再冒热气的茶 */
  var C8 = '<svg viewBox="0 0 1000 620" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="多义意象图八">' +
    '<rect x="0" y="0" width="1000" height="480" fill="#E2D8C2"/>' +
    '<rect x="0" y="480" width="1000" height="140" fill="#C9B992"/>' +
    '<line x1="0" y1="480" x2="1000" y2="480" stroke="#AC9A78" stroke-width="3"/>' +
    '<rect x="430" y="96" width="280" height="200" fill="#F6EBD2" stroke="#7A6A54" stroke-width="12"/>' +
    '<line x1="570" y1="96" x2="570" y2="296" stroke="#7A6A54" stroke-width="8"/>' +
    '<polygon points="430,296 710,296 1000,620 140,620" fill="#EFDCAF" opacity=".18"/>' +
    /* 小桌 + 凉茶 */
    '<rect x="330" y="440" width="400" height="16" rx="4" fill="#7A6A54"/>' +
    '<rect x="344" y="456" width="14" height="110" fill="#6E5F4B"/><rect x="702" y="456" width="14" height="110" fill="#6E5F4B"/>' +
    '<rect x="628" y="414" width="30" height="26" rx="5" fill="#8E7A5C"/>' +
    '<path d="M636 408 q -10 -16 -2 -30 M650 408 q 8 -14 0 -28" fill="none" stroke="#857B6D" stroke-width="3" opacity=".8"/>' +
    /* 左侧落座的身影 */
    '<rect x="176" y="470" width="112" height="14" rx="6" fill="#6E6150"/>' +
    '<rect x="188" y="484" width="10" height="136" fill="#5A4A35"/><rect x="268" y="484" width="10" height="136" fill="#5A4A35"/>' +
    '<path d="M214 468 h44 l-6 44 h-32 z" fill="#4F4E3E"/>' +
    '<path d="M236 468 C 234 424 238 402 230 366" fill="none" stroke="#4F4E3E" stroke-width="17" stroke-linecap="round"/>' +
    '<circle cx="229" cy="344" r="20" fill="#4F4E3E"/>' +
    /* 右侧空椅 */
    '<rect x="826" y="470" width="118" height="14" rx="6" fill="#6E6150"/>' +
    '<rect x="838" y="484" width="10" height="136" fill="#5A4A35"/><rect x="928" y="484" width="10" height="136" fill="#5A4A35"/>' +
    '<path d="M840 470 C 840 430 846 396 840 358" fill="none" stroke="#6E6150" stroke-width="15" stroke-linecap="round"/>' +
    '</svg>';

  /* 图九：灯塔与岸——暮色里海岬的灯塔亮起光，一个人坐在近处礁石上望着它 */
  var C9 = '<svg viewBox="0 0 1000 620" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="多义意象图九">' +
    '<rect x="0" y="0" width="1000" height="380" fill="#E7E0CB"/>' +
    '<rect x="0" y="380" width="1000" height="240" fill="#C7CDB5"/>' +
    '<line x1="0" y1="380" x2="1000" y2="380" stroke="#AEB69E" stroke-width="3"/>' +
    '<path d="M560 620 L 760 330 L 1000 480 L 1000 620 Z" fill="#C1AD86"/>' +
    /* 灯塔与光 */
    '<rect x="784" y="212" width="66" height="150" fill="#F0E9D4"/>' +
    '<line x1="784" y1="252" x2="850" y2="252" stroke="#C2AE85" stroke-width="5"/>' +
    '<line x1="784" y1="292" x2="850" y2="292" stroke="#C2AE85" stroke-width="5"/>' +
    '<line x1="784" y1="332" x2="850" y2="332" stroke="#C2AE85" stroke-width="5"/>' +
    '<rect x="800" y="180" width="34" height="32" fill="#7A6A54"/>' +
    '<path d="M800 180 L 817 158 L 834 180 Z" fill="#5A4A35"/>' +
    '<circle cx="817" cy="198" r="46" fill="#F1DCA6" opacity=".7"/>' +
    '<polygon points="800,198 420,258 400,340 800,222" fill="#F3DFB4" opacity=".2"/>' +
    '<polygon points="834,210 540,420 470,470 834,236" fill="#F3DFB4" opacity=".15"/>' +
    /* 近处礁石上望灯的身影 */
    '<path d="M0 468 L 372 468 L 296 620 L 0 620 Z" fill="#CFBE99"/>' +
    '<path d="M0 468 Q 186 452 372 468" fill="none" stroke="#B9A880" stroke-width="4"/>' +
    '<ellipse cx="214" cy="470" rx="44" ry="9" fill="#AE9C74" opacity=".5"/>' +
    '<path d="M215 470 C 211 420 215 398 207 360" fill="none" stroke="#4F4E3E" stroke-width="16" stroke-linecap="round"/>' +
    '<circle cx="205" cy="336" r="20" fill="#4F4E3E"/>' +
    '<path d="M188 470 h54 l-8 56 h-38 z" fill="#4F4E3E"/>' +
    '</svg>';

  /* 图十：弯月与孤树——暮色原野上一棵孤树，一个人靠着树干坐着，天上挂着一弯月 */
  var C10 = '<svg viewBox="0 0 1000 620" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="多义意象图十">' +
    '<rect x="0" y="0" width="1000" height="440" fill="#DFD4BC"/>' +
    '<rect x="0" y="440" width="1000" height="180" fill="#CFBE98"/>' +
    '<line x1="0" y1="440" x2="1000" y2="440" stroke="#BBA983" stroke-width="3"/>' +
    /* 弯月 */
    '<circle cx="180" cy="140" r="56" fill="#F1E8D0"/>' +
    '<circle cx="212" cy="124" r="48" fill="#DFD4BC"/>' +
    /* 孤树：土丘 + 树干 + 枝 + 树冠 */
    '<ellipse cx="720" cy="448" rx="240" ry="40" fill="#C3B087"/>' +
    '<path d="M706 446 C 700 350 706 300 700 236" fill="none" stroke="#57503F" stroke-width="28" stroke-linecap="round"/>' +
    '<path d="M700 292 C 640 258 610 236 580 214" fill="none" stroke="#57503F" stroke-width="16" stroke-linecap="round"/>' +
    '<path d="M701 322 C 764 286 798 268 830 250" fill="none" stroke="#57503F" stroke-width="14" stroke-linecap="round"/>' +
    '<ellipse cx="706" cy="196" rx="128" ry="66" fill="#6E6150"/>' +
    '<ellipse cx="580" cy="226" rx="80" ry="44" fill="#5A5342"/>' +
    '<ellipse cx="830" cy="248" rx="88" ry="46" fill="#6E6150"/>' +
    /* 树干旁靠着的身影 */
    '<ellipse cx="640" cy="452" rx="36" ry="8" fill="#A7946C" opacity=".55"/>' +
    '<path d="M640 452 C 636 404 642 380 634 344" fill="none" stroke="#4F4E3E" stroke-width="16" stroke-linecap="round"/>' +
    '<circle cx="630" cy="320" r="19" fill="#4F4E3E"/>' +
    '<path d="M614 452 h52 l-8 60 h-38 z" fill="#4F4E3E"/>' +
    '<path d="M640 452 C 610 460 590 470 574 484" fill="none" stroke="#4F4E3E" stroke-width="11" stroke-linecap="round"/>' +
    '</svg>';

  var BANK = [
    {
      n: 0, type: 'story', id: 'window-light',
      title: '窗与光',
      scene: '室内一扇大窗前，一个身影背光坐在椅中，望向窗外。',
      q: '看着这幅画，让它在你心里活起来，再讲成一个小故事——不用追求完整或合理，顺着第一直觉写就好。',
      img: 'assets/tat/tat-1-window-light.jpg',
      svg: C1
    },
    {
      n: 1, type: 'story', id: 'bench-seat',
      title: '长椅两端',
      scene: '一张公园长椅上坐着两个人，中间隔着一段空位，四周安静。',
      q: '看着这幅画，让它在你心里活起来，再讲成一个小故事——不用追求完整或合理，顺着第一直觉写就好。',
      img: 'assets/tat/tat-2-bench-seat.jpg',
      svg: C2
    },
    {
      n: 2, type: 'story', id: 'fork-road',
      title: '岔路口',
      scene: '黄昏的一条路在前方分为两支，一个身影站在岔口中央。',
      q: '看着这幅画，让它在你心里活起来，再讲成一个小故事——不用追求完整或合理，顺着第一直觉写就好。',
      img: 'assets/tat/tat-3-fork-road.jpg',
      svg: C3
    },
    {
      n: 3, type: 'story', id: 'half-open-door',
      title: '半开的门',
      scene: '一扇门半开着，门缝里泄出光，门外隐约立着一个身影；室内靠墙放着一把空椅。',
      q: '看着这幅画，让它在你心里活起来，再讲成一个小故事——不用追求完整或合理，顺着第一直觉写就好。',
      img: 'assets/tat/tat-4-half-open-door.jpg',
      svg: C4
    },
    {
      n: 4, type: 'story', id: 'river-bridge',
      title: '河与桥',
      scene: '一条河把路截在面前，对岸有一座桥和一只小船，岸边站着一个身影。',
      q: '看着这幅画，让它在你心里活起来，再讲成一个小故事——不用追求完整或合理，顺着第一直觉写就好。',
      img: 'assets/tat/tat-5-river-bridge.jpg',
      svg: C5
    },
    {
      n: 5, type: 'story', id: 'hill-flag',
      title: '山巅的旗',
      scene: '黄昏的山丘上立着一面旗，一个人正朝着山巅走去。',
      q: '看着这幅画，让它在你心里活起来，再讲成一个小故事——不用追求完整或合理，顺着第一直觉写就好。',
      img: 'assets/tat/tat-6-hill-flag.jpg',
      svg: C6
    },
    {
      n: 6, type: 'story', id: 'broken-kite',
      title: '断线的风筝',
      scene: '旷野上空飘着一只风筝，线已在风中松开，一个身影仰头望着它。',
      q: '看着这幅画，让它在你心里活起来，再讲成一个小故事——不用追求完整或合理，顺着第一直觉写就好。',
      img: 'assets/tat/tat-7-broken-kite.jpg',
      svg: C7
    },
    {
      n: 7, type: 'story', id: 'tea-gone-cold',
      title: '茶凉之前',
      scene: '一张小桌的两侧，一边坐着一个人，另一边放着一杯不再冒热气的茶，椅子空着。',
      q: '看着这幅画，让它在你心里活起来，再讲成一个小故事——不用追求完整或合理，顺着第一直觉写就好。',
      img: 'assets/tat/tat-8-tea-gone-cold.jpg',
      svg: C8
    },
    {
      n: 8, type: 'story', id: 'lighthouse-shore',
      title: '灯塔与岸',
      scene: '暮色中，海岬上的灯塔亮起了光，一个人坐在近处的礁石上望着它。',
      q: '看着这幅画，让它在你心里活起来，再讲成一个小故事——不用追求完整或合理，顺着第一直觉写就好。',
      img: 'assets/tat/tat-9-lighthouse-shore.jpg',
      svg: C9
    },
    {
      n: 9, type: 'story', id: 'tree-crescent',
      title: '弯月与孤树',
      scene: '暮色的原野上有一棵孤树，一个人靠着树干坐着，天上挂着一弯月。',
      q: '看着这幅画，让它在你心里活起来，再讲成一个小故事——不用追求完整或合理，顺着第一直觉写就好。',
      img: 'assets/tat/tat-10-tree-crescent.jpg',
      svg: C10
    }
  ];

  var variants = {
    main: {
      label: '意象叙事 · 10 幅',
      total: BANK.length,
      duration: '10 幅意象 · 每题约 2–3 分钟 · 写满 2 幅即可提交',
      bank: BANK
    }
  };

  global.Innerway = global.Innerway || {};
  global.Innerway.tat = {
    variants: variants,
    disclaimer: '「意象叙事」是主题统觉式（TAT）的自我探索练习：本站图版为原创多义意象，故事没有对错与标准答案。写下 2 幅以上即可提交，未写的画面不必勉强完成。你所写的故事可能反映近期的状态与心境，也可能只是一次随性的想象——请把它当作了解自己的一扇窗，而非人格定论或任何诊断。',
    honor: '图版为本站原创意象（受主题统觉测验 Morgan & Murray 的投射方法启发），不复制或演绎 Murray TAT 原版卡片。'
  };
})(window);

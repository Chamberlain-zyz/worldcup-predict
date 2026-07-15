/* ==========================================================================
   bracket-render.js - 淘汰赛对阵图公共渲染模块
   世界杯（js/bracket.js）与欧冠（js/ucl.js）的对阵图渲染结构一致，
   差异仅在于「球队标识 / 队名取值 / TBD 判定 / 轮次顺序 / 点击数据」等细节，
   故抽出本模块，由各页面传入适配器 opts 复用。

   约定：页面 DOM 中存在 #bracketTop / #bracketBottom 两个容器；
   BRACKET 形如 { top:[...], bottom:[...] }，每场 m 含
   { round, a, b, winner?, scoreA?, scoreB?, penA?, penB?, legs? }。

   使用：
     const render = BracketRender.create({
       roundOrder,        // string[]  轮次显示顺序（决定列布局）
       isTBD(t),          // 判断某支球队是否为待定占位
       teamName(t),       // 队名文本
       teamMark(t),       // 队标 HTML（国旗 / 队徽；TBD 由实现决定是否渲染）
       tipOf(m),          // 可选：行 tooltip 文本（须自行转义）
       dataAttrs(m),      // 可选：场按钮上的自定义 data 属性字符串
       resolveTeams(el),  // 从按钮元素还原 [teamA, teamB]
       onBeforePreview(), // 可选：预览前的副作用（如清积分榜选队）
     });
     render(BRACKET, engine);
   ========================================================================== */
(function(){
  "use strict";

  function create(opts){
    const roundOrder      = opts.roundOrder;
    const isTBD           = opts.isTBD;
    const teamName        = opts.teamName;
    const teamMark        = opts.teamMark;
    const tipOf           = opts.tipOf;
    const dataAttrs       = opts.dataAttrs;
    const resolveTeams    = opts.resolveTeams;
    const onBeforePreview = opts.onBeforePreview;

    // 单场对阵 HTML：两行，各带队标 + 名 + 比分（含点球则括注）
    function matchHTML(m){
      const aTBD = isTBD(m.a), bTBD = isTBD(m.b);
      const wa = m.winner === 'a', wb = m.winner === 'b';
      const clsA = aTBD ? "tbd" : (wa ? "win" : (wb ? "lose" : ""));
      const clsB = bTBD ? "tbd" : (wb ? "win" : (wa ? "lose" : ""));
      const sa1 = (!aTBD && m.s1A != null) ? m.s1A : "";
      const sa2 = (!aTBD && m.s2A != null) ? m.s2A : "";
      const sa = (!aTBD && m.scoreA != null) ? (m.penA != null ? `${m.scoreA}(${m.penA})` : m.scoreA) : "";
      const sb1 = (!bTBD && m.s1B != null) ? m.s1B : "";
      const sb2 = (!bTBD && m.s2B != null) ? m.s2B : "";
      const sb = (!bTBD && m.scoreB != null) ? (m.penB != null ? `${m.scoreB}(${m.penB})` : m.scoreB) : "";
      const tipAttr = tipOf ? ` title="${tipOf(m)}"` : "";
      const hasTwo = m.s1A != null;   // 双回合模式
      const rowA = hasTwo
        ? `<div class="mrow ${clsA}"${tipAttr}>${teamMark(m.a)}<span class="mn">${teamName(m.a)}</span><span class="ms">${sa1}</span><span class="ms">${sa2}</span></div>`
        : `<div class="mrow ${clsA}"${tipAttr}>${teamMark(m.a)}<span class="mn">${teamName(m.a)}</span><span class="ms">${sa}</span></div>`;
      const rowB = hasTwo
        ? `<div class="mrow ${clsB}"${tipAttr}>${teamMark(m.b)}<span class="mn">${teamName(m.b)}</span><span class="ms">${sb1}</span><span class="ms">${sb2}</span></div>`
        : `<div class="mrow ${clsB}"${tipAttr}>${teamMark(m.b)}<span class="mn">${teamName(m.b)}</span><span class="ms">${sb}</span></div>`;
      return rowA + rowB;
    }

    function renderHalf(list){
      const byRound = {};
      roundOrder.forEach(r => byRound[r] = []);
      list.forEach(m => { if(byRound[m.round]) byRound[m.round].push(m); });
      let html = "";
      roundOrder.forEach((r, idx) => {
        const last = idx === roundOrder.length - 1;
        const cls = "col r" + (idx + 1) + (last ? "" : " has-next");
        html += `<div class="${cls}">`;
        byRound[r].forEach(m => {
          if(isTBD(m.a) || isTBD(m.b)){
            html += `<div class="match disabled">${matchHTML(m)}</div>`;
          }else{
            const attrs = dataAttrs ? dataAttrs(m) : "";
            html += `<button class="match" ${attrs}>${matchHTML(m)}</button>`;
          }
        });
        html += `</div>`;
        if(!last) html += `<div class="gap"></div>`;
      });
      return html;
    }

    return function renderBracket(BRACKET, engine){
      document.getElementById("bracketTop").innerHTML = renderHalf(BRACKET.top);
      document.getElementById("bracketBottom").innerHTML = renderHalf(BRACKET.bottom);
      const all = document.querySelectorAll("button.match");
      all.forEach(el => {
        el.addEventListener("click", () => {
          all.forEach(x => x.classList.remove("active"));
          el.classList.add("active");
          if(onBeforePreview) onBeforePreview();
          const pair = resolveTeams(el);
          engine.previewMatch(pair[0], pair[1]);
        });
      });
    };
  }

  window.BracketRender = { create: create };
})();

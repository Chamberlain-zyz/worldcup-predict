/* ==========================================================================
   bracket.js - 世界杯对阵图逻辑（世界杯页专属）
   依赖：页面内联定义全局 COUNTRIES / BRACKET / NAME_ZH，以及 js/engine.js
   COUNTRIES : [[英文名, ISO代码, emoji], ...]          32 支国家队池
   BRACKET   : { top:[...], bottom:[...] }              淘汰赛对阵（含已赛结果）
   NAME_ZH   : { ISO代码:中文名, ... }                   国旗代码 -> 中文
   ========================================================================== */
(function(){
  "use strict";

  // ---------- 国旗图片缓存（按 ISO 代码缓存 Image，避免重复加载）----------
  const flagImgs = {};
  function getFlagImg(code){
    if(!flagImgs[code]){
      const img = new Image();
      img.crossOrigin = "anonymous";     // 便于 canvas 绘制（flagcdn 支持 CORS）
      img.src = `https://flagcdn.com/${code}.svg`;
      flagImgs[code] = img;
    }
    return flagImgs[code];
  }

  // ---------- 中文名查表 ----------
  function zhName(team){ return NAME_ZH[team[1]] || team[0]; }

  // ---------- 国旗 HTML（记分牌 / 结果卡用）----------
  function flagImgHTML(code, emoji){
    return `<img src="https://flagcdn.com/${code}.svg" alt="${emoji}"
              style="width:42px;height:30px;object-fit:cover;border-radius:4px;
                     box-shadow:0 2px 6px rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.25)"
              onerror="this.replaceWith(document.createTextNode('${emoji}'))">`;
  }
  function smallFlag(code, emoji){
    if(code==="_tbd") return `<span class="mf" style="display:inline-block;text-align:center;font-size:11px;opacity:.7">❓</span>`;
    return `<img class="mf" src="https://flagcdn.com/${code}.svg" alt="${emoji}"
            onerror="this.replaceWith(document.createTextNode('${emoji}'))">`;
  }

  // ---------- TEAM 适配器（国旗版）----------
  const TEAM = {
    all: COUNTRIES,
    name: t => zhName(t),
    titleName: t => `${t[2]} ${zhName(t)}`,     // emoji 国旗 + 中文名（结果卡胜者行）
    badge: (t, size, cls) => flagImgHTML(t[1], t[2]),
    bigBadge: t => flagImgHTML(t[1], t[2]),
    pensMark: t => smallFlag(t[1], t[2]),
    drawOnCanvas: (ctx, ball, R) => {
      const ref = ball.ref;
      const img = getFlagImg(ref[1]);
      if(img.complete && img.naturalWidth>0){
        // 国旗图 cover 进圆内
        const sz = (R-4)*2;
        const s = Math.max(sz/img.naturalWidth, sz/img.naturalHeight);
        const dw = img.naturalWidth*s, dh = img.naturalHeight*s;
        ctx.drawImage(img, -dw/2, -dh/2, dw, dh);
      } else {
        // 还没加载：先画 emoji
        ctx.font = "bold 30px serif";
        ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.fillText(ref[2], 0, 1);
      }
    },
  };

  // ---------- 对阵图渲染 ----------
  const TBD = ["待定","_tbd","❓"];
  const ROUND_ORDER = ["32强赛","16强赛","1/4决赛","半决赛"];

  function matchHTML(m){
    const aTBD = m.a[1]==="_tbd", bTBD = m.b[1]==="_tbd";
    const wa = m.winner==='a', wb = m.winner==='b';
    const clsA = aTBD ? "tbd" : (wa ? "win" : (wb ? "lose" : ""));
    const clsB = bTBD ? "tbd" : (wb ? "win" : (wa ? "lose" : ""));
    const sa = (!aTBD && m.scoreA!=null) ? (m.penA!=null ? `${m.scoreA}(${m.penA})` : m.scoreA) : "";
    const sb = (!bTBD && m.scoreB!=null) ? (m.penB!=null ? `${m.scoreB}(${m.penB})` : m.scoreB) : "";
    return `<div class="mrow ${clsA}">${smallFlag(m.a[1],m.a[2])}<span class="mn">${zhName(m.a)}</span><span class="ms">${sa}</span></div>`
         + `<div class="mrow ${clsB}">${smallFlag(m.b[1],m.b[2])}<span class="mn">${zhName(m.b)}</span><span class="ms">${sb}</span></div>`;
  }

  function renderHalf(list){
    const byRound = {};
    ROUND_ORDER.forEach(r=>byRound[r]=[]);
    list.forEach(m=>{ if(byRound[m.round]) byRound[m.round].push(m); });
    let html = "";
    ROUND_ORDER.forEach((r,idx)=>{
      const last = idx===ROUND_ORDER.length-1;
      const cls = "col r"+(idx+1) + (last?"":" has-next");
      html += `<div class="${cls}">`;
      byRound[r].forEach(m=>{
        const isTBD = m.a[1]==="_tbd" || m.b[1]==="_tbd";
        if(isTBD){
          html += `<div class="match disabled">${matchHTML(m)}</div>`;
        }else{
          html += `<button class="match" data-a="${m.a[0]}|${m.a[1]}|${m.a[2]}"
                           data-b="${m.b[0]}|${m.b[1]}|${m.b[2]}">${matchHTML(m)}</button>`;
        }
      });
      html += `</div>`;
      if(!last) html += `<div class="gap"></div>`;
    });
    return html;
  }

  function renderBracket(){
    document.getElementById("bracketTop").innerHTML = renderHalf(BRACKET.top);
    document.getElementById("bracketBottom").innerHTML = renderHalf(BRACKET.bottom);
    const all = document.querySelectorAll(".match[data-a]");
    all.forEach(el=>{
      el.addEventListener("click", ()=>{
        all.forEach(x=>x.classList.remove("active"));
        el.classList.add("active");
        const pa = el.dataset.a.split("|"), pb = el.dataset.b.split("|");
        engine.previewMatch(pa, pb);
      });
    });
  }

  // ---------- 初始化引擎（世界杯：无积分榜选队，故无清选队回调 / 无取消预览）----------
  const engine = initEngine(TEAM, {});

  renderBracket();
})();

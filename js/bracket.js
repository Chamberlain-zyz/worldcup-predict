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

  // ---------- 初始化引擎（世界杯：无积分榜选队，故无清选队回调 / 无取消预览）----------
  const engine = initEngine(TEAM, {});
  engine.previewMatch(ENG, FRA);   // 默认加载季军赛：英格兰 vs 法国

  // ---------- 对阵图渲染（复用 js/bracket-render.js 公共模块）----------
  // 队伍标识为数组 [英文名, ISO代码, emoji]，占位队 ISO 代码为 "_tbd"。
  const renderBracket = BracketRender.create({
    roundOrder: ["32强赛","16强赛","1/4决赛","半决赛"],
    isTBD: t => t[1] === "_tbd",
    teamName: t => zhName(t),
    teamMark: t => smallFlag(t[1], t[2]),
    // 把 [name,code,emoji] 编入 data 属性，点击时按 "|" 还原
    dataAttrs: m => `data-a="${m.a[0]}|${m.a[1]}|${m.a[2]}" data-b="${m.b[0]}|${m.b[1]}|${m.b[2]}"`,
    resolveTeams: el => [el.dataset.a.split("|"), el.dataset.b.split("|")],
  });

  renderBracket(BRACKET, engine);
})();

/* ==========================================================================
   badge.js - 队徽工具（队徽版页面共用：联赛积分榜页 + 欧冠页）
   由 standings.js / ucl.js 共同依赖，须在它们之前引入。
   世界杯页用国旗（bracket.js），不依赖本文件。

   优先使用队徽图片（PNG，透明背景），图片缺失或未加载完时回退到「主色块 + 缩写字母」。
   暴露到 window.Badge：
     isLight(hex)                     颜色亮度判定（决定字色黑/白）
     badgeDomHTML(team, size, cls)    DOM 版小徽章（记分牌 / 积分榜 / 结果卡 / 点球条 / 对阵行）
     drawBadgeToCanvas(ctx, team, s)  canvas 版球身（engine 已裁剪到圆内）
     bindLogos(CLUBS, logoBase)       按球队 code 给每个 CLUBS 项挂 .logo 图片 URL
     makeBadgeTeamAdapter(CLUBS, rating, logoBase)  生成 engine.js 需要的 TEAM 适配器
                                            rating(t) 可选：返回球队实力评分（不存在则引擎退回 50/50）
                                            logoBase 可选：队徽图片目录，形如 "../img/badges/england"
   ========================================================================== */
(function(){
  "use strict";

  // ---------- 图片缓存（DOM 与 canvas 共用，同 URL 命中浏览器缓存）----------
  // drawBadgeToCanvas 每帧调用，不能每次 new Image；按 URL 缓存 Image 对象，
  // 未加载完时先回退字母，加载完后续帧自动切换为图片。
  const _imgCache = new Map();
  function badgeImg(url){
    let im = _imgCache.get(url);
    if(!im){
      im = new Image();
      im.src = url;
      _imgCache.set(url, im);
    }
    return im;
  }

  // 按球队 code 给每个 CLUBS 项挂 .logo（logoBase 形如 "../img/badges/england"）
  // 挂上后 badgeDomHTML / drawBadgeToCanvas 即可读取 team.logo 画图片。
  // 注意：Windows 上 "aux" 是保留 DOS 设备名，git 无法索引 aux.png，
  //       故用 FILENAME_OVERRIDE 映射到备用文件名 auxe.png。
  const FILENAME_OVERRIDE = { aux:"auxe" };
  function bindLogos(CLUBS, logoBase){
    if(!logoBase) return;
    Object.keys(CLUBS).forEach(code => {
      const fname = FILENAME_OVERRIDE[code] || code;
      CLUBS[code].logo = logoBase + "/" + fname + ".png";
    });
  }

  // 颜色亮度判定：亮底用深色字，暗底用白字
  function isLight(hex){
    const c = hex.replace("#","");
    const r=parseInt(c.length===3?c[0]+c[0]:c.slice(0,2),16);
    const g=parseInt(c.length===3?c[1]+c[1]:c.slice(2,4),16);
    const b=parseInt(c.length===3?c[2]+c[2]:c.slice(4,6),16);
    return (0.299*r+0.587*g+0.114*b) > 180;
  }

  // canvas 版球身：主色铺底 + 队徽图片 cover 铺满球体内部；无图或未加载完回退缩写字母
  // 调用前 engine.js 已把绘制区裁剪到球体圆内（clip 半径 BALL_R-4），这里直接画满即可
  function drawBadgeToCanvas(ctx, team, size){
    const s = size*2;
    // 主色底（队徽透明区露出主色，保持球身识别）
    ctx.fillStyle = team.c1;
    ctx.fillRect(-s, -s, s*2, s*2);

    const img = team.logo ? badgeImg(team.logo) : null;
    if(img && img.complete && img.naturalWidth > 0){
      // cover：按长边缩放铺满圆形区域，超出部分被 engine 的圆 clip 裁掉。
      // 目标边略大于裁剪圆直径（裁剪圆半径=size+2），让队徽彻底充满球体内部。
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const target = (size + 2) * 2;
      const scale = Math.max(target / iw, target / ih);
      const dw = iw * scale, dh = ih * scale;
      ctx.drawImage(img, -dw/2, -dh/2, dw, dh);
      return;
    }

    // 回退：缩写字母（图片未挂 / 未加载完）
    const light = isLight(team.c1);
    ctx.fillStyle = light ? team.c2 : "#ffffff";
    ctx.strokeStyle = light ? "rgba(0,0,0,.5)" : "rgba(0,0,0,.6)";
    ctx.lineWidth = 1.5;
    ctx.font = "900 " + Math.round(size*0.62) + "px 'Segoe UI',system-ui,sans-serif";
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.strokeText(team.abbr, 0, 1);
    ctx.fillText(team.abbr, 0, 1);
  }

  // DOM 版队徽：优先图片（透明 PNG，object-fit:contain）；无图回退主色块 + 缩写字母
  // size=0 时宽高交给 CSS（.badge / .mbadge / .fbadge / .pf / .badge-dom 等类已定）；
  // size>0 时用正方形 inline 宽高（队徽 contain 进正方形最自然）。
  function badgeDomHTML(team, size, cls){
    const clsName = cls || "badge";
    if(team.logo){
      const style = size ? `width:${size}px;height:${size}px` : "";
      const styleAttr = style ? ` style="${style}"` : "";
      return `<img class="${clsName} badge-img" src="${team.logo}" alt="${team.abbr}"${styleAttr}>`;
    }
    const light = isLight(team.c1);
    const fg = light ? team.c2 : "#ffffff";
    const style = `background:${team.c1};color:${fg};` +
                  (size ? `width:${size}px;height:${size*0.72}px;font-size:${Math.max(9,Math.round(size*0.28))}px;` : "");
    return `<span class="${clsName}" style="${style}">${team.abbr}</span>`;
  }

  // engine.js 需要的 TEAM 适配器（队徽版）
  // rating：可选的实力评分回调 t->number；未提供则返回的适配器不含 rating，引擎自动退回 50/50。
  // logoBase：可选，队徽图片目录；提供则给每个 CLUBS 项挂 .logo。
  function makeBadgeTeamAdapter(CLUBS, rating, logoBase){
    bindLogos(CLUBS, logoBase);
    const adapter = {
      all: Object.values(CLUBS),
      name: t => t.zh,
      titleName: t => t.zh,
      badge: (t, size, cls) => badgeDomHTML(t, size, cls),
      bigBadge: t => badgeDomHTML(t, 48, "fbadge"),
      pensMark: t => badgeDomHTML(t, 0, "pf"),
      drawOnCanvas: (ctx, ball, R) => drawBadgeToCanvas(ctx, ball.ref, R-6),
    };
    if(typeof rating === "function") adapter.rating = rating;
    return adapter;
  }

  window.Badge = { isLight, drawBadgeToCanvas, badgeDomHTML, bindLogos, makeBadgeTeamAdapter };
})();

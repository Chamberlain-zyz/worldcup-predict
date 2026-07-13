/* ==========================================================================
   badge.js - 队徽工具（队徽版页面共用：联赛积分榜页 + 欧冠页）
   由 standings.js / ucl.js 共同依赖，须在它们之前引入。
   世界杯页用国旗（bracket.js），不依赖本文件。

   暴露到 window.Badge：
     isLight(hex)                     颜色亮度判定（决定字色黑/白）
     badgeDomHTML(team, size, cls)    DOM 版小徽章（记分牌 / 积分榜 / 结果卡 / 点球条 / 对阵行）
     drawBadgeToCanvas(ctx, team, s)  canvas 版球身（engine 已裁剪到圆内）
     makeBadgeTeamAdapter(CLUBS)      生成 engine.js 需要的 TEAM 适配器
   ========================================================================== */
(function(){
  "use strict";

  // 颜色亮度判定：亮底用深色字，暗底用白字
  function isLight(hex){
    const c = hex.replace("#","");
    const r=parseInt(c.length===3?c[0]+c[0]:c.slice(0,2),16);
    const g=parseInt(c.length===3?c[1]+c[1]:c.slice(2,4),16);
    const b=parseInt(c.length===3?c[2]+c[2]:c.slice(4,6),16);
    return (0.299*r+0.587*g+0.114*b) > 180;
  }

  // canvas 版球身：整颗球用队伍主色铺底 + 缩写字母（不要条纹）
  // 调用前 engine.js 已把绘制区裁剪到球体圆内，直接一个大矩形铺满即可
  function drawBadgeToCanvas(ctx, team, size){
    const s = size*2;
    ctx.fillStyle = team.c1;
    ctx.fillRect(-s, -s, s*2, s*2);
    const light = isLight(team.c1);
    ctx.fillStyle = light ? team.c2 : "#ffffff";
    ctx.strokeStyle = light ? "rgba(0,0,0,.5)" : "rgba(0,0,0,.6)";
    ctx.lineWidth = 1.5;
    ctx.font = "900 " + Math.round(size*0.62) + "px 'Segoe UI',system-ui,sans-serif";
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.strokeText(team.abbr, 0, 1);
    ctx.fillText(team.abbr, 0, 1);
  }

  // DOM 版队徽：积分榜 / 记分牌 / 结果卡 / 点球条 / 对阵行 用的小徽章
  function badgeDomHTML(team, size, cls){
    const light = isLight(team.c1);
    const fg = light ? team.c2 : "#ffffff";
    const style = `background:${team.c1};color:${fg};` +
                  (size ? `width:${size}px;height:${size*0.72}px;font-size:${Math.max(9,Math.round(size*0.28))}px;` : "");
    return `<span class="${cls||"badge"}" style="${style}">${team.abbr}</span>`;
  }

  // engine.js 需要的 TEAM 适配器（队徽版）
  function makeBadgeTeamAdapter(CLUBS){
    return {
      all: Object.values(CLUBS),
      name: t => t.zh,
      titleName: t => t.zh,
      badge: (t, size, cls) => badgeDomHTML(t, size, cls),
      bigBadge: t => badgeDomHTML(t, 48, "fbadge"),
      pensMark: t => badgeDomHTML(t, 0, "pf"),
      drawOnCanvas: (ctx, ball, R) => drawBadgeToCanvas(ctx, ball.ref, R-6),
    };
  }

  window.Badge = { isLight, drawBadgeToCanvas, badgeDomHTML, makeBadgeTeamAdapter };
})();

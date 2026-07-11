/* ==========================================================================
   standings.js - 积分榜逻辑（联赛页专属）
   依赖：页面内联定义全局 CLUBS / SEASONS / ZONE，以及 js/engine.js
   CLUBS   : { code:{short,zh,c1,c2,abbr}, ... }   球队元数据
   SEASONS : [ {label, clubs:[{code,pld,w,d,l,gf,ga,pts}, ...]}, ... ]  最近 5 赛季
   ZONE    : { ucl:<前N名欧冠区>, uel:<再M名欧联区> }   降级固定最后 3 名
   ========================================================================== */
(function(){
  "use strict";

  // ---------- 队徽工具：颜色亮度判定 ----------
  function isLight(hex){
    const c = hex.replace("#","");
    const r=parseInt(c.length===3?c[0]+c[0]:c.slice(0,2),16);
    const g=parseInt(c.length===3?c[1]+c[1]:c.slice(2,4),16);
    const b=parseInt(c.length===3?c[2]+c[2]:c.slice(4,6),16);
    return (0.299*r+0.587*g+0.114*b) > 180;
  }
  function roundRect(c,x,y,w,h,r){
    c.beginPath();
    c.moveTo(x+r,y);
    c.arcTo(x+w,y,x+w,y+h,r);
    c.arcTo(x+w,y+h,x,y+h,r);
    c.arcTo(x,y+h,x,y,r);
    c.arcTo(x,y,x+w,y,r);
    c.closePath();
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

  // DOM 版队徽：积分榜 / 记分牌 / 结果卡 / 点球条 用的小徽章
  function badgeDomHTML(team, size, cls){
    const light = isLight(team.c1);
    const fg = light ? team.c2 : "#ffffff";
    const style = `background:${team.c1};color:${fg};` +
                  (size ? `width:${size}px;height:${size*0.72}px;font-size:${Math.max(9,Math.round(size*0.28))}px;` : "");
    return `<span class="${cls||"badge"}" style="${style}">${team.abbr}</span>`;
  }

  // ---------- TEAM 适配器（队徽版）----------
  const TEAM = {
    all: Object.values(CLUBS),
    name: t => t.zh,
    titleName: t => t.zh,
    badge: (t, size, cls) => badgeDomHTML(t, size, cls),
    bigBadge: t => badgeDomHTML(t, 48, "fbadge"),
    pensMark: t => badgeDomHTML(t, 0, "pf"),
    drawOnCanvas: (ctx, ball, R) => drawBadgeToCanvas(ctx, ball.ref, R-6),
  };

  // ---------- 积分榜分区 ----------
  function zoneOf(idx, total){
    if(idx < ZONE.ucl) return "zone-ucl";
    if(idx < ZONE.uel) return "zone-uel";
    if(idx >= total - 3) return "zone-relegate";
    return "";
  }

  // ---------- 选队状态 ----------
  let currentSeasonIdx = 0;   // 默认最近一季
  let selHome = null;
  let selAway = null;

  const elStandBody = document.getElementById("standBody");
  const elSeasonSel = document.getElementById("seasonSel");
  const elSeasonSub = document.getElementById("seasonSub");

  // ---------- 积分榜渲染 ----------
  function renderStanding(){
    const season = SEASONS[currentSeasonIdx];
    const clubs = season.clubs;
    const rows = clubs.map((row,i)=>{
      const t = CLUBS[row.code];
      const zone = zoneOf(i, clubs.length);
      const gd = row.gf - row.ga;
      return `<tr class="${zone}" data-code="${row.code}">
        <td class="pos">${i+1}</td>
        <td class="tm">${badgeDomHTML(t,0,"badge")}${t.zh}</td>
        <td>${row.pld}</td>
        <td>${row.w}</td>
        <td>${row.d}</td>
        <td>${row.l}</td>
        <td>${gd>0?"+":""}${gd}</td>
        <td class="pts">${row.pts}</td>
      </tr>`;
    }).join("");
    elStandBody.innerHTML = rows;
    elStandBody.querySelectorAll("tr").forEach(tr=>{
      tr.addEventListener("click", ()=>onSelectRow(tr));
    });
    elSeasonSub.textContent = `${season.label} 赛季 · 点第一行=主队 第二行=客队 再点取消`;
  }

  // 选队交互：先点=主队；再点=客队并自动预览；同一行再点=取消该角色
  function onSelectRow(tr){
    const code = tr.dataset.code;
    if(selHome === code){
      selHome = null;
      selAway = null;
      refreshSelectionUI();
      engine.clearPreview();
      return;
    }
    if(selAway === code){
      selAway = null;
      refreshSelectionUI();
      engine.clearPreview();
      return;
    }
    if(!selHome){
      selHome = code;
      refreshSelectionUI();
      return;
    }
    selAway = code;
    refreshSelectionUI();
    const tA = CLUBS[selHome], tB = CLUBS[selAway];
    engine.previewMatch(tA, tB);
  }

  function refreshSelectionUI(){
    elStandBody.querySelectorAll("tr").forEach(r=>{
      r.classList.remove("home","away");
      if(r.dataset.code === selHome) r.classList.add("home");
      else if(r.dataset.code === selAway) r.classList.add("away");
    });
  }

  function clearSelection(){
    selHome = null; selAway = null;
    refreshSelectionUI();
  }

  // ---------- 赛季下拉框 ----------
  SEASONS.forEach((s,i)=>{
    const opt=document.createElement("option");
    opt.value=i; opt.textContent=s.label;
    elSeasonSel.appendChild(opt);
  });
  elSeasonSel.addEventListener("change", ()=>{
    currentSeasonIdx = parseInt(elSeasonSel.value, 10) || 0;
    selHome = null; selAway = null;
    renderStanding();               // 重建积分榜（新 DOM，高亮自然清空）
    if(!engine.isOverlayHidden()){
      engine.clearPreview();        // 未在比赛中：重置遮罩为初始提示
    }
  });

  // ---------- 初始化引擎 + 积分榜 ----------
  const resetOverlay = {
    title: document.querySelector("h1").textContent,
    body: `点击左侧积分榜任意两支球队<br>依次为主队 / 客队<br>或按 <b>空格键</b> 随机抽两队对战`,
    btn: "随机开球"
  };

  const engine = initEngine(TEAM, {
    onClearSelection: clearSelection,
    resetOverlay: resetOverlay,
    allowExtra: false,   // 联赛：90 分钟平局就是平局（各 1 分）
    allowPens: false     // 联赛不打点球
  });

  renderStanding();
})();

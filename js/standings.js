/* ==========================================================================
   standings.js - 积分榜逻辑（联赛页专属）
   依赖：js/badge.js（队徽工具）、js/engine.js，以及页面内联定义的全局 CLUBS / SEASONS / ZONE
   CLUBS   : { code:{short,zh,c1,c2,abbr}, ... }   球队元数据
   SEASONS : [ {label, clubs:[{code,pld,w,d,l,gf,ga,pts}, ...]}, ... ]  最近 5 赛季
   ZONE    : { ucl:<前N名欧冠区>, uel:<再M名欧联区> }   降级固定最后 3 名
   ========================================================================== */
(function(){
  "use strict";

  // ---------- 队徽工具（来自 js/badge.js）----------
  const badgeDomHTML = Badge.badgeDomHTML;

  // ---------- 球队实力评分（转向偏置用）----------
  // 用当前所选赛季的积分 pts + 净胜球(gf-ga)*0.1 微调；按球队对象建反查表。
  // 赛季切换时由 rebuildRatings() 重建。若所选赛季为空（新赛季全 0，尚未开赛），
  // 回退到最近一个有数据的赛季，保证实力差异默认可见。
  // rating 回调查不到时返回 NaN -> 引擎同样退回 50/50。
  let ratingMap = new Map();
  function ratingOf(t){ const v = ratingMap.get(t); return v === undefined ? NaN : v; }
  function rebuildRatings(){
    ratingMap = new Map();
    let season = SEASONS[currentSeasonIdx];
    const hasData = season.clubs.some(r => r.pld > 0);
    if(!hasData){
      for(let i=0;i<SEASONS.length;i++){
        if(SEASONS[i].clubs.some(r => r.pld > 0)){ season = SEASONS[i]; break; }
      }
    }
    for(const row of season.clubs){
      const t = CLUBS[row.code];
      if(t) ratingMap.set(t, row.pts + (row.gf - row.ga) * 0.1);
    }
  }

  const TEAM = Badge.makeBadgeTeamAdapter(CLUBS, ratingOf, window.BADGE_BASE);

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
    rebuildRatings();               // 实力评分随赛季切换更新
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
  rebuildRatings();   // 首屏按默认赛季建立实力评分
})();

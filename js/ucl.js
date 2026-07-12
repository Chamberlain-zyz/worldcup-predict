/* ==========================================================================
   ucl.js - 欧冠页逻辑（cups/ucl.html 专属）
   依赖：页面内联定义全局 CLUBS / BRACKET / LEAGUE，以及 js/engine.js
   CLUBS   : { code:{short,zh,c1,c2,abbr}, ... }          36 队元数据
   BRACKET : { top:[...], bottom:[...] }                  淘汰赛对阵（scoreA/B=两回合总比分）
   LEAGUE  : [ {code,pld,w,d,l,gf,ga,pts,zone}, ... ]     联赛阶段 36 队排名
             zone: "r16"(前8直通) | "po"(9-24附加赛) | "out"(25-36出局)
   结构参照世界杯页：上 = 球场游戏；中 = 对阵图(16强->1/4->半决赛)+冠军柱；下 = 联赛阶段榜
   ========================================================================== */
(function(){
  "use strict";

  // ---------- 队徽工具：颜色亮度判定（同 standings.js）----------
  function isLight(hex){
    const c = hex.replace("#","");
    const r=parseInt(c.length===3?c[0]+c[0]:c.slice(0,2),16);
    const g=parseInt(c.length===3?c[1]+c[1]:c.slice(2,4),16);
    const b=parseInt(c.length===3?c[2]+c[2]:c.slice(4,6),16);
    return (0.299*r+0.587*g+0.114*b) > 180;
  }
  // canvas 版球身：整颗球用队伍主色铺底 + 缩写字母（engine 已裁剪到圆内）
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
  // DOM 版队徽：记分牌 / 积分榜 / 结果卡 / 点球条 / 对阵行 共用
  function badgeDomHTML(team, size, cls){
    const light = isLight(team.c1);
    const fg = light ? team.c2 : "#ffffff";
    const style = `background:${team.c1};color:${fg};` +
                  (size ? `width:${size}px;height:${size*0.72}px;font-size:${Math.max(9,Math.round(size*0.28))}px;` : "");
    return `<span class="${cls||"badge"}" style="${style}">${team.abbr}</span>`;
  }

  // ---------- TEAM 适配器（队徽版，供 engine.js 用）----------
  const TEAM = {
    all: Object.values(CLUBS),
    name: t => t.zh,
    titleName: t => t.zh,
    badge: (t, size, cls) => badgeDomHTML(t, size, cls),
    bigBadge: t => badgeDomHTML(t, 48, "fbadge"),
    pensMark: t => badgeDomHTML(t, 0, "pf"),
    drawOnCanvas: (ctx, ball, R) => drawBadgeToCanvas(ctx, ball.ref, R-6),
  };

  // ---------- 球队对象 -> code 反查表（CLUBS 项不含自身 code，需反查）----------
  const CODE_OF = new Map();
  Object.keys(CLUBS).forEach(k => CODE_OF.set(CLUBS[k], k));
  function codeOf(t){ return CODE_OF.get(t) || ""; }

  // ---------- 待定占位队 ----------
  const TBD = {short:"TBD", zh:"待定", c1:"#3a3a3a", c2:"#ffffff", abbr:"?"};
  function zhName(t){ return t.zh; }
  function isTBD(t){ return t === TBD; }

  // ==================== 对阵图 ====================
  const ROUND_ORDER = ["16强赛","1/4决赛","半决赛"];

  // 单场对阵 HTML：两行，各带队徽 + 名 + 总比分（含点球则括注）
  function matchHTML(m){
    const aT = m.a, bT = m.b;
    const aTBD = isTBD(aT), bTBD = isTBD(bT);
    const wa = m.winner==='a', wb = m.winner==='b';
    const clsA = aTBD ? "tbd" : (wa ? "win" : (wb ? "lose" : ""));
    const clsB = bTBD ? "tbd" : (wb ? "win" : (wa ? "lose" : ""));
    const sa = (!aTBD && m.scoreA!=null) ? (m.penA!=null ? `${m.scoreA}(${m.penA})` : m.scoreA) : "";
    const sb = (!bTBD && m.scoreB!=null) ? (m.penB!=null ? `${m.scoreB}(${m.penB})` : m.scoreB) : "";
    const tip = m.legs ? m.legs.replace(/"/g,'&quot;') : "";
    const rowA = `<div class="mrow ${clsA}" title="${tip}">${aTBD?'':badgeDomHTML(aT,0,"mbadge")}<span class="mn">${zhName(aT)}</span><span class="ms">${sa}</span></div>`;
    const rowB = `<div class="mrow ${clsB}" title="${tip}">${bTBD?'':badgeDomHTML(bT,0,"mbadge")}<span class="mn">${zhName(bT)}</span><span class="ms">${sb}</span></div>`;
    return rowA + rowB;
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
        const isTBDMatch = isTBD(m.a) || isTBD(m.b);
        if(isTBDMatch){
          html += `<div class="match disabled">${matchHTML(m)}</div>`;
        }else{
          html += `<button class="match" data-ac="${codeOf(m.a)}" data-bc="${codeOf(m.b)}">${matchHTML(m)}</button>`;
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
    const all = document.querySelectorAll(".match[data-ac]");
    all.forEach(el=>{
      el.addEventListener("click", ()=>{
        all.forEach(x=>x.classList.remove("active"));
        el.classList.add("active");
        clearTableSelection();           // 点对阵图 = 清掉积分榜选队
        const tA = CLUBS[el.dataset.ac], tB = CLUBS[el.dataset.bc];
        engine.previewMatch(tA, tB);
      });
    });
  }

  // ---------- 冠军柱（决赛已赛：显示冠军队徽 + 决赛比分）----------
  function renderChampion(){
    const champEl = document.getElementById("trophyChamp");
    const scoreEl = document.getElementById("trophyScore");
    if(champEl && typeof CHAMP !== "undefined"){
      champEl.innerHTML = badgeDomHTML(CHAMP, 0, "fbadge") +
        `<span class="trophy-champ-name">${CHAMP.zh}</span>`;
    }
    if(scoreEl && typeof FINAL !== "undefined"){
      const f = FINAL;
      const pens = (f.penA!=null && f.penB!=null) ? `（点球 ${f.penA}-${f.penB}）` : "";
      scoreEl.textContent = `决赛 ${f.scoreA}-${f.scoreB} ${pens}`;
    }
  }

  // ==================== 联赛阶段积分榜 ====================
  function gdStr(gd){ return gd>0 ? "+"+gd : ""+gd; }
  function zoneClass(zone){
    return zone==="r16" ? "adv-auto" : (zone==="po" ? "adv-third" : "adv-out");
  }

  // 渲染一段排名（start..end）为一张表
  function leagueTableHTML(rows, start){
    const head = `<thead><tr>
      <th style="width:22px">#</th>
      <th class="left">球队</th>
      <th title="赛">赛</th>
      <th title="胜">胜</th>
      <th title="平">平</th>
      <th title="负">负</th>
      <th title="进球 / 失球">进/失</th>
      <th title="净胜球">净</th>
      <th title="积分">积</th>
    </tr></thead>`;
    const body = rows.map((r,i)=>{
      const t = CLUBS[r.code];
      const rk = start + i;
      const cls = zoneClass(r.zone);
      const gd = r.gf - r.ga;
      return `<tr class="${cls}" data-code="${r.code}">
        <td class="grk">${rk}</td>
        <td class="gtm">${badgeDomHTML(t,0,"mbadge")}<span class="gname">${t.zh}</span></td>
        <td>${r.pld}</td>
        <td>${r.w}</td>
        <td>${r.d}</td>
        <td>${r.l}</td>
        <td class="ggf">${r.gf}/${r.ga}</td>
        <td class="ggd">${gdStr(gd)}</td>
        <td class="gpts">${r.pts}</td>
      </tr>`;
    }).join("");
    return `<table class="gtable">${head}<tbody>${body}</tbody></table>`;
  }

  function renderLeague(){
    const half = Math.ceil(LEAGUE.length/2);
    const left = LEAGUE.slice(0, half);
    const right = LEAGUE.slice(half);
    document.getElementById("leagueA").innerHTML = leagueTableHTML(left, 1);
    document.getElementById("leagueB").innerHTML = leagueTableHTML(right, half+1);
    document.querySelectorAll(".league-table tbody tr").forEach(tr=>{
      tr.addEventListener("click", ()=>onSelectRow(tr));
    });
  }

  // ---------- 选队交互（复用联赛页两段式：先主队 后客队 再点取消）----------
  let selHome = null, selAway = null;
  function onSelectRow(tr){
    const code = tr.dataset.code;
    if(selHome === code){ selHome=null; selAway=null; refreshTableUI(); engine.clearPreview(); return; }
    if(selAway === code){ selAway=null; refreshTableUI(); engine.clearPreview(); return; }
    if(!selHome){ selHome=code; refreshTableUI(); return; }
    selAway = code;
    refreshTableUI();
    clearBracketActive();
    engine.previewMatch(CLUBS[selHome], CLUBS[selAway]);
  }
  function refreshTableUI(){
    document.querySelectorAll(".league-table tbody tr").forEach(r=>{
      r.classList.remove("lhome","laway");
      if(r.dataset.code === selHome) r.classList.add("lhome");
      else if(r.dataset.code === selAway) r.classList.add("laway");
    });
  }
  function clearTableSelection(){
    selHome=null; selAway=null; refreshTableUI();
  }
  function clearBracketActive(){
    document.querySelectorAll(".match.active").forEach(x=>x.classList.remove("active"));
  }
  function clearAll(){
    clearTableSelection();
    clearBracketActive();
  }

  // ---------- 初始化引擎（欧冠：淘汰赛，平局可加时 + 点球）----------
  const resetOverlay = {
    title: document.querySelector("h1").textContent,
    body: `点击下方对阵图任一场比赛即可开战<br>或点下方联赛阶段榜任意两支球队自定义对阵<br>或按 <b>空格键</b> 随机抽两队对战`,
    btn: "随机开球"
  };
  const engine = initEngine(TEAM, {
    onClearSelection: clearAll,
    resetOverlay: resetOverlay,
    allowExtra: true,    // 淘汰赛：90 平局进加时
    allowPens: true      // 加时仍平进点球
  });

  renderBracket();
  renderChampion();
  renderLeague();
})();

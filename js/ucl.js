/* ==========================================================================
   ucl.js - 欧冠页逻辑（cups/ucl.html 专属）
   依赖：js/badge.js（队徽工具）、js/engine.js，以及页面内联定义的全局 CLUBS / BRACKET / LEAGUE
   CLUBS   : { code:{short,zh,c1,c2,abbr}, ... }          36 队元数据
   BRACKET : { top:[...], bottom:[...] }                  淘汰赛对阵（scoreA/B=两回合总比分）
   LEAGUE  : [ {code,pld,w,d,l,gf,ga,pts,zone}, ... ]     联赛阶段 36 队排名
             zone: "r16"(前8直通) | "po"(9-24附加赛) | "out"(25-36出局)
   结构参照世界杯页：上 = 球场游戏；中 = 对阵图(16强->1/4->半决赛)+冠军柱；下 = 联赛阶段榜
   ========================================================================== */
(function(){
  "use strict";

  // ---------- 队徽工具（来自 js/badge.js）----------
  const badgeDomHTML = Badge.badgeDomHTML;
  const TEAM = Badge.makeBadgeTeamAdapter(CLUBS);

  // ---------- 球队对象 -> code 反查表（CLUBS 项不含自身 code，需反查）----------
  const CODE_OF = new Map();
  Object.keys(CLUBS).forEach(k => CODE_OF.set(CLUBS[k], k));
  function codeOf(t){ return CODE_OF.get(t) || ""; }

  // ---------- 待定占位队 ----------
  const TBD = {short:"TBD", zh:"待定", c1:"#3a3a3a", c2:"#ffffff", abbr:"?"};
  function zhName(t){ return t.zh; }
  function isTBD(t){ return t === TBD; }

  // ==================== 对阵图（复用 js/bracket-render.js 公共模块）====================
  // 队伍为 CLUBS[code] 对象，占位队为 TBD；队标用队徽，多一层 legs tooltip。
  // renderBracket 在下方 clearTableSelection 定义后创建（见 buildBracket）。
  let renderBracket = null;
  function buildBracket(){
    renderBracket = BracketRender.create({
      roundOrder: ["16强赛","1/4决赛","半决赛"],
      isTBD: t => isTBD(t),
      teamName: t => zhName(t),
      // TBD 不渲染队徽，其余渲染队徽
      teamMark: t => isTBD(t) ? "" : badgeDomHTML(t, 0, "mbadge"),
      tipOf: m => m.legs ? m.legs.replace(/"/g, '&quot;') : "",
      dataAttrs: m => `data-ac="${codeOf(m.a)}" data-bc="${codeOf(m.b)}"`,
      resolveTeams: el => [CLUBS[el.dataset.ac], CLUBS[el.dataset.bc]],
      onBeforePreview: () => clearTableSelection(),   // 点对阵图 = 清掉积分榜选队
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

  buildBracket();
  renderBracket(BRACKET, engine);
  renderChampion();
  renderLeague();
})();

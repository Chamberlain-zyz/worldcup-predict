/* ==========================================================================
   league-nav.js - 五大联赛左侧导航栏（联赛页共用）
   自动向 .layout 最前面插入一个联赛切换菜单栏，高亮当前页
   ========================================================================== */
(function(){
  "use strict";
  const LEAGUES = [
    {file:"england.html", name:"英超",   sub:"Premier League", flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", c1:"#3d195b"},
    {file:"spain.html",   name:"西甲",   sub:"LaLiga",         flag:"🇪🇸",       c1:"#ff6a13"},
    {file:"italy.html",   name:"意甲",   sub:"Serie A",        flag:"🇮🇹",       c1:"#008fd7"},
    {file:"germany.html", name:"德甲",   sub:"Bundesliga",     flag:"🇩🇪",       c1:"#d20515"},
    {file:"france.html",  name:"法甲",   sub:"Ligue 1",        flag:"🇫🇷",       c1:"#091c3e"}
  ];
  const EXTRA = {file:"worldcup.html", name:"世界杯", sub:"World Cup", flag:"🌍", c1:"#0b5d2e"};

  // 识别当前页（url 末尾的 html 文件名）
  const cur = (location.pathname.split("/").pop() || "").toLowerCase() || "index.html";

  const items = LEAGUES.map(L=>{
    const active = L.file === cur;
    return `<a class="lg-item ${active?'active':''}" href="${L.file}" style="--lg-c:${L.c1}">
      <span class="lg-flag">${L.flag}</span>
      <span class="lg-txt">
        <span class="lg-name">${L.name}</span>
        <span class="lg-sub">${L.sub}</span>
      </span>
    </a>`;
  }).join("");
  const extra = `<a class="lg-item lg-extra ${EXTRA.file===cur?'active':''}" href="${EXTRA.file}" style="--lg-c:${EXTRA.c1}">
      <span class="lg-flag">${EXTRA.flag}</span>
      <span class="lg-txt">
        <span class="lg-name">${EXTRA.name}</span>
        <span class="lg-sub">${EXTRA.sub}</span>
      </span>
    </a>`;

  const html =
    `<aside class="league-nav">
       <div class="lg-head">🏆 联赛</div>
       ${items}
       <div class="lg-sep"></div>
       ${extra}
     </aside>`;

  function inject(){
    const layout = document.querySelector(".layout");
    if(!layout) return;
    layout.insertAdjacentHTML("afterbegin", html);
  }
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
})();

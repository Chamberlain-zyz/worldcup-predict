/* ==========================================================================
   league-nav.js - 五大联赛 + 杯赛左侧导航栏（联赛/杯赛页共用）
   自动向 .layout 最前面插入一个导航菜单栏，高亮当前页
   页面按目录组织：leagues/xxx.html（联赛）  cups/xxx.html（杯赛）
   本脚本挂载于 js/，被其他页通过 ../js/league-nav.js 加载 => 从任一子目录页
   跳到另一子目录页，用 ../leagues/xxx.html / ../cups/xxx.html 即可
   ========================================================================== */
(function(){
  "use strict";
  const LEAGUES = [
    {file:"../leagues/england.html", name:"英超",   sub:"Premier League", flag:"eng", c1:"#3d195b"},
    {file:"../leagues/spain.html",   name:"西甲",   sub:"LaLiga",         flag:"esp", c1:"#ff6a13"},
    {file:"../leagues/italy.html",   name:"意甲",   sub:"Serie A",        flag:"ita", c1:"#008fd7"},
    {file:"../leagues/germany.html", name:"德甲",   sub:"Bundesliga",     flag:"ger", c1:"#d20515"},
    {file:"../leagues/france.html",  name:"法甲",   sub:"Ligue 1",        flag:"fra", c1:"#091c3e"}
  ];
  const CUPS = [
    {file:"../cups/worldcup.html", name:"世界杯", sub:"World Cup", flag:"world", c1:"#0b5d2e"}
  ];

  // 识别当前页：取 pathname 末尾两段 "<dir>/<file>"（如 "leagues/england.html"）用来匹配
  function currentKey(){
    const parts = location.pathname.split("/").filter(Boolean);
    if(parts.length >= 2) return (parts[parts.length-2] + "/" + parts[parts.length-1]).toLowerCase();
    return (parts[parts.length-1] || "").toLowerCase();
  }
  const cur = currentKey();
  function isActive(file){
    // file 形如 "../leagues/england.html"，取末两段和 cur 比
    const parts = file.split("/");
    const key = (parts.slice(-2).join("/")).toLowerCase();
    return key === cur;
  }

  function itemHTML(L, extra){
    return `<a class="lg-item ${extra?'lg-extra ':''}${isActive(L.file)?'active':''}" href="${L.file}" style="--lg-c:${L.c1}">
      <span class="lg-flag lg-flag-${L.flag}"></span>
      <span class="lg-txt">
        <span class="lg-name">${L.name}</span>
        <span class="lg-sub">${L.sub}</span>
      </span>
    </a>`;
  }
  const leaguesHTML = LEAGUES.map(L=>itemHTML(L,false)).join("");
  const cupsHTML    = CUPS.map(L=>itemHTML(L,true)).join("");

  const html =
    `<aside class="league-nav">
       <div class="lg-head">🏆 联赛</div>
       ${leaguesHTML}
       <div class="lg-sep"></div>
       <div class="lg-head lg-head-sub">🌍 杯赛</div>
       ${cupsHTML}
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

/* ==========================================================================
   league-page.js - 联赛页引导脚本（5 大联赛共用一个 leagues/league.html）
   通过 URL 参数 ?c=<联赛代码> 决定加载哪份数据与文案，避免 5 份重复 HTML。
   职责：
     1. 读取 ?c= 参数，取对应联赛配置（名称 / 副名 / 主场席位 / 数据文件）
     2. 写入页面标题、H1、积分榜标题、决赛席位等文案
     3. 依次按依赖顺序动态加载脚本：season-util -> data -> badge -> engine
        -> league-nav -> standings（standings 依赖 badge 与全局 CLUBS/SEASONS/ZONE）
   新增联赛只需在 LEAGUES 里加一条，并放一份 data/<code>-data.js。
   ========================================================================== */
(function(){
  "use strict";

  const LEAGUES = {
    england: {zh:"英超", sub:"Premier League", seats:"老特拉福德 · 酋长球场 · 安菲尔德"},
    spain:   {zh:"西甲", sub:"LaLiga",         seats:"圣地亚哥·伯纳乌 · 卡尔德隆 · 诺坎普"},
    italy:   {zh:"意甲", sub:"Serie A",        seats:"圣西罗 · 奥林匹克球场 · 迭戈·马拉多纳"},
    germany: {zh:"德甲", sub:"Bundesliga",     seats:"安联球场 · 威斯特法伦 · 红牛竞技场"},
    france:  {zh:"法甲", sub:"Ligue 1",        seats:"王子公园 · 韦洛德罗姆 · 热尔兰"}
  };
  const DEFAULT_CODE = "spain";

  function currentCode(){
    const c = new URLSearchParams(location.search).get("c");
    return (c && LEAGUES[c]) ? c : DEFAULT_CODE;
  }

  const code = currentCode();
  const cfg = LEAGUES[code];

  // 队徽图片目录：league.html 在 leagues/ 下，图片在 img/badges/<code>/，
  // 故相对路径为 ../img/badges/<code>。standings.js 读 window.BADGE_BASE 传给适配器。
  window.BADGE_BASE = "../img/badges/" + code;

  // ---------- 写入页面文案 ----------
  function setText(sel, text){ const el = document.querySelector(sel); if(el) el.textContent = text; }
  document.title = `⚽ ${cfg.zh}小游戏`;
  setText("h1", `⚽ ${cfg.zh}小游戏`);
  setText("#overlayTitle", `⚽ ${cfg.zh}小游戏`);
  setText(".table-head", `🏆 ${cfg.sub} 积分榜`);
  setText(".final-seat", `🏆 ${cfg.seats}`);

  // ---------- 按依赖顺序加载脚本 ----------
  const SCRIPTS = [
    "../js/season-util.js",
    `../data/${code}-data.js`,
    "../js/badge.js",
    "../js/engine.js",
    "../js/league-nav.js",
    "../js/standings.js"
  ];
  function loadSeq(list, i){
    if(i >= list.length) return;
    const s = document.createElement("script");
    s.src = list[i];
    s.onload = () => loadSeq(list, i + 1);
    document.body.appendChild(s);
  }
  loadSeq(SCRIPTS, 0);
})();

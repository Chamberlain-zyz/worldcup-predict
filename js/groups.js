/* ==========================================================================
   groups.js - 2026 美加墨世界杯小组赛积分榜（世界杯页专属）
   数据来自 data/data.md；由 groups.css 提供样式，挂载在 #groupsGrid
   球队字段：n=中文名 code=ISO(flagcdn) e=emoji国旗 w/d/l 胜平负 gf/ga 进/失 gd 净胜 pts 积分
   adv: "auto"=前2直接晋级 "third"=最佳第3名晋级 "out"=小组淘汰
   ========================================================================== */
(function(){
  "use strict";

  // ---------- 12 个小组数据 ----------
  const GROUPS = [
    {name:"A", teams:[
      {n:"墨西哥",   code:"mx",     e:"🇲🇽", w:3,d:0,l:0,gf:5,ga:0,gd:5, pts:9, adv:"auto"},
      {n:"南非",     code:"za",     e:"🇿🇦", w:1,d:1,l:1,gf:2,ga:2,gd:0, pts:4, adv:"auto"},
      {n:"韩国",     code:"kr",     e:"🇰🇷", w:1,d:0,l:2,gf:3,ga:3,gd:0, pts:3, adv:"out"},
      {n:"捷克",     code:"cz",     e:"🇨🇿", w:0,d:1,l:2,gf:1,ga:6,gd:-5,pts:1, adv:"out"},
    ]},
    {name:"B", teams:[
      {n:"瑞士",     code:"ch",     e:"🇨🇭", w:2,d:1,l:0,gf:6,ga:2,gd:4, pts:7, adv:"auto"},
      {n:"加拿大",   code:"ca",     e:"🇨🇦", w:1,d:1,l:1,gf:7,ga:1,gd:6, pts:4, adv:"auto"},
      {n:"波黑",     code:"ba",     e:"🇧🇦", w:1,d:1,l:1,gf:2,ga:5,gd:-3,pts:4, adv:"third"},
      {n:"卡塔尔",   code:"qa",     e:"🇶🇦", w:0,d:1,l:2,gf:1,ga:8,gd:-7,pts:1, adv:"out"},
    ]},
    {name:"C", teams:[
      {n:"巴西",     code:"br",     e:"🇧🇷", w:2,d:1,l:0,gf:4,ga:1,gd:3, pts:7, adv:"auto"},
      {n:"摩洛哥",   code:"ma",     e:"🇲🇦", w:2,d:1,l:0,gf:3,ga:1,gd:2, pts:7, adv:"auto"},
      {n:"苏格兰",   code:"gb-sct", e:"🏴",  w:1,d:0,l:2,gf:2,ga:3,gd:-1,pts:3, adv:"out"},
      {n:"海地",     code:"ht",     e:"🇭🇹", w:0,d:0,l:3,gf:0,ga:4,gd:-4,pts:0, adv:"out"},
    ]},
    {name:"D", teams:[
      {n:"美国",     code:"us",     e:"🇺🇸", w:2,d:0,l:1,gf:6,ga:2,gd:4, pts:6, adv:"auto"},
      {n:"澳大利亚", code:"au",     e:"🇦🇺", w:1,d:1,l:1,gf:3,ga:3,gd:0, pts:4, adv:"auto"},
      {n:"巴拉圭",   code:"py",     e:"🇵🇾", w:1,d:1,l:1,gf:2,ga:5,gd:-3,pts:4, adv:"third"},
      {n:"土耳其",   code:"tr",     e:"🇹🇷", w:1,d:0,l:2,gf:2,ga:3,gd:-1,pts:3, adv:"out"},
    ]},
    {name:"E", teams:[
      {n:"德国",     code:"de",     e:"🇩🇪", w:2,d:0,l:1,gf:10,ga:2,gd:8,pts:6, adv:"auto"},
      {n:"科特迪瓦", code:"ci",     e:"🇨🇮", w:2,d:0,l:1,gf:3,ga:3,gd:0, pts:6, adv:"auto"},
      {n:"厄瓜多尔", code:"ec",     e:"🇪🇨", w:1,d:1,l:1,gf:2,ga:2,gd:0, pts:4, adv:"third"},
      {n:"库拉索",   code:"cw",     e:"🏳️", w:0,d:1,l:2,gf:1,ga:9,gd:-8,pts:1, adv:"out"},
    ]},
    {name:"F", teams:[
      {n:"荷兰",     code:"nl",     e:"🇳🇱", w:2,d:1,l:0,gf:8,ga:3,gd:5, pts:7, adv:"auto"},
      {n:"日本",     code:"jp",     e:"🇯🇵", w:1,d:2,l:0,gf:6,ga:2,gd:4, pts:5, adv:"auto"},
      {n:"瑞典",     code:"se",     e:"🇸🇪", w:1,d:1,l:1,gf:6,ga:6,gd:0, pts:4, adv:"third"},
      {n:"突尼斯",   code:"tn",     e:"🇹🇳", w:0,d:0,l:3,gf:1,ga:10,gd:-9,pts:0,adv:"out"},
    ]},
    {name:"G", teams:[
      {n:"比利时",   code:"be",     e:"🇧🇪", w:1,d:2,l:0,gf:3,ga:2,gd:1, pts:5, adv:"auto"},
      {n:"埃及",     code:"eg",     e:"🇪🇬", w:1,d:2,l:0,gf:4,ga:3,gd:1, pts:5, adv:"auto"},
      {n:"伊朗",     code:"ir",     e:"🇮🇷", w:0,d:3,l:0,gf:2,ga:2,gd:0, pts:3, adv:"out"},
      {n:"新西兰",   code:"nz",     e:"🇳🇿", w:0,d:1,l:2,gf:2,ga:4,gd:-2,pts:1, adv:"out"},
    ]},
    {name:"H", teams:[
      {n:"西班牙",   code:"es",     e:"🇪🇸", w:2,d:1,l:0,gf:5,ga:0,gd:5, pts:7, adv:"auto"},
      {n:"佛得角",   code:"cv",     e:"🇨🇻", w:0,d:3,l:0,gf:2,ga:2,gd:0, pts:3, adv:"auto"},
      {n:"乌拉圭",   code:"uy",     e:"🇺🇾", w:0,d:2,l:1,gf:2,ga:4,gd:-2,pts:2, adv:"out"},
      {n:"沙特阿拉伯",code:"sa",    e:"🇸🇦", w:0,d:2,l:1,gf:1,ga:4,gd:-3,pts:2, adv:"out"},
    ]},
    {name:"I", teams:[
      {n:"法国",     code:"fr",     e:"🇫🇷", w:3,d:0,l:0,gf:8,ga:1,gd:7, pts:9, adv:"auto"},
      {n:"挪威",     code:"no",     e:"🇳🇴", w:2,d:0,l:1,gf:7,ga:5,gd:2, pts:6, adv:"auto"},
      {n:"塞内加尔", code:"sn",     e:"🇸🇳", w:1,d:0,l:2,gf:3,ga:6,gd:-3,pts:3, adv:"third"},
      {n:"伊拉克",   code:"iq",     e:"🇮🇶", w:0,d:0,l:3,gf:1,ga:7,gd:-6,pts:0, adv:"out"},
    ]},
    {name:"J", teams:[
      {n:"阿根廷",   code:"ar",     e:"🇦🇷", w:3,d:0,l:0,gf:7,ga:0,gd:7, pts:9, adv:"auto"},
      {n:"奥地利",   code:"at",     e:"🇦🇹", w:1,d:1,l:1,gf:4,ga:4,gd:0, pts:4, adv:"auto"},
      {n:"阿尔及利亚",code:"dz",    e:"🇩🇿", w:1,d:1,l:1,gf:2,ga:4,gd:-2,pts:4, adv:"third"},
      {n:"约旦",     code:"jo",     e:"🇯🇴", w:0,d:0,l:3,gf:0,ga:5,gd:-5,pts:0, adv:"out"},
    ]},
    {name:"K", teams:[
      {n:"哥伦比亚", code:"co",     e:"🇨🇴", w:2,d:1,l:0,gf:4,ga:1,gd:3, pts:7, adv:"auto"},
      {n:"葡萄牙",   code:"pt",     e:"🇵🇹", w:1,d:2,l:0,gf:3,ga:1,gd:2, pts:5, adv:"auto"},
      {n:"刚果（金）",code:"cd",    e:"🇨🇩", w:1,d:1,l:1,gf:4,ga:3,gd:1, pts:4, adv:"third"},
      {n:"乌兹别克斯坦",code:"uz",  e:"🇺🇿", w:0,d:0,l:3,gf:1,ga:7,gd:-6,pts:0, adv:"out"},
    ]},
    {name:"L", teams:[
      {n:"英格兰",   code:"gb-eng", e:"🏴",  w:2,d:1,l:0,gf:7,ga:3,gd:4, pts:7, adv:"auto"},
      {n:"克罗地亚", code:"hr",     e:"🇭🇷", w:2,d:0,l:1,gf:6,ga:5,gd:1, pts:6, adv:"auto"},
      {n:"加纳",     code:"gh",     e:"🇬🇭", w:1,d:1,l:1,gf:2,ga:2,gd:0, pts:4, adv:"third"},
      {n:"巴拿马",   code:"pa",     e:"🇵🇦", w:0,d:0,l:3,gf:1,ga:6,gd:-5,pts:0, adv:"out"},
    ]},
  ];

  // ---------- 国旗小图（flagcdn，失败降级为 emoji） ----------
  function flag(code, emoji){
    return `<img class="gflag" src="https://flagcdn.com/${code}.svg" alt="${emoji}"
             onerror="this.replaceWith(document.createTextNode('${emoji}'))">`;
  }
  function gdStr(gd){ return gd>0 ? "+"+gd : ""+gd; }

  // ---------- 单个小组卡片 ----------
  function groupHTML(g){
    const rows = g.teams.map((t,i)=>{
      const rank = i+1;
      // 前 2 名 auto 晋级；第 3 名视 adv 字段
      const cls = t.adv==="auto" ? "adv-auto" :
                  t.adv==="third"? "adv-third":
                                   "adv-out";
      return `<tr class="${cls}">
        <td class="grk">${rank}</td>
        <td class="gtm">${flag(t.code,t.e)}<span class="gname">${t.n}</span></td>
        <td>${t.w}</td>
        <td>${t.d}</td>
        <td>${t.l}</td>
        <td class="ggd">${gdStr(t.gd)}</td>
        <td class="gpts">${t.pts}</td>
      </tr>`;
    }).join("");
    return `<div class="group-card">
      <div class="ghead"><span class="gname-head">${g.name} 组</span></div>
      <table class="gtable">
        <thead><tr>
          <th style="width:22px">#</th>
          <th class="left">球队</th>
          <th title="胜">胜</th>
          <th title="平">平</th>
          <th title="负">负</th>
          <th title="净胜球">净</th>
          <th title="积分">积</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  function render(){
    const host = document.getElementById("groupsGrid");
    if(!host) return;
    host.innerHTML = GROUPS.map(groupHTML).join("");
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", render);
  else render();
})();

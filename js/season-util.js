/* ==========================================================================
   season-util.js - 赛季数据工具（联赛页共用，须在 data/*-data.js 之前加载）
   emptySeason(codes)：按球队 code 列表生成一份全 0 的新赛季，避免在每个
   data 文件里手抄 20 行 {pld:0,w:0,...}。codes 的顺序即新赛季的排名顺序。
   ========================================================================== */
(function(){
  "use strict";
  window.emptySeason = function(codes){
    return codes.map(function(code){
      return {code:code, pld:0, w:0, d:0, l:0, gf:0, ga:0, pts:0};
    });
  };
})();

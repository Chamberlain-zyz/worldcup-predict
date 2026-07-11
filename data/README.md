# 📊 数据目录（预留）

本目录预留给**积分榜/对阵图数据的 JSON 文件**，用于将来把数据从 HTML 中剥离出来独立维护。

## 当前状态

**目前所有数据仍写死在各 HTML 内联 `<script>` 中**（因为 `file://` 协议下浏览器禁止 `fetch()` 读本地 JSON）。

## 计划的 JSON 格式

### 联赛积分榜：`{联赛英文名}-{赛季}.json`

例：`spain-2526.json` 表示西甲 2025/26 赛季

```json
{
  "league": "spain",
  "label": "2025/26",
  "clubs": [
    {"code":"bar","pld":38,"w":31,"d":1,"l":6,"gf":95,"ga":36,"pts":94},
    {"code":"rma","pld":38,"w":27,"d":5,"l":6,"gf":77,"ga":35,"pts":86}
  ]
}
```

球队元数据（`CLUBS`：名称/配色/缩写）建议单独放：`spain-clubs.json` / `england-clubs.json` 等。

### 世界杯：`worldcup-2026.json`

```json
{
  "countries": [["Brazil","br","🇧🇷"], ...],
  "nameZh": {"br":"巴西", ...},
  "bracket": {
    "top":    [{"round":"32强赛","a":["Germany","de","🇩🇪"],"b":[...],"winner":"b","scoreA":1,"scoreB":1,"penA":3,"penB":4}, ...],
    "bottom": [...]
  }
}
```

## 接入方式（将来做）

需要在 HTTP 服务器（如 `python -m http.server`）下访问页面才能启用。当前联赛/世界杯页面里，把内联的 `const CLUBS=...`/`const SEASONS=...` 替换为：

```html
<script>
(async () => {
  const clubs = await fetch("data/spain-clubs.json").then(r=>r.json());
  const seasonFiles = ["spain-2526","spain-2425","spain-2324","spain-2223","spain-2122"];
  const seasons = await Promise.all(seasonFiles.map(f=>fetch(`data/${f}.json`).then(r=>r.json())));
  window.CLUBS = clubs;
  window.SEASONS = seasons;
  window.ZONE = {ucl:5, uel:7};
  // 手动加载 engine + standings（因为它们依赖上面这些全局变量）
  await import("./js/engine.js");
  await import("./js/standings.js");
})();
</script>
```

或者更简单：把数据文件做成 JS 文件（`spain-2526.js` 里写 `window.SEASON_SPAIN_2526 = {...}`），用 `<script src>` 加载，避免 CORS 限制。

## 改了什么

<!-- 一句话说明本次改动 -->

## 为什么

<!-- 动机 / 关联 issue -->

## 怎么验证

<!-- 单文件 Canvas 项目难自动化测试，请务必写清本地实测步骤与结果 -->
- [ ] 浏览器打开 `worldcup.html`，控制台无报错
- [ ] `node --check` 校验 `<script>` 无语法错误
- [ ] 涉及物理/计时/点球的改动，附实测说明：

## 类型

- [ ] feat 新功能
- [ ] fix 缺陷修复
- [ ] chore 数据/杂务
- [ ] docs 文档
- [ ] style 样式
- [ ] refactor 重构
- [ ] perf 性能

## 自审清单（对照 docs/CODE_REVIEW_STANDARD.md）

- [ ] 无向 `innerHTML` 注入不可信数据
- [ ] 新增 rAF/timer 有对应清理
- [ ] 修改 `state` 结构后已检查 step/render/applyUI/newMatch 全链路
- [ ] 除法已防 0 除、角度已过 normAngle
- [ ] 新增魔法数字已常量化并注释
- [ ] commit 遵循 Conventional Commits，一次只做一件事

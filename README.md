# easepluse / EasePulse 息伴

当前正式开发目录：`/Users/jessica/Documents/projects/easepluse`

`easepluse` 是项目目录名，产品展示名沿用 `EasePulse 息伴`。

## 当前状态

- 已将 `New project` 中的可运行 Web MVP 合并到正式目录
- 当前是基于 Vite + React + TypeScript 的前端演示版
- 保留了 `docs/`、`data/`、`scripts/`、`tests/` 作为后续扩展目录
- 已接入 Zeabur GitHub 自动部署链路

## 产品范围

- 数据桥接页：说明 `华为运动健康 -> 苹果健康 -> Web` 的真实边界
- 上传真实截图：睡眠、心率、压力
- 录入关键指标：睡眠、心率、压力、久坐、主观感受、不适症状
- 今日状态：恢复分、状态判断、原因解释
- 恢复支持：90 秒呼吸 + 反馈闭环
- 趋势复盘：7 天趋势图与洞察
- 安全边界：危险症状升级提醒

## 目录结构

- `src/`: 已合并的前端源码
- `scripts/`: 后续脚本
- `docs/`: 文档和记录
- `data/`: 数据文件
- `tests/`: 测试

## 比赛资料

- `docs/collab-status.md`: 当前协作进度、关键共识、代码改动和下一步
- `docs/ios-health-integration-log.md`: iOS 真机接入 Band 9 与 Apple Health 的实现记录
- `docs/competition-runbook.md`: 比赛视频脚本、Xcode 真机部署步骤、录制顺序
- `docs/roadshow-5min.md`: 严格按 5 分钟路演要求压缩后的讲稿与 Demo 路径
- `docs/roadshow-spoken.md`: 可直接练习的口语版逐段讲稿
- `docs/ppt-outline.md`: 5 分钟比赛版 PPT 逐页结构
- `docs/judge-qa.md`: 评委高频问题与建议回答
- `docs/video-recording-checklist.md`: 比赛视频录制方案、Web/App/Simulator 三套路径与今晚执行清单
- `docs/ppt-final-copy.md`: 可直接粘贴到 PPT 生成网站的成稿文案
- `docs/video-final-copy.md`: 可直接粘贴到视频脚本工具或剪辑软件的成稿文案
- `docs/tool-recommendations.md`: 当前免费好用的 PPT 与视频工具推荐

## 本地运行

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
npm run preview
```

## 重要边界

- 当前 Web 版不直接读取 Apple Health / Huawei Health
- 第一阶段比赛版通过截图上传 + 手动录入实现真实感与闭环
- 后续 iOS 版本再补 HealthKit 原生数据同步能力

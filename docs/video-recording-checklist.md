# EasePulse 视频录制清单

当前版本：`2026-04-06`
当前工作目录：`/Users/jessica/Documents/projects/easepluse`
目标：录出一支 60 秒比赛视频，结构为 `截图证据 + Web 录屏 + App 录屏`

## 核心判断

不要把整支视频都做成截图切换。

最稳妥的结构是：

- 前 8 秒：真实健康截图，证明问题真实存在
- 中间 15 到 20 秒：本地 Web 录屏，证明产品逻辑已经跑通
- 后面 30 多秒：App 录屏，证明它已经进入手机载体

## 今晚最推荐的录制方案

### A 方案：最优先

- Web 部分：用 Mac 自带 `Shift-Command-5` 录制
- App 部分：先安装到 iPhone，再用 iPhone 自带录屏

这是最适合比赛的方案，因为画面最像真实产品。

### B 方案：真机不稳时的兜底

- Web 部分：仍然用 Mac 录屏
- App 部分：改用 iOS Simulator 录制

因为 EasePulse 当前是 iOS 容器壳包 Web，所以如果真机签名、开发者模式或安装流程拖时间，Simulator 是合理兜底，不会伤到核心表达。

## Web 录制方法

### 工具

使用 Mac 自带录屏：

```text
Shift-Command-5
```

Apple 官方说明：

- Mac 录屏：[How to record the screen on Mac](https://support.apple.com/en-us/102618)
- Mac 截图/录屏工具：[Take screenshots or screen recordings on Mac](https://support.apple.com/guide/mac-help/take-a-screenshot-mh26782/mac)

### 操作步骤

1. 启动本地站

```bash
cd /Users/jessica/Documents/projects/easepluse
npm run dev
```

2. 打开本地地址

```text
http://127.0.0.1:3001/
```

3. 按 `Shift-Command-5`
4. 选择 `录制所选部分`
5. 框住浏览器内容区域，不要带太多桌面边框
6. 关闭麦克风，比赛视频后期再统一配音或字幕
7. 开始录制

### Web 建议录制段落

- 首页首屏 / Story 证据板
- `Simulate Stress`
- `打开今日状态`

## iPhone 真机录制方法

### 工具

使用 iPhone 控制中心自带录屏。

Apple 官方说明：

- iPhone 录屏：[Record the screen on your iPhone](https://support.apple.com/en-us/102653)

### 开始前准备

- 打开 `勿扰模式`
- 关闭消息提醒预览
- 手机电量保持足够
- 先确认 EasePulse 已安装并能正常打开

### 操作步骤

1. 从右上角下拉打开控制中心
2. 点击录屏按钮
3. 等待 3 秒倒计时
4. 回到 EasePulse App 操作
5. 结束时点击顶部红色录制状态停止
6. 录制内容会进入照片 App

### App 建议录制段落

- 今日状态页
- 恢复支持页
- 匿名支持页
- 关怀圈页

## iOS Simulator 兜底录制

### 官方参考

- Simulator 总说明：[Devices and Simulator](https://developer.apple.com/documentation/xcode/devices-and-simulator/)
- Simulator 截图/视频：[Capturing screenshots and videos from Simulator](https://developer.apple.com/documentation/xcode/capturing-screenshots-and-videos-from-simulator)
- Apple 旧版文档里仍保留了命令行示例：[Interacting with Simulator](https://developer.apple.com/library/archive/documentation/IDEs/Conceptual/iOS_Simulator_Guide/InteractingwiththeiOSSimulator/InteractingwiththeiOSSimulator.html)
- WWDC20 也明确提到可直接用 `simctl` 录视频：[Become a Simulator expert](https://developer.apple.com/videos/play/wwdc2020/10647/?time=1096)

### 最实用命令

如果 Simulator 已经打开并且 App 正在运行，可以直接录：

```bash
xcrun simctl io booted recordVideo demo-app.mp4
```

停止录制：

```text
Control-C
```

截图：

```bash
xcrun simctl io booted screenshot demo-shot.png
```

### 什么时候用 Simulator

- 真机签名卡住
- 真机安装反复失败
- 需要更干净的演示画面
- 时间不够，不想被 iPhone 部署流程拖住

## 60 秒视频建议拆分

### 第一段：截图证据（0 到 8 秒）

素材：

- 睡眠截图
- 压力截图
- 心率截图
- 静息能量截图

作用：

证明问题真实存在，不是概念想象。

### 第二段：Web 录屏（8 到 26 秒）

录制动作：

- 打开首页
- 点击 `Simulate Stress`
- 点击 `打开今日状态`

作用：

证明产品逻辑已经跑通。

### 第三段：App 录屏（26 到 58 秒）

录制动作：

- 进入 `今日状态`
- 进入 `恢复支持`
- 进入 `匿名支持`
- 进入 `关怀圈`

作用：

证明产品已经不是纯网页概念，而是进入手机产品载体。

### 第四段：收尾字卡（58 到 60 秒）

文案：

```text
EasePulse 息伴
我今天是不是快透支了，现在最该怎么恢复
```

## 录制顺序建议

今晚不要试图一次录完整支片。

正确顺序：

1. 先录截图段
2. 再录 Web 段
3. 再录 App 段
4. 最后剪映合成

## 文件命名建议

建议统一放到一个导出目录，避免后期素材混乱。

```text
video/raw/01-screenshots/
video/raw/02-web/
video/raw/03-app/
video/export/
```

建议命名：

```text
01-sleep.png
02-stress.png
03-heart-rate.png
04-resting-energy.png
web-home.mp4
web-dashboard.mp4
app-support.mp4
app-care.mp4
final-v1.mp4
```

## 剪辑时不要犯的错

- 不要全程用截图
- 不要全程保留鼠标乱晃
- 不要录到通知弹窗
- 不要录到 Xcode、Finder、终端杂乱界面
- 不要每个页面停太久
- 不要把技术接入细节塞进视频主线

## 今晚最稳的执行结论

如果真机已跑通：

- Web 用 Mac 录
- App 用 iPhone 录

如果真机还不稳：

- Web 用 Mac 录
- App 改用 Simulator + `simctl` 录

不要因为纠结录制工具，拖慢整支比赛视频的产出。

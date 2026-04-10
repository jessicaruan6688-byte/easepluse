# EasePulse 比赛操作手册

当前唯一工作目录：`/Users/jessica/Documents/projects/easepluse`

## 当前状态

- 本地 Web 演示版已经是最新版本。
- iOS 容器壳已经同步到最新 Web 内容。
- 当前命令已验证成功：`npm run ios:build-web`
- 当前未提交素材：`picture/`（真实截图）
- 线上 Zeabur 站点可访问，但比赛录制优先使用本地 Web 和本机 App，避免线上缓存导致版本落后。

## 录制策略

不要把整支视频都做成截图切换。

推荐结构：

- 前 8 秒：真实健康截图，证明问题真实存在
- 中间 18 秒：本地 Web 录屏，证明产品逻辑和交互已跑通
- 后 34 秒：iPhone App 录屏，证明它可以进入真实手机载体

结论：

- 截图负责“证据”
- 录屏负责“产品可信度”

## 一分钟视频脚本

| 时间 | 形式 | 录制位置 | 画面动作 | 旁白 |
|---|---|---|---|---|
| 0-4 秒 | 截图 | 原始健康截图 | 快切睡眠、压力、心率 | 高压工作者最危险的，不是忙，而是透支了却没人看见。 |
| 4-8 秒 | 截图 | 静息能量截图 | 停 1 秒 | 当睡眠变碎、压力波动、心率拉宽，身体其实已经在报警。 |
| 8-14 秒 | Web 录屏 | `overview` 首页 | 打开 EasePulse 首页，停在首屏 | EasePulse 先不下判断口号，而是先把透支这件事看见。 |
| 14-20 秒 | Web 录屏 | 首页 `Pitch Demo` | 点击 `Simulate Stress` | 它把睡眠、压力、心率和能量消耗拼起来，回答你今天是不是快透支了。 |
| 20-26 秒 | Web 录屏 | `dashboard` 今日状态 | 点击 `打开今日状态` | 不是靠单一指标吓人，而是给出今天的恢复判断和原因解释。 |
| 26-32 秒 | App 录屏 | iPhone 里的 EasePulse | 展示同样的今日状态页面 | 这件事不只停留在网页，而是开始进入真实的手机产品。 |
| 32-39 秒 | App 录屏 | `support` 恢复支持 | 点击 `立即恢复` 再点击 `开始 90 秒呼吸` | 当状态变差，EasePulse 先接住你，先给你一个当下最有效的恢复动作。 |
| 39-46 秒 | App 录屏 | `support` 下半屏 | 带到支持网络区块 | 它不会把所有支持塞进一个聊天框，而是按强度分流。 |
| 46-53 秒 | App 录屏 | `beacon` 匿名支持 | 点击 `去匿名支持` 再点击 `发起匿名求助` | 如果你暂时不想打扰熟人，匿名支持先承接主动求助。 |
| 53-58 秒 | App 录屏 | `care` 关怀圈 | 点击 `转到关怀圈` 再点击 `留一句话` 或 `打电话` | 如果状态继续恶化，系统就把支持转交给真实关系网络。 |
| 58-60 秒 | 字卡 | 收尾页 | Logo 或品牌字卡 | EasePulse 息伴。回答：我今天是不是快透支了，现在最该怎么恢复。 |

## 本地 Web 录制

先启动本地站：

```bash
cd /Users/jessica/Documents/projects/easepluse
npm run dev
```

默认地址：

```bash
http://127.0.0.1:3001/
```

录制建议：

- 只录本地最新版本，不录线上缓存版本
- 录屏时使用中文界面
- 鼠标移动放慢，按钮点下后停 0.5 到 1 秒
- 首页重点录 `Simulate Stress -> 打开今日状态`

## iOS 真机部署

### 1. 先同步最新 Web 到 iOS

```bash
cd /Users/jessica/Documents/projects/easepluse
npm run ios:build-web
```

### 2. 用 Xcode 打开正确工程

打开这个：

`/Users/jessica/Documents/projects/easepluse/ios/App/App.xcworkspace`

不要新建项目。
不要打开 `.xcodeproj`。

### 3. 在 Xcode 内操作

1. 左侧项目导航点击蓝色项目 `App`
2. 选择 `TARGETS > App`
3. 点击上方 `Signing & Capabilities`
4. 勾选 `Automatically manage signing`
5. 在 `Team` 中选择你自己的 Apple ID，一般显示为 `Personal Team`
6. 如果 `Bundle Identifier` 报冲突，改成唯一值，例如：

```text
com.jessicaruan.easepulse
```

### 4. 连接 iPhone 16 Pro Max

1. 用数据线连接手机
2. 手机上点击“信任这台电脑”
3. 如果需要，在手机中打开：

`设置 -> 隐私与安全性 -> 开发者模式`

4. 回到 Xcode 顶部运行目标区域，选择：

`App > 你的 iPhone 16 Pro Max`

5. 点击左上角运行按钮 `Run`

### 5. 如果装上后打不开

去手机：

`设置 -> 通用 -> VPN 与设备管理`

找到你的开发者账号并点击信任。

## App 录屏建议

真机录屏优先，不建议只录模拟器。

录制内容建议：

- 今日状态页
- 恢复支持页
- 匿名支持页
- 关怀圈页

不要录：

- 长时间停留在工程页
- 复杂调试过程
- 蓝牙桥接页的大段解释

## 常用命令

```bash
cd /Users/jessica/Documents/projects/easepluse
npm run dev
npm run build
npm run ios:build-web
npm run cap:open
```

## 当前最重要的执行顺序

1. 在本地 Web 录完前半段
2. 在 iPhone 真机跑起 App
3. 在手机里录后半段
4. 用剪映把 Web 和 App 混剪成 60 秒
5. 最后再决定是否更新线上 Zeabur

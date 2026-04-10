# EasePulse 协作记录

最后更新：2026-04-11

这个文档是给终端协作用的轻量记录。
后面我会继续往这里追加，不单独拆很多文档。

## 当前共识

- 产品名：EasePulse / 息伴
- 核心定位：保护高压工作者的情绪恢复力和持续输出能力
- 核心问题：回答“我今天是不是快透支了，现在最该怎么恢复”
- 核心链路：先看见透支 -> 接住用户 -> 转交真实支持网络
- 当前最现实技术路径：
  - Band 9 负责实时心率广播
  - iPhone App 负责 BLE 实时接入
  - Apple 健康负责睡眠、静息心率、步数等历史数据
  - 华为 Health Kit 作为下一阶段补强，不是今天的最短落地路径

## 今天已经打通

- iOS 真机已经可以显示来自 Huawei Band 9 的实时心率
- 当前实时链路：
  - `Band 9 -> BLE Heart Rate Service (180D) -> EasePulse iOS`
- 当前前端产品结构已经包含：
  - 数据桥接
  - 今日状态
  - 恢复支持
  - 关怀圈
  - 匿名支持
  - 安全边界

## 我正在做

- 补 Apple Health / HealthKit 原生桥接
- 把历史数据同步进 EasePulse 今日状态
- 让产品从“只有实时心率”升级成“实时发现 + 历史判断”

## 这轮代码改动

- 新增 iOS 原生文件：
  - `ios/App/App/HealthBridgePlugin.swift`
  - `ios/App/App/App.entitlements`
- 新增前端桥接文件：
  - `src/lib/health-bridge.ts`
- 已更新：
  - `ios/App/App/AppDelegate.swift`
  - `ios/App/App/Info.plist`
  - `ios/App/App/capacitor.config.json`
  - `ios/App/App.xcodeproj/project.pbxproj`
  - `src/App.tsx`

## 现在的产品数据架构

- 实时数据：
  - Band 9 打开 HR Data Broadcasts
  - EasePulse 直接走 iPhone 蓝牙读取实时心率
- 历史数据：
  - 优先从 Apple 健康读取
  - 读取项先做：
    - 睡眠
    - 静息心率
    - 心率
    - 步数
    - 运动分钟
    - 活跃能量

## 需要知道的边界

- 当前不是医疗诊断产品
- 不把“猝死预警”讲成医疗承诺
- 陌生人世界不公开危险状态
- 高风险只升级到亲友、急救、专业支持

## 如果你在终端里要快速对齐

- 先看这个文档
- 再看这些文件：
  - `src/App.tsx`
  - `src/lib/health-bridge.ts`
  - `ios/App/App/HealthBridgePlugin.swift`
  - `ios/App/App/AppDelegate.swift`

## 下一步

- 编译检查 TypeScript 和 iOS 工程
- 如果编译通过，再给你一份真机点哪里测试 Apple 健康同步的步骤

## 最新补充

- 2026-04-10 当前这次改动的编译检查已通过：
  - `npm run build` 通过
  - `xcodebuild -workspace ios/App/App.xcworkspace -scheme App -sdk iphonesimulator -derivedDataPath /tmp/easepulse-healthkit-build CODE_SIGNING_ALLOWED=NO build` 通过
- 当前这个聊天线程没有直接挂载你本地终端会话，所以我读不到你终端窗口里的原始输出文本。
- 但我会继续以仓库实际代码、编译结果和这份文档作为对齐基线。

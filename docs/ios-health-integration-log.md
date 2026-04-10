# EasePulse iOS 健康接入记录

更新时间：2026-04-10

## 当前唯一方向

- 当前工作目录是 `easepluse`
- 当前目标不是网站，不是电商平台
- 当前目标是把 `心率`、`睡眠`、`运动` 接到 iOS App
- 数据路径拆成两条：
  - `心率实时数据`：iPhone 蓝牙 + 手环广播
  - `睡眠 / 运动 / 步数 / 静息心率`：Apple Health / HealthKit

## 目前已经接上的内容

- iOS 原生蓝牙桥：
  - 文件：`ios/App/App/BandBridgePlugin.swift`
  - 作用：扫描附近设备，连接支持心率服务的手环，接收实时心率通知
- iOS 原生 HealthKit 桥：
  - 文件：`ios/App/App/HealthBridgePlugin.swift`
  - 作用：读取睡眠、静息心率、最新心率、步数、活动热量、运动时间
- JS/TS 包装层：
  - `src/lib/band-bridge.ts`
  - `src/lib/health-bridge.ts`
- 前端页面已接好调用：
  - 文件：`src/App.tsx`
  - 已支持：
    - 请求 Apple Health 权限
    - 同步当日健康摘要
    - 连接/断开 iPhone 蓝牙手环
    - 展示同步状态、心率状态

## iOS 工程配置现状

- `Info.plist` 已包含：
  - 蓝牙权限文案
  - HealthKit 读写说明
- `App.entitlements` 已包含：
  - `com.apple.developer.healthkit = true`
- `AppDelegate.swift` 已注册：
  - `BandBridgePlugin`
  - `HealthBridgePlugin`
- `project.pbxproj` 已加入：
  - `HealthBridgePlugin.swift`
  - `App.entitlements`
  - `CODE_SIGN_ENTITLEMENTS = App/App.entitlements`

## 本轮新增

- 在 App 内新增 `HealthKit diagnostics` 可见诊断区
- 现在真机点击“同步 Apple 健康”后，可以直接看到：
  - 各项权限状态
  - 样本覆盖数量
  - HealthKit 查询错误

## 已验证结果

- `npm run ios:build-web` 已成功
- iOS 前端资源已重新同步到 Capacitor 工程
- `xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17' build` 已成功

## 还没有完成的事情

- 还没有完成真机验证
- 睡眠、运动、步数、静息心率只有在真机且 Health App 里已有数据时才能确认结果
- 蓝牙手环实时心率也必须在真机 + 实际设备下验证

## 下一步执行顺序

1. 在真机打开 EasePulse
2. 进入 Apple Health 同步区域
3. 点击 `Sync Apple Health`
4. 观察诊断区是否显示：
   - 权限已授权
   - 样本数大于 0
   - 没有查询错误
5. 再测试手环广播：
   - 手环开启心率广播
   - App 点击连接
   - 观察是否出现实时心率与最后接收时间

## 当前已知风险

- 模拟器可以编译，但不能代表 HealthKit 与蓝牙链路真实可用
- 仓库里有一个异常文件：`ios/App/Pods/Untitled.swift`
  - 当前没有阻塞构建
  - 后续可以再判断是否需要清理

import Foundation
import Capacitor
import CoreBluetooth

@objc(BandBridgePlugin)
public class BandBridgePlugin: CAPPlugin, CAPBridgedPlugin, CBCentralManagerDelegate, CBPeripheralDelegate {
    public let identifier = "BandBridgePlugin"
    public let jsName = "BandBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "connect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise)
    ]

    private let heartRateServiceUUID = CBUUID(string: "180D")
    private let heartRateMeasurementUUID = CBUUID(string: "2A37")

    private var centralManager: CBCentralManager?
    private var activePeripheral: CBPeripheral?
    private var heartRateCharacteristic: CBCharacteristic?
    private var pendingConnectCall: CAPPluginCall?
    private var scanTimeoutWorkItem: DispatchWorkItem?
    private var discoveredPeripherals: [UUID: CBPeripheral] = [:]
    private var discoveredPeripheralNames: [UUID: String] = [:]
    private var discoveredPeripheralHeartRateAds: [UUID: Bool] = [:]
    private var attemptedPeripheralIDs: Set<UUID> = []

    private var connectionState = "idle"
    private var deviceName = ""
    private var latestHeartRate: Int?
    private var latestSignalAt: Double?

    @objc override public func load() {
        DispatchQueue.main.async {
            NSLog("[EasePulse][BLE] BandBridgePlugin loaded")
            self.ensureCentralManager()
        }
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.ensureCentralManager()
            let state = self.centralManager?.state ?? .unknown
            call.resolve([
                "available": state != .unsupported,
                "state": self.stateForManager(state)
            ])
        }
    }

    @objc func getStatus(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve(self.statusPayload())
        }
    }

    @objc func connect(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            NSLog("[EasePulse][BLE] connect() called")
            if self.pendingConnectCall != nil {
                call.reject("A Bluetooth connection attempt is already running.")
                return
            }

            self.ensureCentralManager()

            if let peripheral = self.activePeripheral,
               peripheral.state == .connected,
               self.heartRateCharacteristic != nil {
                self.connectionState = "connected"
                self.emitStatus()
                call.resolve(self.statusPayload())
                return
            }

            self.pendingConnectCall = call
            self.bridge?.saveCall(call)
            self.connectionState = "connecting"
            self.emitStatus()

            guard let manager = self.centralManager else {
                NSLog("[EasePulse][BLE] central manager unavailable")
                self.rejectPendingConnect("Bluetooth is unavailable on this iPhone.")
                return
            }

            NSLog("[EasePulse][BLE] manager state = %@", self.stateForManager(manager.state))
            switch manager.state {
            case .poweredOn:
                self.beginScan()
            case .poweredOff:
                self.rejectPendingConnect("Bluetooth is turned off on this iPhone.")
            case .unauthorized:
                self.rejectPendingConnect("Bluetooth permission is not granted for EasePulse.")
            case .unsupported:
                self.rejectPendingConnect("This iPhone does not support Bluetooth LE heart-rate connections.")
            case .resetting, .unknown:
                break
            @unknown default:
                self.rejectPendingConnect("Bluetooth is in an unknown state.")
            }
        }
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.cancelScanTimeout()
            self.centralManager?.stopScan()

            if let peripheral = self.activePeripheral {
                self.centralManager?.cancelPeripheralConnection(peripheral)
            }

            self.cleanupPeripheral(keepLastReading: false)
            self.connectionState = "idle"
            self.emitStatus()
            call.resolve(self.statusPayload())
        }
    }

    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        DispatchQueue.main.async {
            switch central.state {
            case .poweredOn:
                if self.pendingConnectCall != nil && self.activePeripheral == nil {
                    self.beginScan()
                } else {
                    self.emitStatus()
                }
            case .poweredOff:
                self.connectionState = "error"
                self.emitStatus(errorMessage: "Bluetooth is turned off on this iPhone.")
                if self.pendingConnectCall != nil {
                    self.rejectPendingConnect("Bluetooth is turned off on this iPhone.")
                }
            case .unauthorized:
                self.connectionState = "unsupported"
                self.emitStatus(errorMessage: "Bluetooth permission is not granted for EasePulse.")
                if self.pendingConnectCall != nil {
                    self.rejectPendingConnect("Bluetooth permission is not granted for EasePulse.")
                }
            case .unsupported:
                self.connectionState = "unsupported"
                self.emitStatus(errorMessage: "This iPhone does not support Bluetooth LE heart-rate connections.")
                if self.pendingConnectCall != nil {
                    self.rejectPendingConnect("This iPhone does not support Bluetooth LE heart-rate connections.")
                }
            case .resetting, .unknown:
                self.connectionState = "connecting"
                self.emitStatus()
            @unknown default:
                self.connectionState = "error"
                self.emitStatus(errorMessage: "Bluetooth is in an unknown state.")
            }
        }
    }

    public func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
        DispatchQueue.main.async {
            let advertisedName = advertisementData[CBAdvertisementDataLocalNameKey] as? String
            let displayName = self.resolveDeviceName(peripheral, advertisedName: advertisedName)
            let advertisedServices = advertisementData[CBAdvertisementDataServiceUUIDsKey] as? [CBUUID] ?? []
            let advertisesHeartRate = advertisedServices.contains(self.heartRateServiceUUID)
            NSLog("[EasePulse][BLE] Discovered peripheral name=%@ heartRateAd=%@ rssi=%@", displayName, advertisesHeartRate ? "yes" : "no", RSSI.stringValue)

            self.discoveredPeripherals[peripheral.identifier] = peripheral
            self.discoveredPeripheralNames[peripheral.identifier] = displayName
            self.discoveredPeripheralHeartRateAds[peripheral.identifier] = advertisesHeartRate
        }
    }

    public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        DispatchQueue.main.async {
            NSLog("[EasePulse][BLE] Connected to %@", self.resolveDeviceName(peripheral))
            peripheral.delegate = self
            peripheral.discoverServices([self.heartRateServiceUUID])
        }
    }

    public func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        DispatchQueue.main.async {
            let message = error?.localizedDescription ?? "The band connection failed."
            self.handleCandidateFailure(message)
        }
    }

    public func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        DispatchQueue.main.async {
            if self.pendingConnectCall != nil {
                let message = error?.localizedDescription ?? "The band connection was interrupted."
                self.handleCandidateFailure(message)
                return
            }

            self.cleanupPeripheral(keepLastReading: false)
            self.connectionState = "idle"
            self.emitStatus(errorMessage: error?.localizedDescription)
        }
    }

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        DispatchQueue.main.async {
            if let error {
                self.handleCandidateFailure(error.localizedDescription)
                return
            }

            guard let service = peripheral.services?.first(where: { $0.uuid == self.heartRateServiceUUID }) else {
                self.handleCandidateFailure("The selected device did not expose the standard heart-rate service.")
                return
            }

            peripheral.discoverCharacteristics([self.heartRateMeasurementUUID], for: service)
        }
    }

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        DispatchQueue.main.async {
            if let error {
                self.handleCandidateFailure(error.localizedDescription)
                return
            }

            guard let characteristic = service.characteristics?.first(where: { $0.uuid == self.heartRateMeasurementUUID }) else {
                self.handleCandidateFailure("The selected device did not expose heart-rate measurement notifications.")
                return
            }

            self.heartRateCharacteristic = characteristic
            peripheral.setNotifyValue(true, for: characteristic)
        }
    }

    public func peripheral(_ peripheral: CBPeripheral, didUpdateNotificationStateFor characteristic: CBCharacteristic, error: Error?) {
        DispatchQueue.main.async {
            if let error {
                self.handleCandidateFailure(error.localizedDescription)
                return
            }

            guard characteristic.isNotifying else {
                self.handleCandidateFailure("Heart-rate notifications could not be enabled.")
                return
            }

            self.connectionState = "connected"
            self.emitStatus()
            self.resolvePendingConnect()
        }
    }

    public func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        DispatchQueue.main.async {
            if let error {
                self.connectionState = "error"
                self.emitStatus(errorMessage: error.localizedDescription)
                return
            }

            guard characteristic.uuid == self.heartRateMeasurementUUID,
                  let data = characteristic.value,
                  let heartRate = self.parseHeartRate(data) else {
                return
            }

            let measuredAt = Date().timeIntervalSince1970 * 1000
            self.latestHeartRate = heartRate
            self.latestSignalAt = measuredAt

            self.notifyListeners("heartRate", data: [
                "heartRate": heartRate,
                "measuredAt": measuredAt
            ])
        }
    }

    private func ensureCentralManager() {
        if centralManager == nil {
            centralManager = CBCentralManager(delegate: self, queue: nil)
        }
    }

    private func beginScan() {
        guard let manager = centralManager else {
            rejectPendingConnect("Bluetooth is unavailable on this iPhone.")
            return
        }

        discoveredPeripherals.removeAll()
        discoveredPeripheralNames.removeAll()
        discoveredPeripheralHeartRateAds.removeAll()
        attemptedPeripheralIDs.removeAll()
        cancelScanTimeout()
        manager.stopScan()
        manager.scanForPeripherals(withServices: nil, options: [
            CBCentralManagerScanOptionAllowDuplicatesKey: false
        ])
        scheduleScanTimeout()
    }

    private func scheduleScanTimeout() {
        let workItem = DispatchWorkItem { [weak self] in
            self?.finishScanIfNeeded()
        }

        scanTimeoutWorkItem = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + 15, execute: workItem)
    }

    private func cancelScanTimeout() {
        scanTimeoutWorkItem?.cancel()
        scanTimeoutWorkItem = nil
    }

    private func finishScanIfNeeded() {
        centralManager?.stopScan()
        cancelScanTimeout()

        if activePeripheral != nil {
            return
        }

        if let peripheral = preferredPeripheral() {
            let name = discoveredPeripheralNames[peripheral.identifier] ?? resolveDeviceName(peripheral)
            connectToPeripheral(peripheral, name: name)
            return
        }

        connectionState = "error"
        let message = buildNoBroadcastFoundMessage()
        emitStatus(errorMessage: message)
        rejectPendingConnect(message)
    }

    private func preferredPeripheral() -> CBPeripheral? {
        let allPeripherals = Array(discoveredPeripherals.values)
            .filter { !attemptedPeripheralIDs.contains($0.identifier) }

        let scoredPeripherals = allPeripherals.map { peripheral in
            let name = discoveredPeripheralNames[peripheral.identifier] ?? resolveDeviceName(peripheral)
            let advertisesHeartRate = discoveredPeripheralHeartRateAds[peripheral.identifier] ?? false
            return (
                peripheral: peripheral,
                score: peripheralScore(name: name, advertisesHeartRate: advertisesHeartRate),
                name: name
            )
        }

        guard let best = scoredPeripherals
            .sorted(by: { lhs, rhs in
                if lhs.score != rhs.score {
                    return lhs.score > rhs.score
                }
                return lhs.name < rhs.name
            })
            .first,
              best.score > 0 else {
            return nil
        }

        return best.peripheral
    }

    private func connectToPeripheral(_ peripheral: CBPeripheral, name: String) {
        cancelScanTimeout()
        centralManager?.stopScan()

        if activePeripheral?.identifier != peripheral.identifier {
            cleanupPeripheral(keepLastReading: false)
        }

        activePeripheral = peripheral
        deviceName = name
        peripheral.delegate = self
        NSLog("[EasePulse][BLE] Attempting connection to %@", name)
        centralManager?.connect(peripheral, options: nil)
        emitStatus()
    }

    private func cleanupPeripheral(keepLastReading: Bool) {
        cancelScanTimeout()
        centralManager?.stopScan()

        if let peripheral = activePeripheral,
           let characteristic = heartRateCharacteristic {
            peripheral.setNotifyValue(false, for: characteristic)
        }

        activePeripheral?.delegate = nil
        activePeripheral = nil
        heartRateCharacteristic = nil
        deviceName = ""

        if !keepLastReading {
            latestHeartRate = nil
            latestSignalAt = nil
        }
    }

    private func handleCandidateFailure(_ message: String) {
        NSLog("[EasePulse][BLE] Candidate failed: %@", message)
        if let peripheral = activePeripheral {
            attemptedPeripheralIDs.insert(peripheral.identifier)
            centralManager?.cancelPeripheralConnection(peripheral)
        }

        cleanupPeripheral(keepLastReading: false)

        if let nextPeripheral = preferredPeripheral() {
            connectionState = "connecting"
            emitStatus(errorMessage: message)
            let name = discoveredPeripheralNames[nextPeripheral.identifier] ?? resolveDeviceName(nextPeripheral)
            connectToPeripheral(nextPeripheral, name: name)
            return
        }

        connectionState = "error"
        emitStatus(errorMessage: message)

        if pendingConnectCall != nil {
            rejectPendingConnect(message)
        }
    }

    private func resolvePendingConnect() {
        guard let call = pendingConnectCall else {
            return
        }

        pendingConnectCall = nil
        bridge?.releaseCall(call)
        call.resolve(statusPayload())
    }

    private func rejectPendingConnect(_ message: String) {
        cancelScanTimeout()
        centralManager?.stopScan()

        guard let call = pendingConnectCall else {
            return
        }

        pendingConnectCall = nil
        bridge?.releaseCall(call)
        call.reject(message)
    }

    private func emitStatus(errorMessage: String? = nil) {
        notifyListeners("statusChange", data: statusPayload(errorMessage: errorMessage))
    }

    private func statusPayload(errorMessage: String? = nil) -> [String: Any] {
        var payload: [String: Any] = [
            "state": connectionState
        ]

        if !deviceName.isEmpty {
            payload["deviceName"] = deviceName
        }

        if let latestHeartRate {
            payload["heartRate"] = latestHeartRate
        }

        if let latestSignalAt {
            payload["lastSignalAt"] = latestSignalAt
        }

        if let errorMessage, !errorMessage.isEmpty {
            payload["errorMessage"] = errorMessage
        }

        return payload
    }

    private func resolveDeviceName(_ peripheral: CBPeripheral, advertisedName: String? = nil) -> String {
        let rawName = advertisedName ?? peripheral.name ?? ""
        return rawName.isEmpty ? "Heart-rate broadcast device" : rawName
    }

    private func peripheralScore(name: String, advertisesHeartRate: Bool) -> Int {
        if advertisesHeartRate && isPreferredDeviceName(name) {
            return 3
        }

        if isPreferredDeviceName(name) {
            return 2
        }

        if advertisesHeartRate {
            return 1
        }

        return 0
    }

    private func isPreferredDeviceName(_ name: String) -> Bool {
        let normalized = name.lowercased()
        return normalized.contains("huawei") || normalized.contains("band 9") || normalized.contains("band-9") || normalized.contains("band")
    }

    private func buildNoBroadcastFoundMessage() -> String {
        let matchedNames = discoveredPeripheralNames.values
            .filter { peripheralScore(name: $0, advertisesHeartRate: true) > 0 || isPreferredDeviceName($0) }
            .sorted()

        let allNames = Array(Set(discoveredPeripheralNames.values)).sorted()
        if !allNames.isEmpty {
            NSLog("[EasePulse][BLE] Scan finished. Nearby peripherals: %@", allNames.joined(separator: ", "))
        } else {
            NSLog("[EasePulse][BLE] Scan finished. No peripherals discovered.")
        }

        if matchedNames.isEmpty {
            return "No Band 9 heart-rate broadcast was found. Keep HR Data Broadcasts on, stay in workout mode, keep the band screen awake, and move Huawei Health to the background."
        }

        let preview = matchedNames.prefix(3).joined(separator: ", ")
        return "Nearby candidates were found (\(preview)), but none exposed a usable heart-rate stream. Keep HR Data Broadcasts on, stay in workout mode, and try again with Huawei Health in the background."
    }

    private func parseHeartRate(_ data: Data) -> Int? {
        guard data.count >= 2 else {
            return nil
        }

        let flags = data[0]
        let usesUInt16 = (flags & 0x01) == 0x01

        if usesUInt16 {
            guard data.count >= 3 else {
                return nil
            }

            return Int(UInt16(data[1]) | (UInt16(data[2]) << 8))
        }

        return Int(data[1])
    }

    private func stateForManager(_ state: CBManagerState) -> String {
        switch state {
        case .unsupported, .unauthorized:
            return "unsupported"
        case .poweredOff:
            return "error"
        case .poweredOn:
            return connectionState
        case .unknown, .resetting:
            return "connecting"
        @unknown default:
            return "error"
        }
    }
}

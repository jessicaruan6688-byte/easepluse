import Foundation
import Capacitor
import HealthKit

@objc(HealthBridgePlugin)
public class HealthBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthBridgePlugin"
    public let jsName = "HealthBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAuthorizationStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getDailySummary", returnType: CAPPluginReturnPromise)
    ]

    private let healthStore = HKHealthStore()
    private let baselineDays = 14
    private let countPerMinuteUnit = HKUnit.count().unitDivided(by: HKUnit.minute())

    @objc func isAvailable(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve(self.authorizationPayload())
        }
    }

    @objc func getAuthorizationStatus(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve(self.authorizationPayload())
        }
    }

    @objc public override func requestPermissions(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard HKHealthStore.isHealthDataAvailable() else {
                call.resolve(self.authorizationPayload())
                return
            }

            let readTypes = self.readTypes()
            guard !readTypes.isEmpty else {
                call.reject("No Apple Health data types are configured for EasePulse.")
                return
            }

            let shareTypes = Set<HKSampleType>()
            self.healthStore.requestAuthorization(toShare: shareTypes, read: readTypes) { _, error in
                DispatchQueue.main.async {
                    if let error {
                        call.reject(error.localizedDescription)
                        return
                    }

                    call.resolve(self.authorizationPayload())
                }
            }
        }
    }

    @objc func getDailySummary(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard HKHealthStore.isHealthDataAvailable() else {
                call.reject("Apple Health is unavailable on this device.")
                return
            }

            let authorizationStatus = self.aggregatePermissionStatus()
            if authorizationStatus == "notDetermined" {
                call.reject("Apple Health permission has not been requested yet.")
                return
            }

            let calendar = Calendar.current
            let now = Date()
            let todayStart = calendar.startOfDay(for: now)
            let todayEnd = calendar.date(byAdding: .day, value: 1, to: todayStart) ?? now
            let sleepWindowStart =
                calendar.date(byAdding: .hour, value: -18, to: todayStart)
                ?? todayStart.addingTimeInterval(-18 * 60 * 60)
            let sleepWindowEnd =
                min(
                    now,
                    calendar.date(byAdding: .hour, value: 12, to: todayStart)
                        ?? todayEnd
                )
            let baselineStart =
                calendar.date(byAdding: .day, value: -self.baselineDays, to: todayStart)
                ?? todayStart.addingTimeInterval(Double(-self.baselineDays) * 24 * 60 * 60)

            let group = DispatchGroup()
            var errors: [String] = []

            var sleepHours: Double?
            var sleepSampleCount = 0
            var restingHeartRate: Double?
            var latestHeartRate: Double?
            var heartRateSampleCount = 0
            var baselineRestingHeartRate: Double?
            var stepCount: Double?
            var activeEnergyKcal: Double?
            var exerciseMinutes: Double?

            group.enter()
            self.querySleepHours(start: sleepWindowStart, end: sleepWindowEnd) { hours, sampleCount, error in
                sleepHours = hours
                sleepSampleCount = sampleCount
                if let error {
                    errors.append("sleepAnalysis: \(error.localizedDescription)")
                }
                group.leave()
            }

            group.enter()
            self.queryAverageQuantity(
                identifier: .restingHeartRate,
                unit: self.countPerMinuteUnit,
                start: todayStart,
                end: todayEnd
            ) { value, error in
                restingHeartRate = value
                if let error {
                    errors.append("restingHeartRate: \(error.localizedDescription)")
                }
                group.leave()
            }

            group.enter()
            self.queryAverageQuantity(
                identifier: .restingHeartRate,
                unit: self.countPerMinuteUnit,
                start: baselineStart,
                end: todayStart
            ) { value, error in
                baselineRestingHeartRate = value
                if let error {
                    errors.append("baselineRestingHeartRate: \(error.localizedDescription)")
                }
                group.leave()
            }

            group.enter()
            self.queryLatestHeartRate(start: todayStart, end: todayEnd) { value, sampleCount, error in
                latestHeartRate = value
                heartRateSampleCount = sampleCount
                if let error {
                    errors.append("heartRate: \(error.localizedDescription)")
                }
                group.leave()
            }

            group.enter()
            self.queryCumulativeQuantity(
                identifier: .stepCount,
                unit: HKUnit.count(),
                start: todayStart,
                end: todayEnd
            ) { value, error in
                stepCount = value
                if let error {
                    errors.append("stepCount: \(error.localizedDescription)")
                }
                group.leave()
            }

            group.enter()
            self.queryCumulativeQuantity(
                identifier: .activeEnergyBurned,
                unit: HKUnit.kilocalorie(),
                start: todayStart,
                end: todayEnd
            ) { value, error in
                activeEnergyKcal = value
                if let error {
                    errors.append("activeEnergyBurned: \(error.localizedDescription)")
                }
                group.leave()
            }

            group.enter()
            self.queryCumulativeQuantity(
                identifier: .appleExerciseTime,
                unit: HKUnit.minute(),
                start: todayStart,
                end: todayEnd
            ) { value, error in
                exerciseMinutes = value
                if let error {
                    errors.append("appleExerciseTime: \(error.localizedDescription)")
                }
                group.leave()
            }

            group.notify(queue: .main) {
                var metrics: [String: Any] = [:]
                if let sleepHours {
                    metrics["sleepHours"] = self.round(sleepHours, digits: 1)
                }
                if let restingHeartRate {
                    metrics["restingHeartRate"] = self.round(restingHeartRate, digits: 0)
                }
                if let latestHeartRate {
                    metrics["latestHeartRate"] = self.round(latestHeartRate, digits: 0)
                }
                if let baselineRestingHeartRate {
                    metrics["baselineRestingHeartRate"] = self.round(baselineRestingHeartRate, digits: 0)
                }
                if let stepCount {
                    metrics["stepCount"] = self.round(stepCount, digits: 0)
                }
                if let activeEnergyKcal {
                    metrics["activeEnergyKcal"] = self.round(activeEnergyKcal, digits: 0)
                }
                if let exerciseMinutes {
                    metrics["exerciseMinutes"] = self.round(exerciseMinutes, digits: 0)
                }

                var payload: [String: Any] = [
                    "source": "appleHealth",
                    "fetchedAt": self.toMillis(now),
                    "todayStart": self.toMillis(todayStart),
                    "todayEnd": self.toMillis(todayEnd),
                    "sleepWindowStart": self.toMillis(sleepWindowStart),
                    "sleepWindowEnd": self.toMillis(sleepWindowEnd),
                    "permissions": self.metricPermissionStates(),
                    "coverage": [
                        "sleepSampleCount": sleepSampleCount,
                        "heartRateSampleCount": heartRateSampleCount,
                        "baselineDays": self.baselineDays
                    ],
                    "metrics": metrics
                ]

                if !errors.isEmpty {
                    payload["errors"] = errors
                }

                call.resolve(payload)
            }
        }
    }

    private func readTypes() -> Set<HKObjectType> {
        var types = Set<HKObjectType>()

        if let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
            types.insert(sleepType)
        }

        let quantityIdentifiers: [HKQuantityTypeIdentifier] = [
            .restingHeartRate,
            .heartRate,
            .stepCount,
            .activeEnergyBurned,
            .appleExerciseTime
        ]

        for identifier in quantityIdentifiers {
            if let type = HKObjectType.quantityType(forIdentifier: identifier) {
                types.insert(type)
            }
        }

        return types
    }

    private func metricPermissionStates() -> [String: String] {
        var permissions: [String: String] = [:]

        if let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
            permissions["sleepAnalysis"] = permissionState(for: type)
        } else {
            permissions["sleepAnalysis"] = "unavailable"
        }

        let quantityTypes: [(String, HKQuantityTypeIdentifier)] = [
            ("restingHeartRate", .restingHeartRate),
            ("heartRate", .heartRate),
            ("stepCount", .stepCount),
            ("activeEnergyBurned", .activeEnergyBurned),
            ("appleExerciseTime", .appleExerciseTime)
        ]

        for (key, identifier) in quantityTypes {
            if let type = HKObjectType.quantityType(forIdentifier: identifier) {
                permissions[key] = permissionState(for: type)
            } else {
                permissions[key] = "unavailable"
            }
        }

        return permissions
    }

    private func authorizationPayload() -> [String: Any] {
        let permissions = metricPermissionStates()
        return [
            "available": HKHealthStore.isHealthDataAvailable(),
            "status": aggregatePermissionStatus(from: permissions),
            "permissions": permissions
        ]
    }

    private func aggregatePermissionStatus() -> String {
        aggregatePermissionStatus(from: metricPermissionStates())
    }

    private func aggregatePermissionStatus(from permissions: [String: String]) -> String {
        let statuses = Array(permissions.values)

        if statuses.isEmpty || statuses.allSatisfy({ $0 == "unavailable" }) {
            return "unavailable"
        }

        let hasAuthorized = statuses.contains("sharingAuthorized")
        let hasDenied = statuses.contains("sharingDenied")
        let hasNotDetermined = statuses.contains("notDetermined")

        if statuses.allSatisfy({ $0 == "sharingAuthorized" || $0 == "unavailable" }) {
            return "sharingAuthorized"
        }

        if hasAuthorized && (hasDenied || hasNotDetermined) {
            return "partiallyAuthorized"
        }

        if hasNotDetermined {
            return "notDetermined"
        }

        if hasDenied {
            return "sharingDenied"
        }

        return "unavailable"
    }

    private func permissionState(for type: HKObjectType) -> String {
        switch healthStore.authorizationStatus(for: type) {
        case .sharingAuthorized:
            return "sharingAuthorized"
        case .sharingDenied:
            return "sharingDenied"
        case .notDetermined:
            return "notDetermined"
        @unknown default:
            return "unavailable"
        }
    }

    private func querySleepHours(start: Date, end: Date, completion: @escaping (Double?, Int, Error?) -> Void) {
        guard let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else {
            completion(nil, 0, nil)
            return
        }

        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        let query = HKSampleQuery(
            sampleType: type,
            predicate: predicate,
            limit: HKObjectQueryNoLimit,
            sortDescriptors: nil
        ) { _, samples, error in
            if let error {
                completion(nil, 0, error)
                return
            }

            let sleepSamples = (samples as? [HKCategorySample]) ?? []
            let totalSeconds = sleepSamples.reduce(0.0) { partialResult, sample in
                if self.isAsleepCategory(sample.value) {
                    return partialResult + sample.endDate.timeIntervalSince(sample.startDate)
                }
                return partialResult
            }

            let hours = totalSeconds > 0 ? totalSeconds / 3600 : nil
            completion(hours, sleepSamples.count, nil)
        }

        healthStore.execute(query)
    }

    private func queryAverageQuantity(
        identifier: HKQuantityTypeIdentifier,
        unit: HKUnit,
        start: Date,
        end: Date,
        completion: @escaping (Double?, Error?) -> Void
    ) {
        guard let type = HKObjectType.quantityType(forIdentifier: identifier) else {
            completion(nil, nil)
            return
        }

        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        let query = HKStatisticsQuery(
            quantityType: type,
            quantitySamplePredicate: predicate,
            options: .discreteAverage
        ) { _, statistics, error in
            if let error {
                completion(nil, error)
                return
            }

            let value = statistics?.averageQuantity()?.doubleValue(for: unit)
            completion(value, nil)
        }

        healthStore.execute(query)
    }

    private func queryCumulativeQuantity(
        identifier: HKQuantityTypeIdentifier,
        unit: HKUnit,
        start: Date,
        end: Date,
        completion: @escaping (Double?, Error?) -> Void
    ) {
        guard let type = HKObjectType.quantityType(forIdentifier: identifier) else {
            completion(nil, nil)
            return
        }

        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        let query = HKStatisticsQuery(
            quantityType: type,
            quantitySamplePredicate: predicate,
            options: .cumulativeSum
        ) { _, statistics, error in
            if let error {
                completion(nil, error)
                return
            }

            let value = statistics?.sumQuantity()?.doubleValue(for: unit)
            completion(value, nil)
        }

        healthStore.execute(query)
    }

    private func queryLatestHeartRate(
        start: Date,
        end: Date,
        completion: @escaping (Double?, Int, Error?) -> Void
    ) {
        guard let type = HKObjectType.quantityType(forIdentifier: .heartRate) else {
            completion(nil, 0, nil)
            return
        }

        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        let sortDescriptors = [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]
        let query = HKSampleQuery(
            sampleType: type,
            predicate: predicate,
            limit: HKObjectQueryNoLimit,
            sortDescriptors: sortDescriptors
        ) { _, samples, error in
            if let error {
                completion(nil, 0, error)
                return
            }

            let quantitySamples = (samples as? [HKQuantitySample]) ?? []
            let latestValue = quantitySamples.first?.quantity.doubleValue(for: self.countPerMinuteUnit)
            completion(latestValue, quantitySamples.count, nil)
        }

        healthStore.execute(query)
    }

    private func isAsleepCategory(_ value: Int) -> Bool {
        if #available(iOS 16.0, *) {
            let validValues = [
                HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue,
                HKCategoryValueSleepAnalysis.asleepCore.rawValue,
                HKCategoryValueSleepAnalysis.asleepDeep.rawValue,
                HKCategoryValueSleepAnalysis.asleepREM.rawValue
            ]
            return validValues.contains(value)
        }

        return value == HKCategoryValueSleepAnalysis.asleep.rawValue
    }

    private func round(_ value: Double, digits: Int) -> Double {
        let factor = pow(10.0, Double(digits))
        return (value * factor).rounded() / factor
    }

    private func toMillis(_ date: Date) -> Double {
        date.timeIntervalSince1970 * 1000
    }
}

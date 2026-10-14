import AppKit
import Foundation
import PostHog

/// Metadata-only product telemetry. PostHog owns the bounded, persistent retry
/// queue. Development builds have no token unless explicitly packaged with one.
@MainActor
final class NativeAnalytics {
    static let shared = NativeAnalytics()
    private var enabled = false
    private var userID: String?
    private var heartbeat: Timer?
    private var context: [String: Any] = [:]
    private var operationStarts: [UUID: Date] = [:]

    static func metadata(bundle: Bundle = .main) -> [String: String] {
        let version = bundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "development"
        #if arch(arm64)
        let architecture = "arm64"
        #else
        let architecture = "x86_64"
        #endif
        return ["app_version": version,
                "app_build": bundle.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "development",
                "build_commit": bundle.object(forInfoDictionaryKey: "YapperBuildCommit") as? String ?? "unknown",
                "os_version": ProcessInfo.processInfo.operatingSystemVersionString,
                "architecture": architecture]
    }

    func start() {
        guard !enabled,
              let token = Bundle.main.object(forInfoDictionaryKey: "YapperPostHogToken") as? String,
              token.hasPrefix("phc_") else { return }
        let defaults = UserDefaults.standard
        let installationID = defaults.string(forKey: "analyticsInstallationID") ?? UUID().uuidString
        defaults.set(installationID, forKey: "analyticsInstallationID")
        let config = PostHogConfig(projectToken: token, host: "https://us.i.posthog.com")
        config.captureApplicationLifecycleEvents = false
        config.captureScreenViews = false
        config.enableSwizzling = false
        config.preloadFeatureFlags = false
        config.remoteConfig = false
        config.flushAt = 10
        config.maxQueueSize = 1000
        config.flushIntervalSeconds = 20
        PostHogSDK.shared.setup(config)
        // Wait for Clerk before attributing this launch to a remembered account.
        PostHogSDK.shared.reset()
        context = Self.metadata().mapValues { $0 as Any }
        context.merge(["product": "studio", "surface": "macos", "client": "native",
                       "environment": Bundle.main.object(forInfoDictionaryKey: "YapperAnalyticsEnvironment") as? String ?? "development",
                       "analytics_schema_version": 1, "installation_id": installationID]) { _, new in new }
        PostHogSDK.shared.register(context)
        enabled = true
        let environment = context["environment"] as? String ?? "development"
        let firstObservedKey = "analyticsFirstObserved.\(environment)"
        if !defaults.bool(forKey: firstObservedKey) {
            capture("native_first_observed")
            defaults.set(true, forKey: firstObservedKey)
        }
        let version = Self.metadata()["app_version"]!
        if let previous = defaults.string(forKey: "analyticsLastVersion"), previous != version {
            capture("native_app_updated", ["previous_version": previous])
        }
        defaults.set(version, forKey: "analyticsLastVersion")
        capture("native_app_opened")
        heartbeat = Timer.scheduledTimer(withTimeInterval: 300, repeats: true) { _ in
            Task { @MainActor in
                guard NSApp.isActive else { return }
                NativeAnalytics.shared.capture("native_app_active")
            }
        }
    }

    func identify(_ next: String?) {
        guard enabled, next != userID else { return }
        if userID != nil {
            PostHogSDK.shared.reset()
            PostHogSDK.shared.register(context)
        }
        userID = next
        if let next {
            PostHogSDK.shared.identify(next)
            capture("account_signed_in")
        }
    }

    func capture(_ event: String, _ properties: [String: Any] = [:]) {
        guard enabled else { return }
        PostHogSDK.shared.capture(event, properties: properties)
    }

    func begin(_ lease: LongOperationLease) {
        guard enabled else { return }
        operationStarts[lease.token] = Date()
        capture("native_operation_started", ["operation": String(describing: lease.operation), "operation_id": lease.token.uuidString])
    }

    func end(_ lease: LongOperationLease) {
        guard let started = operationStarts.removeValue(forKey: lease.token) else { return }
        capture("native_operation_finished", ["operation": String(describing: lease.operation), "operation_id": lease.token.uuidString, "elapsed_seconds": Date().timeIntervalSince(started)])
    }

    func flush() {
        guard enabled else { return }
        PostHogSDK.shared.flush()
    }
}

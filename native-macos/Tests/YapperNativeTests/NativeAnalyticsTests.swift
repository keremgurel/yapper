import Foundation
import Testing
@testable import YapperNative

@Suite @MainActor
struct NativeAnalyticsTests {
    @Test func developmentMetadataContainsNoUserContent() {
        let metadata = NativeAnalytics.metadata()
        #expect(Set(metadata.keys) == ["app_version", "app_build", "build_commit", "os_version", "architecture"])
        #expect(["arm64", "x86_64"].contains(metadata["architecture"]!))
    }
    @Test func unconfiguredTrackingDoesNotRequireNetworkOrAnAccount() {
        let analytics = NativeAnalytics()
        analytics.start()
        analytics.identify("test-account")
        analytics.capture("native_project_created")
        analytics.identify(nil)
        analytics.flush()
    }
}

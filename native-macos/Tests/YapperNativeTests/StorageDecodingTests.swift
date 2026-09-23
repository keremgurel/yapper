import Foundation
import Testing
@testable import YapperNative

struct StorageDecodingTests {
    private let subscribed = """
    {
      "plan":{"key":"creator_monthly","name":"Monthly"},
      "usedBytes":3758096384,
      "reservedBytes":52428800,
      "reservedCount":1,
      "committedBytes":3810525184,
      "quotaBytes":53687091200,
      "percent":7.09765625,
      "pressure":"roomy",
      "media":{
        "recording":{"bytes":3221225472,"count":14},
        "import":{"bytes":429496729.6,"count":3},
        "thumbnail":{"bytes":104857600,"count":22},
        "brandLogo":{"bytes":2516582,"count":1}
      },
      "workspace":{"estimatedBytes":1843200.5,"brainBlocks":37,"brainSkills":4,"contentIdeas":112,"contentLibrary":58,"savedViews":3},
      "plans":[
        {"key":"creator_weekly","name":"Weekly","storageBytes":26843545600,"storageLabel":"25 GB"},
        {"key":"creator_monthly","name":"Monthly","storageBytes":53687091200,"storageLabel":"50 GB"},
        {"key":"creator_yearly","name":"Yearly","storageBytes":107374182400,"storageLabel":"100 GB"}
      ]
    }
    """

    private let free = """
    {
      "plan":null,"usedBytes":0,"reservedBytes":0,"reservedCount":0,"committedBytes":0,
      "quotaBytes":2147483648,"percent":0,"pressure":"critical",
      "media":{"recording":{"bytes":0,"count":0},"import":{"bytes":0,"count":0},"thumbnail":{"bytes":0,"count":0},"brandLogo":{"bytes":0,"count":0}},
      "workspace":{"estimatedBytes":0,"brainBlocks":0,"brainSkills":0,"contentIdeas":0,"contentLibrary":0,"savedViews":0},
      "plans":[]
    }
    """

    private func decode(_ json: String) throws -> StorageUsage {
        try StudioJSONClient.decoder.decode(StorageUsage.self, from: Data(json.utf8))
    }

    @Test func subscribedAccountDecodes() throws {
        let usage = try decode(subscribed)
        #expect(usage.plan?.name == "Monthly")
        #expect(usage.pressure == .roomy)
        #expect(usage.media.recording.count == 14)
        #expect(usage.media.brandLogo.count == 1)
        #expect(usage.workspace.contentIdeas == 112)
        #expect(usage.plans.map(\.storageLabel) == ["25 GB", "50 GB", "100 GB"])
        #expect(usage.freeBytes == 53687091200 - 3810525184)
        #expect(usage.headroom(on: usage.plans[0]) == 26843545600 - 3810525184)
    }

    @Test func freeAccountDecodesWithoutAPlan() throws {
        let usage = try decode(free)
        #expect(usage.plan == nil)
        #expect(usage.pressure == .critical)
        #expect(usage.pressure.label == "Storage almost full")
    }

    @Test func bytesFormatLikeTheWeb() {
        #expect(StorageFormat.bytes(0) == "0 B")
        #expect(StorageFormat.bytes(512) == "512 B")
        #expect(StorageFormat.bytes(1536) == "1.50 KB")
        #expect(StorageFormat.bytes(3758096384) == "3.50 GB")
        #expect(StorageFormat.bytes(53687091200) == "50.0 GB")
        #expect(StorageFormat.bytes(107374182400) == "100 GB")
    }

    @Test func percentKeepsTwoDecimalsUnderOne() {
        #expect(StorageFormat.percent(0.4) == "0.40%")
        #expect(StorageFormat.percent(7.09765625) == "7.1%")
    }
}

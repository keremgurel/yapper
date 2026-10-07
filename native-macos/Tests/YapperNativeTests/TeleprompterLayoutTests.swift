import Foundation
import Testing
@testable import YapperNative

struct TeleprompterLayoutTests {
    let bounds = CGSize(width: 1000, height: 600)
    let box = CGRect(x: 200, y: 120, width: 400, height: 240)

    @Test func moveTracksPointerAndStopsAtPreviewEdges() {
        let moved = TeleprompterLayout.adjusting(box, handle: nil, by: CGSize(width: 73, height: 42), in: bounds)
        #expect(moved == CGRect(x: 273, y: 162, width: 400, height: 240))
        let bounded = TeleprompterLayout.adjusting(box, handle: nil, by: CGSize(width: 2000, height: -2000), in: bounds)
        #expect(bounded == CGRect(x: 600, y: 0, width: 400, height: 240))
    }

    @Test func cornerResizeKeepsOppositeCornerFixed() {
        let resized = TeleprompterLayout.adjusting(box, handle: .topLeft, by: CGSize(width: 50, height: 30), in: bounds)
        #expect(resized == CGRect(x: 250, y: 150, width: 350, height: 210))
        #expect(resized.maxX == box.maxX && resized.maxY == box.maxY)
    }

    @Test(arguments: TeleprompterLayout.Handle.allCases)
    func everyHandleRespectsMinimumAndMaximumSize(_ handle: TeleprompterLayout.Handle) {
        for delta in [CGSize(width: 5000, height: 5000), CGSize(width: -5000, height: -5000)] {
            let result = TeleprompterLayout.adjusting(box, handle: handle, by: delta, in: bounds)
            #expect(result.width >= 180 && result.height >= 96)
            #expect(result.minX >= 0 && result.minY >= 0)
            #expect(result.maxX <= bounds.width && result.maxY <= bounds.height)
        }
    }

    @Test func savedFractionsAdaptWithoutOverwritingTheOriginalLayout() {
        let layout = TeleprompterLayout(frame: box, in: bounds)
        #expect(layout.frame(in: CGSize(width: 500, height: 300)) == CGRect(x: 100, y: 60, width: 200, height: 120))
        let narrow = layout.frame(in: CGSize(width: 200, height: 600))
        #expect(narrow.width == 180 && narrow.maxX <= 200)
        #expect(layout.frame(in: bounds) == box)
    }

    @Test func tinyPreviewAndInvalidSavedGeometryStayReachable() {
        let invalid = TeleprompterLayout(x: .infinity, y: -4, width: .nan, height: 200)
        #expect(invalid.frame(in: CGSize(width: 100, height: 70)) == CGRect(x: 0, y: 0, width: 100, height: 70))
        #expect(invalid.frame(in: .zero) == .zero)
    }
}

@MainActor
struct TeleprompterLayoutPersistenceTests {
    @Test func oldSettingsKeepSpeedSizeAndHeight() throws {
        let old = Data(#"{"framing":"auto","fontScale":1.2,"heightFraction":0.6,"shade":0.75,"leadInSeconds":3,"wordsPerMinute":190}"#.utf8)
        let settings = try JSONDecoder().decode(TeleprompterSettings.self, from: old)
        #expect(settings.layout == nil)
        #expect(settings.fontScale == 1.2 && settings.wordsPerMinute == 190)
        #expect(settings.promptLayout.height == 0.6)
    }

    @Test func newStoreRestoresTheLastLayoutAndReadingSettings() throws {
        let suite = "teleprompter-layout-test-\(UUID())"
        let defaults = try #require(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let store = TeleprompterSettingsStore(defaults: defaults)
        store.settings.wordsPerMinute = 175
        store.settings.fontScale = 1.35
        store.settings.promptLayout = TeleprompterLayout(x: 0.3, y: 0.4, width: 0.5, height: 0.3)
        let restored = TeleprompterSettingsStore(defaults: defaults)
        #expect(restored.settings == store.settings)
    }
}

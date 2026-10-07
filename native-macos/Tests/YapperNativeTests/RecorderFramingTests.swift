import AVFoundation
import Testing
@testable import YapperNative

struct RecorderFramingTests {
    @Test func automaticPreservesSource() {
        #expect(RecorderFraming.auto.ratio(source: 4.0 / 3) == 4.0 / 3)
        #expect(RecorderFraming.portrait.ratio(source: 4.0 / 3) == 9.0 / 16)
    }
    @Test func cropStaysInsideSourceAndUsesEvenDimensions() {
        let source = CGSize(width: 1920, height: 1080)
        let crop = RecorderFraming.cropSize(source: source, ratio: 9.0 / 16)
        #expect(crop.width == 606)
        #expect(crop.height == 1080)
        #expect(crop.width <= source.width)
        #expect(crop.height <= source.height)
    }
}

@MainActor
struct RecorderFramingExportTests {
    @Test("Portrait framing is baked into the saved file")
    func portraitExport() async throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("framing-\(UUID()).mov")
        try await SyntheticVideo.write(color: CGColor(gray: 0.4, alpha: 1), size: CGSize(width: 640, height: 360), to: url)
        let take = try #require(await RecorderTakeFinisher.finish(url, framing: .portrait))
        defer { take.discard(); try? FileManager.default.removeItem(at: url) }
        #expect(take.hasVideo)
        #expect(take.warning == nil)
        #expect(abs(take.aspectRatio - 9.0 / 16) < 0.01)
        let track = try #require(try await AVURLAsset(url: take.url).loadTracks(withMediaType: .video).first)
        let size = try await track.load(.naturalSize)
        #expect(size.width == 202)
        #expect(size.height == 360)
    }
}

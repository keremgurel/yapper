@preconcurrency import AVFoundation
import AppKit
import Testing
@testable import YapperNative

@MainActor
@Suite(.serialized)
struct CaptionOutlineExportTests {
    @Test("Caption outlines preserve the fill in both standard and filtered exports",
          arguments: [VisualFilterID.original, .mono])
    func outlinePreservesExportedLetters(filter: VisualFilterID) async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let source = directory.appending(path: "source.mov")
        try await SyntheticVideo.write(color: CGColor(gray: 0.1, alpha: 1),
                                       size: CGSize(width: 720, height: 720), to: source)
        let media = try await MediaProbe.inspect(url: source)
        var images: [NSBitmapImageRep] = []
        for outlined in [false, true] {
            let appearance = TextAppearance(fontScale: 0.1,
                color: StudioColor(red: 1, green: 0, blue: 1),
                strokeEnabled: outlined, strokeWidth: 0.019045770877944318,
                shadowEnabled: false)
            let project = EditorProject(name: "Outline export regression", media: [media],
                clips: [TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: 1)],
                transcript: [TranscriptWord(mediaID: media.id, text: "able", start: 0.1, end: 0.9)],
                captionsEnabled: true, captionStyle: TextStyle(y: 0.5, appearance: appearance),
                visualFilter: VisualFilter(id: filter, strength: 1))
            let output = directory.appending(path: "\(outlined).mp4")
            try await ExportService.export(project: project, to: output)
            let generator = AVAssetImageGenerator(asset: AVURLAsset(url: output))
            generator.requestedTimeToleranceBefore = .zero
            generator.requestedTimeToleranceAfter = .zero
            let result = try await generator.image(at: CMTime(seconds: 0.5, preferredTimescale: 600))
            images.append(NSBitmapImageRep(cgImage: result.image))
        }
        let plain = images[0], outlined = images[1]
        #expect(plain.pixelsWide == outlined.pixelsWide)
        #expect(plain.pixelsHigh == outlined.pixelsHigh)
        var solid = 0, damaged = 0
        for y in 0..<plain.pixelsHigh {
            for x in 0..<plain.pixelsWide {
                guard let before = plain.colorAt(x: x, y: y),
                      before.redComponent > 0.95, before.blueComponent > 0.95,
                      before.greenComponent < 0.05 else { continue }
                solid += 1
                let after = try #require(outlined.colorAt(x: x, y: y))
                if after.redComponent < 0.85 || after.blueComponent < 0.85 { damaged += 1 }
            }
        }
        if solid <= 1_000 {
            // Diagnostic for a runner that decodes no magenta: what does the
            // frame actually hold where the caption should be?
            var loose = 0, bright = 0, maxRed = 0.0, maxBlue = 0.0, minGreen = 1.0
            for y in 0..<plain.pixelsHigh {
                for x in 0..<plain.pixelsWide {
                    guard let c = plain.colorAt(x: x, y: y) else { continue }
                    if c.redComponent > 0.8, c.blueComponent > 0.8, c.greenComponent < 0.3 { loose += 1 }
                    if c.redComponent > 0.5 || c.blueComponent > 0.5 { bright += 1 }
                    maxRed = max(maxRed, c.redComponent); maxBlue = max(maxBlue, c.blueComponent)
                    if c.redComponent > 0.5 { minGreen = min(minGreen, c.greenComponent) }
                }
            }
            let centre = plain.colorAt(x: plain.pixelsWide / 2, y: plain.pixelsHigh / 2)
            print("CAPTION-EXPORT-DIAG size=\(plain.pixelsWide)x\(plain.pixelsHigh) loose=\(loose) bright=\(bright) maxRed=\(maxRed) maxBlue=\(maxBlue) minGreenWhereRed=\(minGreen) centre=\(String(describing: centre)) colorSpace=\(String(describing: plain.colorSpace))")
        }
        #expect(solid > 1_000, "The caption must be visible and retain its color through the filter")
        #expect(damaged < solid / 100, "Outline cut through \(damaged) of \(solid) fill pixels")
    }
}

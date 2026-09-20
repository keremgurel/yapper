@preconcurrency import AVFoundation
import AppKit
import CoreImage
import ImageIO
import Testing
@testable import YapperNative

@MainActor
@Suite(.serialized)
struct HDRStillExportTests {
    @Test("An HDR gain map does not wash out a still in SDR video",
          arguments: [VisualFilterID.original, .mono])
    func gainMapPreservesSDRAppearance(filter: VisualFilterID) async throws {
        guard #available(macOS 15, *) else { return }
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let size = CGSize(width: 320, height: 180)
        let baseURL = directory.appending(path: "video.mov")
        try await SyntheticVideo.write(color: CGColor(gray: 0.1, alpha: 1), size: size, to: baseURL)
        let video = try await MediaProbe.inspect(url: baseURL)
        let space = try #require(CGColorSpace(name: CGColorSpace.displayP3))
        let color = try #require(CIColor(red: 0.25, green: 0.4, blue: 0.55, colorSpace: space))
        let sdr = CIImage(color: color).cropped(to: CGRect(origin: .zero, size: size))
        let hdr = sdr.applyingFilter("CIExposureAdjust", parameters: [kCIInputEVKey: 2])
        var frames: [CGImage] = []
        for hasGainMap in [false, true] {
            let imageURL = directory.appending(path: "\(hasGainMap).jpg")
            try CIContext().writeJPEGRepresentation(of: sdr, to: imageURL, colorSpace: space,
                                                    options: hasGainMap ? [.hdrImage: hdr] : [:])
            if hasGainMap {
                let source = try #require(CGImageSourceCreateWithURL(imageURL as CFURL, nil))
                #expect(CGImageSourceCopyAuxiliaryDataInfoAtIndex(source, 0, kCGImageAuxiliaryDataTypeHDRGainMap) != nil)
            }
            let image = try await MediaProbe.inspect(url: imageURL)
            let project = EditorProject(media: [video, image],
                clips: [TimelineClip(mediaID: video.id, sourceStart: 0, sourceEnd: 1)],
                overlays: [ProjectOverlay(mediaID: image.id, timelineStart: 0, duration: 1,
                                           x: 0, y: 0, width: 1, height: 1)],
                visualFilter: VisualFilter(id: filter, strength: 1))
            let output = directory.appending(path: "\(hasGainMap).mp4")
            try await ExportService.export(project: project, to: output)
            let generator = AVAssetImageGenerator(asset: AVURLAsset(url: output))
            let result = try await generator.image(at: CMTime(seconds: 0.5, preferredTimescale: 600))
            frames.append(result.image)
        }
        let reference = try #require(frames[0].sample(x: 160, y: 90))
        let actual = try #require(frames[1].sample(x: 160, y: 90))
        #expect(reference.blue > 50, "The overlay must be visible")
        #expect(abs(actual.red - reference.red) < 12)
        #expect(abs(actual.green - reference.green) < 12)
        #expect(abs(actual.blue - reference.blue) < 12)
    }
}

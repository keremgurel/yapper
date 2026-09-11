@preconcurrency import AVFoundation
import AppKit
import Foundation
import Testing
@testable import YapperNative

private actor NumberRevealTestStore: ProjectPersisting {
    func load() async throws -> EditorProject? { nil }
    func save(_: EditorProject) async throws {}
}

@MainActor
struct ImageNumberRevealTests {
    private func region(_ text: String, _ value: Double, currency: Bool = false) -> ImageNumberRevealService.Region {
        .init(text: text, value: value, currency: currency,
              box: CGRect(x: 0.1, y: 0.4, width: 0.2, height: 0.3), background: .white)
    }
    private func word(_ text: String, _ at: Double) -> TimelineInspectionService.TimedWord {
        .init(id: UUID(), text: text, at: at, end: at + 0.3)
    }

    @Test func routesOnlySpokenNumberReveals() {
        #expect(ImageNumberReveal.requested("can we make the @google ads.png one reveal the numbers as i say them instead of showing the full overlay all at once"))
        #expect(ImageNumberReveal.requested("show the metrics when I mention them"))
        #expect(!ImageNumberReveal.requested("place the overlay where it makes sense"))
        #expect(!ImageNumberReveal.requested("show the numbers all at once"))
    }

    @Test func bindsCurrencyAndCountsWhileKeepingUnspokenFiguresVisible() throws {
        let regions = [region("34", 34), region("291", 291), region("CA$1.10", 1.1, currency: true), region("CA$37.47", 37.47, currency: true)]
        let words = [word("spent", 6.2), word("$37", 6.52), word("That", 7.6), word("got", 7.85), word("me", 8.08), word("34", 8.25), word("clicks", 8.73)]
        let overlay = ProjectOverlay(mediaID: UUID(), timelineStart: 3.67, duration: 4.14)
        let cues = ImageNumberReveal.cues(regions: regions, words: words, overlay: overlay, projectDuration: 100)
        #expect(cues.map(\.region) == [3, 0])
        #expect(cues.map(\.at) == [6.52, 8.25])
        let scene = ImageNumberReveal.scene(regions: regions, cues: cues, start: overlay.timelineStart, duration: 6)
        let timeline = SceneTimeline(scene: scene)
        func opacity(_ index: Int, _ at: Double) throws -> Double {
            let node = try #require(scene.nodes.first { $0.id == "number-\(index)" })
            return SceneNodeState.resolve(node: node, timeline: timeline, at: at).opacity
        }
        #expect(try opacity(3, 2.8) == 1) // Cost is still hidden immediately before speech.
        #expect(try opacity(3, 3.1) == 0)
        #expect(try opacity(0, 3.1) == 1)
        #expect(try opacity(0, 4.9) == 0)
        #expect(!scene.nodes.contains { $0.id == "number-1" }) // Impressions are never covered.
        #expect(!scene.nodes.contains { $0.id == "number-2" }) // Neither is average CPC.
    }

    @Test func spokenPhrasesAreWholeNumbersAndSearchStaysNearTheOverlay() {
        let regions = [region("34", 34), region("4", 4), region("300", 300), region("3", 3), region("99", 99)]
        let words = [word("thirty", 2), word("four", 2.3), word("clicks", 2.6),
                     word("three", 4), word("hundred", 4.3), word("impressions", 4.6), word("99", 60)]
        let overlay = ProjectOverlay(mediaID: UUID(), timelineStart: 0, duration: 6)
        let cues = ImageNumberReveal.cues(regions: regions, words: words, overlay: overlay, projectDuration: 100)
        #expect(cues.map(\.region) == [0, 2])
        #expect(ImageNumberReveal.number("CA$37.47") == 37.47)
        #expect(ImageNumberReveal.number("1,234") == 1234)
        #expect(ImageNumberReveal.number("clicks 34") == nil)
    }

    @Test func chatCorrectionRemovesLegacyMasksWithoutDuplicatingTheOverlay() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: "reveal-correction-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let size = CGSize(width: 1000, height: 160)
        let context = try #require(CGContext(data: nil, width: Int(size.width), height: Int(size.height),
            bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpace(name: CGColorSpace.sRGB)!,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
        context.setFillColor(NSColor.white.cgColor)
        context.fill(CGRect(origin: .zero, size: size))
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
        for (index, value) in ["34", "291", "CA$1.10", "CA$37.47"].enumerated() {
            NSAttributedString(string: value, attributes: [.font: NSFont.systemFont(ofSize: 44),
                .foregroundColor: NSColor.black]).draw(at: CGPoint(x: 20 + index * 250, y: 50))
        }
        NSGraphicsContext.restoreGraphicsState()
        let sourceURL = root.appending(path: "google ads.png")
        let sourceImage = try #require(context.makeImage())
        let png = try #require(NSBitmapImageRep(cgImage: sourceImage).representation(using: .png, properties: [:]))
        try png.write(to: sourceURL)
        let source = try await MediaProbe.inspect(url: sourceURL)
        let prepared = try await ImageNumberRevealService().prepare(sourceURL)
        #expect(prepared.regions.map(\.value) == [34, 291, 1.1, 37.47])
        let cues: [ImageNumberReveal.Cue] = [.init(region: 3, at: 2, end: 2.3, spoken: "$37"),
                                           .init(region: 0, at: 4, end: 4.3, spoken: "34")]
        var legacyScene = ImageNumberReveal.scene(regions: prepared.regions, cues: cues, start: 0, duration: 6)
        // Recreate the old on-disk scene, including its permanent masks.
        for index in [1, 2] {
            let region = prepared.regions[index]
            var cover = SceneNode(id: "number-\(index)", kind: .rect, x: region.box.minX, y: region.box.minY,
                                  width: region.box.width, height: region.box.height)
            cover.fill = .hex(region.background)
            legacyScene.nodes.append(cover)
        }
        var legacy = try await GeneratedOverlayService.save(reply: [
            "name": "google ads.png · spoken reveal", "scene": try JSONSerialization.jsonObject(with: legacyScene.encoded()),
            "images": [["key": "original", "data": prepared.png.base64EncodedString()]],
        ], brand: nil, moment: [:], size: size, instruction: "reveal the numbers as I say them", root: root)
        legacy.generated?.revealSourceMediaID = source.id
        let legacyBytes = try Data(contentsOf: legacy.url)
        let videoURL = root.appending(path: "video.mov")
        try await SyntheticVideo.write(color: NSColor.black.cgColor, size: CGSize(width: 160, height: 90),
                                       seconds: 6, to: videoURL)
        let video = try await MediaProbe.inspect(url: videoURL)
        let overlay = ProjectOverlay(mediaID: legacy.id, timelineStart: 0, duration: 6)
        let session = EditorSession(store: NumberRevealTestStore(), generatedAssetRoot: root)
        await Task.yield()
        session.updateProject { project in
            project = EditorProject(media: [video, source, legacy],
                clips: [.init(mediaID: video.id, sourceStart: 0, sourceEnd: 6)],
                transcript: [TranscriptWord(mediaID: video.id, text: "$37", start: 2, end: 2.3),
                             TranscriptWord(mediaID: video.id, text: "34", start: 4, end: 4.3)],
                overlays: [overlay])
        }
        let correction = """
        I previously said "can we make the @google ads.png one reveal the numbers as i say them instead of showing the full overlay all at once?"
        you did this perfectly but also hid impressions and avg cpc. please leave them visible (don't hide them) at all times since i don't mention them
        """
        for version in 2...3 {
            await session.runAssistant(instruction: correction)
            #expect(session.errorMessage == nil)
            #expect(session.project.overlays?.count == 1)
            #expect(session.project.overlays?.first?.id == overlay.id)
            #expect(session.project.overlays?.first?.mediaID == legacy.id)
            #expect(session.project.media.count == 3)
            let revised = try #require(session.project.media.first { $0.id == legacy.id })
            #expect(revised.generated?.versions.count == version)
            #expect(revised.generated?.revealSourceMediaID == source.id)
            let reply = try #require(session.conversation.messages.last)
            #expect(reply.tone == .done)
            #expect(reply.notes.contains { $0.contains("Visible throughout: 291, CA$1.10") })
            #expect(!reply.notes.contains { $0.contains("kept hidden") })
            let scene = try SceneExportLayer.loadScene(for: revised)
            for time in [0.0, 2.4, 4.4, 5.9] {
                let rendered = try #require(ScenePosterRenderer.render(scene: scene, size: size,
                    palette: .house, assets: FileSceneAssetResolver(folder: revised.url.deletingLastPathComponent()), at: time))
                let bitmap = NSBitmapImageRep(cgImage: rendered)
                for (index, region) in prepared.regions.enumerated() {
                    var darkPixels = 0
                    for y in Int(region.box.minY * size.height)..<Int(region.box.maxY * size.height) {
                        for x in Int(region.box.minX * size.width)..<Int(region.box.maxX * size.width) {
                            if let color = bitmap.colorAt(x: x, y: y)?.usingColorSpace(.sRGB),
                               color.redComponent < 0.5 { darkPixels += 1 }
                        }
                    }
                    let visible = index == 1 || index == 2 || (index == 3 ? time > 2.3 : time > 4.3)
                    #expect(visible ? darkPixels > 50 : darkPixels == 0,
                            "\(region.text) at \(time)s, revision \(version): \(darkPixels) dark pixels")
                }
            }
        }
        #expect(try Data(contentsOf: legacy.url) == legacyBytes) // Undo still has the original version.
        session.player.replaceCurrentItem(with: nil)
    }

    @Test func maskingPreservesTheImagesColorProfile() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: "number-reveal-test-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let context = try #require(CGContext(data: nil, width: 320, height: 160, bitsPerComponent: 8, bytesPerRow: 0,
            space: CGColorSpace(name: CGColorSpace.displayP3)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
        context.setFillColor(CGColor(colorSpace: CGColorSpace(name: CGColorSpace.displayP3)!,
                                     components: [0.22, 0.447, 0.878, 1])!)
        context.fill(CGRect(x: 0, y: 0, width: 320, height: 160))
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
        NSAttributedString(string: "34", attributes: [.font: NSFont.boldSystemFont(ofSize: 80), .foregroundColor: NSColor.white])
            .draw(at: CGPoint(x: 35, y: 35))
        NSGraphicsContext.restoreGraphicsState()
        let source = root.appending(path: "source.png")
        let sourceImage = try #require(context.makeImage())
        let sourcePNG = try #require(NSBitmapImageRep(cgImage: sourceImage).representation(using: .png, properties: [:]))
        try sourcePNG.write(to: source)
        let prepared = try await ImageNumberRevealService().prepare(source)
        let region = try #require(prepared.regions.first)
        #expect(region.value == 34)
        try prepared.png.write(to: root.appending(path: "image-original.png"))
        let scene = ImageNumberReveal.scene(regions: prepared.regions, cues: [.init(region: 0, at: 1, end: 1.4, spoken: "34")], start: 0, duration: 2)
        let image = try #require(ScenePosterRenderer.render(scene: scene, size: CGSize(width: 320, height: 160),
            palette: .house, assets: FileSceneAssetResolver(folder: root), at: 0))
        let bitmap = NSBitmapImageRep(cgImage: image)
        var hidden = [UInt](repeating: 0, count: 4), background = hidden
        bitmap.getPixel(&hidden, atX: Int(region.box.midX * 320), y: Int(region.box.midY * 160))
        bitmap.getPixel(&background, atX: 10, y: 10)
        for channel in 0..<3 { #expect(abs(Int(hidden[channel]) - Int(background[channel])) <= 1) }
    }

    /// Opt-in evidence from a real project. Reads source files and writes only
    /// into the supplied QA directory; never saves over the creator's project.
    @Test func realImageAndExportWhenRequested() async throws {
        guard let path = ProcessInfo.processInfo.environment["NUMBER_REVEAL_PROJECT"],
              let output = ProcessInfo.processInfo.environment["NUMBER_REVEAL_OUTPUT"] else { return }
        let root = URL(fileURLWithPath: output)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
        var project = try decoder.decode(EditorProject.self, from: Data(contentsOf: URL(fileURLWithPath: path)))
        let source = try #require(project.media.first { $0.name == "google ads.png" })
        let overlay = try #require(project.overlays?.first { $0.mediaID == source.id })
        let prepared = try await ImageNumberRevealService().prepare(source.url)
        let regions = prepared.regions
        let cues = ImageNumberReveal.cues(regions: regions, words: TimelineInspectionService.timelineWords(project: project),
                                         overlay: overlay, projectDuration: project.duration)
        print("Recognized: \(regions.map(\.text)); cues: \(cues.map { (regions[$0.region].text, $0.at) })")
        #expect(regions.count == 4)
        #expect(cues.count == 2)
        let end = max(overlay.timelineStart + overlay.duration, try #require(cues.last).end + 1)
        let scene = ImageNumberReveal.scene(regions: regions, cues: cues, start: overlay.timelineStart, duration: end - overlay.timelineStart)
        let media = try await GeneratedOverlayService.save(reply: [
            "name": "Number reveal QA", "scene": try JSONSerialization.jsonObject(with: scene.encoded()),
            "images": [["key": "original", "data": prepared.png.base64EncodedString()]],
        ], brand: nil, moment: [:], size: CGSize(width: source.width, height: source.height), instruction: "QA", root: root)
        let saved = try SceneExportLayer.loadScene(for: media)
        let times = [0.0, cues[0].at - overlay.timelineStart + 0.3, cues[1].at - overlay.timelineStart + 0.3]
        for (index, time) in times.enumerated() {
            let image = try #require(ScenePosterRenderer.render(scene: saved, size: CGSize(width: source.width, height: source.height),
                palette: .house, assets: FileSceneAssetResolver(folder: media.url.deletingLastPathComponent()), at: time))
            let png = try #require(NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]))
            try png.write(to: root.appending(path: "reveal-\(index).png"))
        }
        if ProcessInfo.processInfo.environment["NUMBER_REVEAL_EXPORT"] == "1" {
            var replacement = overlay
            replacement.mediaID = media.id; replacement.duration = scene.duration
            project.media.append(media); project.overlays = [replacement]
            let url = root.appending(path: "reveal-export.mp4")
            let start = overlay.timelineStart
            try await ExportService.export(project: project, to: url, maximumRenderDimension: 640,
                range: CMTimeRange(start: CompositionBuilder.tick(start), duration: CompositionBuilder.tick(scene.duration)))
            let generator = AVAssetImageGenerator(asset: AVURLAsset(url: url))
            generator.requestedTimeToleranceBefore = .zero; generator.requestedTimeToleranceAfter = .zero
            for (index, time) in times.enumerated() {
                let image = try await generator.image(at: CompositionBuilder.tick(time)).image
                let png = try #require(NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]))
                try png.write(to: root.appending(path: "export-\(index).png"))
            }
        }
    }
}

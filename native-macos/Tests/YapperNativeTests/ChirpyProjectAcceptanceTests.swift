import AppKit
import Foundation
import Testing
@testable import YapperNative

private actor ChirpyAcceptanceStore: ProjectPersisting {
    let url: URL
    init(_ url: URL) { self.url = url }
    func load() async throws -> EditorProject? { nil }
    func save(_ project: EditorProject) async throws {
        let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601
        try encoder.encode(project).write(to: url, options: .atomic)
    }
}

/// Opt-in acceptance against a real project. Only the separate output directory
/// is written. Capture context first, evaluate it on the server, then supply the
/// returned plan to exercise the native executor against the same project.
@MainActor
struct ChirpyProjectAcceptanceTests {
    @Test(.enabled(if: ProcessInfo.processInfo.environment["CHIRPY_QA_PROJECT"] != nil))
    func revealSoundRequestAgainstSavedProject() async throws {
        let env = ProcessInfo.processInfo.environment
        let source = URL(fileURLWithPath: try #require(env["CHIRPY_QA_PROJECT"]))
        let output = URL(fileURLWithPath: try #require(env["CHIRPY_QA_OUTPUT"]))
        guard output.standardizedFileURL != source.deletingLastPathComponent().standardizedFileURL else { throw AppActionError("Use a separate QA output directory.") }
        try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
        let originalBytes = try Data(contentsOf: source)
        let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
        let original = try decoder.decode(EditorProject.self, from: originalBytes)
        let session = EditorSession(store: ChirpyAcceptanceStore(output.appending(path: "project-after.json")), generatedAssetRoot: output)
        await Task.yield()
        session.updateProject { $0 = original }
        session.projectNavigation.currentPackage = ProjectPackage(url: output)
        let events = try await session.revealEvents()
        #expect(!events.isEmpty)
        session.chirpyPlanner = { payload in
            try JSONEncoder().encode(payload).write(to: output.appending(path: "context.json"), options: .atomic)
            guard let planPath = env["CHIRPY_QA_PLAN"] else { return .init(message: "Context captured.", actions: []) }
            return try JSONDecoder().decode(ChirpyPlanReply.self, from: Data(contentsOf: URL(fileURLWithPath: planPath)))
        }
        await session.runAssistant(instruction: "add click sound effects when we reveal the clicks and cost")
        if env["CHIRPY_QA_PLAN"] != nil {
            #expect(session.conversation.messages.last?.tone == .done)
            #expect(session.project.overlays == original.overlays)
            #expect(session.project.media == original.media)
            let beforeIDs = Set((original.audioLayers ?? []).map(\.id))
            let added = (session.project.audioLayers ?? []).filter { !beforeIDs.contains($0.id) }
            #expect(added.count == 2)
            #expect(added.allSatisfy { $0.builtInID == "mouse-click" })
            #expect(added.allSatisfy { sound in events.contains { abs($0.timelineTime - sound.timelineStart) < 0.00001 } })
            #expect(try Data(contentsOf: source) == originalBytes)
        }
        session.player.replaceCurrentItem(with: nil)
    }
}

@MainActor
struct OverlayZoomProjectAcceptanceTests {
    @Test(.enabled(if: ProcessInfo.processInfo.environment["OVERLAY_ZOOM_QA_PROJECT"] != nil || ProcessInfo.processInfo.environment["OVERLAY_ZOOM_QA_IMAGE"] != nil))
    func zoomIntoGoogleAdsCostOnSeparateProjectCopy() async throws {
        let env = ProcessInfo.processInfo.environment
        let source = env["OVERLAY_ZOOM_QA_PROJECT"].map { URL(fileURLWithPath: $0) }
        let output = URL(fileURLWithPath: try #require(env["OVERLAY_ZOOM_QA_OUTPUT"]))
        guard output.standardizedFileURL != source?.deletingLastPathComponent().standardizedFileURL else {
            throw AppActionError("Use a separate QA output directory.")
        }
        try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
        let originalBytes = try source.map { try Data(contentsOf: $0) }
        let original: EditorProject
        if let originalBytes {
            let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
            original = try decoder.decode(EditorProject.self, from: originalBytes)
        } else {
            // Offline demo retains the real screenshot and saved reveal scene;
            // a synthetic background replaces unavailable camera media.
            let image = URL(fileURLWithPath: try #require(env["OVERLAY_ZOOM_QA_IMAGE"]))
            let sceneSource = URL(fileURLWithPath: try #require(env["OVERLAY_ZOOM_QA_SCENE"]))
            let scene = try OverlayScene.decode(Data(contentsOf: sceneSource))
            let sceneURL = output.appending(path: "google-ads.scene.json")
            try scene.encoded().write(to: sceneURL)
            try Data(contentsOf: image).write(to: output.appending(path: "image-original.png"))
            let imageMedia = try await MediaProbe.inspect(url: image)
            let baseURL = output.appending(path: "demo-background.mov")
            try await SyntheticVideo.write(color: NSColor.black.cgColor,
                size: CGSize(width: 960, height: 540), seconds: scene.duration, to: baseURL)
            let base = try await MediaProbe.inspect(url: baseURL)
            var record = GeneratedOverlayRecord(description: "Google Ads demo", brief: "", quote: "", palette: .house)
            record.revealSourceMediaID = imageMedia.id
            let media = ProjectMedia(url: sceneURL, name: "Google Ads · zoom demo", duration: scene.duration,
                width: imageMedia.width, height: imageMedia.height, hasAudio: false, kind: .scene, generated: record)
            original = EditorProject(name: "Overlay zoom demo", media: [base, imageMedia, media],
                clips: [.init(mediaID: base.id, sourceStart: 0, sourceEnd: scene.duration)],
                overlays: [.init(mediaID: media.id, timelineStart: 0, duration: scene.duration,
                    x: 0.07, y: 0.3, width: 0.86, height: 0.4)])
        }
        let session = EditorSession(store: ChirpyAcceptanceStore(output.appending(path: "project-after.json")), generatedAssetRoot: output)
        await Task.yield()
        session.updateProject { $0 = original }
        let overlay = try #require(session.overlays.first { session.media(for: $0)?.name.lowercased().contains("google ads") == true })
        let media = try #require(session.media(for: overlay))
        let regions = try await session.revealRegions(for: media)
        let cost = try #require(regions.first { $0.label.lowercased().contains("cost") })
        session.selectedOverlayID = overlay.id
        let result = await session.performAppAction(OverlayZoomInput(overlayID: overlay.id,
            target: .init(x: cost.box.minX, y: cost.box.minY, width: cost.box.width, height: cost.box.height),
            startTime: 0.5, endTime: 1.3, returnStart: overlay.duration - 1, returnEnd: overlay.duration - 0.2))
        #expect(result.status == .applied)
        #expect(session.project.media == original.media)
        #expect(session.project.audioLayers == original.audioLayers)
        #expect(session.overlays.filter { $0.id != overlay.id } == (original.overlays ?? []).filter { $0.id != overlay.id })
        let range = overlay.timelineStart...(overlay.timelineStart + overlay.duration)
        let inspection = try await TimelineInspectionService.render(project: session.project, range: range)
        defer { inspection.discard() }
        try FileManager.default.copyItem(at: inspection.url, to: output.appending(path: "zoom-preview.mp4"))
        let evidence = try await inspection.inspect(times: [overlay.timelineStart + 0.2, overlay.timelineStart + 1.6,
            overlay.timelineStart + 3.4, overlay.timelineStart + overlay.duration - 0.1])
        for (index, frame) in (evidence["frames"] as? [[String: Any]] ?? []).enumerated() {
            if let jpeg = frame["jpeg"] as? String, let data = Data(base64Encoded: jpeg) {
                try data.write(to: output.appending(path: "frame-\(index).jpg"))
            }
        }
        if let source { #expect(try Data(contentsOf: source) == originalBytes) }
        let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601
        try encoder.encode(session.project).write(to: output.appending(path: "project.json"))
        session.player.replaceCurrentItem(with: nil)
    }
}

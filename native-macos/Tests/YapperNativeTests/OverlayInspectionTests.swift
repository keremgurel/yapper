@preconcurrency import AVFoundation
import AppKit
import Foundation
import Testing
@testable import YapperNative

private actor InspectionStore: ProjectPersisting {
    func load() async throws -> EditorProject? { nil }
    func save(_ project: EditorProject) async throws {}
}

@Suite(.serialized)
@MainActor
struct OverlayInspectionTests {
    @Test(.enabled(if: ProcessInfo.processInfo.environment["RUN_OVERLAY_INSPECTION_LIVE"] == "1"))
    func liveNativeCreationThroughBackendAndRealModel() async throws {
        let environment = ProcessInfo.processInfo.environment
        let folder = URL(fileURLWithPath: try #require(environment["OVERLAY_INSPECTION_OUTPUT"]))
        let endpoint = try #require(environment["OVERLAY_INSPECTION_ENDPOINT"])
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let url = folder.appending(path: "source.mov")
        try await SyntheticVideo.write(color: NSColor.darkGray.cgColor, size: CGSize(width: 540, height: 960), seconds: 8, to: url)
        let session = EditorSession(store: InspectionStore(), generatedAssetRoot: folder, generatedOverlayRequest: { path, body in
            var request = URLRequest(url: URL(string: endpoint + "/" + path)!)
            request.httpMethod = "POST"
            request.timeoutInterval = 300
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200,
                  let reply = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                throw NativeEditorError.aiFailed("Live inspection request failed: " + String(data: data, encoding: .utf8)!)
            }
            return reply
        })
        if let path = environment["OVERLAY_INSPECTION_REAL_PROJECT"] {
            let loaded = try #require(await ProjectPackageStore(package: ProjectPackage(url: URL(fileURLWithPath: path))).load())
            let target = try #require(loaded.media.first(where: { $0.isScene && $0.name.lowercased().contains("counter") }))
            let base = try #require(loaded.media.first(where: { $0.id == loaded.clips.first?.mediaID }))
            await session.importMedia([base.url])
            session.updateProject { $0 = loaded }
            var previous = loaded
            previous.media.removeAll { $0.id == target.id }
            try await session.verifyGeneratedChanges(since: previous, instruction: "Check the signup and payments counter for readability, its earlier-number hold and transition to the new numbers. Preserve its existing design and placement.")
            try JSONEncoder().encode(session.project).write(to: folder.appending(path: "verified-project.json"), options: .atomic)
            try await ExportService.export(project: session.project, to: folder.appending(path: "verified.mp4"), maximumRenderDimension: 960)
            return
        }
        await session.importMedia([url])
        let media = try #require(session.project.media.first)
        session.updateProject { project in
            project.transcript = "Last check in we were at 324 signups now we are at 553 signups".split(separator: " ").enumerated().map { index, text in
                TranscriptWord(mediaID: media.id, text: String(text), start: 0.3 + Double(index) * 0.45, end: 0.68 + Double(index) * 0.45)
            }
        }
        let instruction = "Create one clean blue animated signup counter from 324 to 553 for the whole comparison. Hold 324 at the beginning before counting up, then hold 553. No other overlays."
        if environment["OVERLAY_INSPECTION_BROKEN"] == "1" {
            let previous = session.project
            var brokenReply = reply(id: "broken", duration: 7)
            brokenReply["name"] = "Signup counter missing its numbers"
            let blank = try await GeneratedOverlayService.save(reply: brokenReply, brand: nil,
                moment: ["brief": instruction, "quote": "we were at 324 signups now we are at 553 signups"],
                size: CGSize(width: 700, height: 400), instruction: instruction, root: folder)
            session.updateProject { project in
                project.media.append(blank)
                project.overlays = [.init(mediaID: blank.id, timelineStart: 0.2, duration: 7, x: 0.1, y: 0.1, width: 0.8, height: 0.26)]
            }
            try await session.verifyGeneratedChanges(since: previous, instruction: instruction)
            #expect(session.project.media.first(where: { $0.isScene })?.generated?.versions.count ?? 0 > 1)
        } else {
            await session.performGeneratedOverlays(instruction: instruction, revising: [])
        }
        #expect(session.project.media.filter(\.isScene).count == 1, Comment(rawValue: session.statusMessage + " " + (session.errorMessage ?? "")))
        let generated = try #require(session.project.media.first(where: { $0.isScene }))
        #expect(generated.generated?.versions.last?.notes.contains(where: { $0.contains("Composited-frame review passed") }) == true)
        try JSONEncoder().encode(session.project).write(to: folder.appending(path: "verified-project.json"), options: .atomic)
        try await ExportService.export(project: session.project, to: folder.appending(path: "verified.mp4"))
        let inspection = try await TimelineInspectionService.render(project: session.project)
        defer { inspection.discard() }
        let overlay = try #require(session.project.overlays?.first(where: { $0.mediaID == generated.id }))
        let scene = try SceneExportLayer.loadScene(for: generated)
        let evidence = try await inspection.inspect(times: TimelineInspectionService.reviewTimes(overlay: overlay, scene: scene, projectDuration: session.project.duration))
        for (index, frame) in (evidence["frames"] as? [[String: Any]] ?? []).enumerated() {
            let encoded = try #require(frame["jpeg"] as? String)
            let data = try #require(Data(base64Encoded: encoded))
            try data.write(to: folder.appending(path: "verified-\(index).jpg"), options: .atomic)
        }
    }

    @Test func counterSamplingIncludesOpeningHoldAndTransition() {
        let scene = OverlayScene(duration: 7, nodes: [], animations: [
            SceneAnimation(node: "count", property: .value, from: 324, to: 324, start: 0, end: 3),
            SceneAnimation(node: "count", property: .value, from: 324, to: 553, start: 3, end: 5)
        ])
        let overlay = ProjectOverlay(mediaID: UUID(), timelineStart: 10, duration: 7)
        let times = TimelineInspectionService.reviewTimes(overlay: overlay, scene: scene, projectDuration: 30)
        #expect(times.contains(12.96))
        #expect(times.contains(14))
        #expect(times.contains(15.04))
        #expect(times.count <= 8)
        #expect(times == times.sorted())
        #expect(TimelineInspectionService.boundedTimes([.nan, -.infinity, -1, 0, 99], duration: 2) == [0, 1.96])
    }

    @Test func inspectedWordsRespectCutsAndRepeatedSourceClips() {
        let id = UUID()
        let words = [TranscriptWord(mediaID: id, text: "earlier", start: 0.1, end: 1.2),
                     TranscriptWord(mediaID: id, text: "now", start: 2.1, end: 2.5)]
        let project = EditorProject(clips: [
            .init(mediaID: id, sourceStart: 0, sourceEnd: 1),
            .init(mediaID: id, sourceStart: 2, sourceEnd: 3),
            .init(mediaID: id, sourceStart: 0, sourceEnd: 1)], transcript: words)
        let inspected = TimelineInspectionService.timelineWords(project: project)
        #expect(inspected.map(\.text) == ["earlier", "now", "earlier"])
        #expect(inspected[0].end == 1)
        #expect(abs(inspected[1].at - 1.1) < 0.001)
        #expect(inspected[2].end == 3)
    }

    @Test func capturesCompositedOverlayRatherThanCleanPlayback() async throws {
        let folder = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        let url = folder.appending(path: "black.mov")
        try await SyntheticVideo.write(color: NSColor.black.cgColor, size: CGSize(width: 320, height: 180), seconds: 2, to: url)
        let base = try await MediaProbe.inspect(url: url)
        let media = try await GeneratedOverlayService.save(reply: reply(id: "one", duration: 1), brand: nil,
            moment: [:], size: CGSize(width: 320, height: 180), instruction: "Blue panel", root: folder)
        let project = EditorProject(media: [base, media], clips: [.init(mediaID: base.id, sourceStart: 0, sourceEnd: 2)],
            overlays: [.init(mediaID: media.id, timelineStart: 0.5, duration: 1, x: 0, y: 0, width: 1, height: 1)])
        let inspection = try await TimelineInspectionService.render(project: project)
        defer { inspection.discard() }
        let evidence = try await inspection.inspect(times: [0.2, 0.8, 1.8])
        let frames = try #require(evidence["frames"] as? [[String: Any]])
        #expect(frames.count == 3)
        let encoded = try #require(frames[1]["jpeg"] as? String)
        let middle = try #require(Data(base64Encoded: encoded))
        let bitmap = try #require(NSBitmapImageRep(data: middle))
        let color = try #require(bitmap.colorAt(x: bitmap.pixelsWide / 2, y: bitmap.pixelsHigh / 2)?.usingColorSpace(.deviceRGB))
        // Color conversion differs between the local and virtualized macOS
        // exporters. Test the blue overlay against the black source, rather
        // than requiring one encoded channel value.
        #expect(color.blueComponent > 0.6)
        #expect(color.blueComponent > color.redComponent + 0.4)
        #expect(color.blueComponent > color.greenComponent + 0.4)
        #expect(color.redComponent < 0.2)
        #expect((evidence["waveform"] as? [[String: Any]])?.isEmpty == true)
        // Starting an inspection partway through a video must not reset scene
        // visibility clocks, in either the one-pass or two-pass exporter.
        for custom in [false, true] {
            var candidate = project
            if custom { candidate.backdrop = .init(red: 0, green: 0, blue: 0) }
            let ranged = try await TimelineInspectionService.render(project: candidate, range: 0.6...1.9)
            defer { ranged.discard() }
            let evidence = try await ranged.inspect(times: [0.8, 1.8])
            let frames = try #require(evidence["frames"] as? [[String: Any]])
            for (index, frame) in frames.enumerated() {
                let encoded = try #require(frame["jpeg"] as? String)
                let data = try #require(Data(base64Encoded: encoded))
                let bitmap = try #require(NSBitmapImageRep(data: data))
                let pixel = try #require(bitmap.colorAt(x: bitmap.pixelsWide / 2, y: bitmap.pixelsHigh / 2)?.usingColorSpace(.deviceRGB))
                if index == 0 {
                    #expect(pixel.blueComponent > 0.6)
                    #expect(pixel.blueComponent > pixel.redComponent + 0.4)
                    #expect(pixel.blueComponent > pixel.greenComponent + 0.4)
                } else {
                    #expect(pixel.blueComponent < 0.2)
                }
            }
            #expect(abs((frames[0]["at"] as? Double ?? 0) - 0.8) < 0.04)
        }
    }

    @Test func creationBatchesByIDReviewsRepairsAndUndoesAsOneEdit() async throws {
        try await exerciseCreation(failReview: false)
    }

    @Test func failedVisualCheckRestoresPreviousProject() async throws {
        try await exerciseCreation(failReview: true)
    }

    @Test func cancellationDuringReviewRestoresPreviousProject() async throws {
        try await exerciseCreation(failReview: true, cancelReview: true)
    }

    private func exerciseCreation(failReview: Bool, cancelReview: Bool = false) async throws {
        let folder = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        let url = folder.appending(path: "base.mov")
        try await SyntheticVideo.write(color: NSColor.black.cgColor, size: CGSize(width: 320, height: 180), seconds: 4, to: url)
        var designBatchSizes: [Int] = []
        var reviewCount = 0
        let session = EditorSession(store: InspectionStore(), generatedAssetRoot: folder, generatedOverlayRequest: { path, body in
            if path == "direct-overlays" {
                #expect(body["inspection"] != nil)
                return ["moments": (0..<3).map { index in
                    ["name": "Panel \(index)", "quote": "we have grown", "brief": "Show the growth", "kind": "other", "aspect": 1.6] as [String: Any]
                }]
            }
            if path == "design-overlays" {
                let moments = try #require(body["moments"] as? [[String: Any]])
                designBatchSizes.append(moments.count)
                #expect(moments.allSatisfy { $0["inspection"] != nil })
                return ["scenes": try moments.reversed().map { moment in
                    var result = reply(id: try #require(moment["id"] as? String), duration: try #require(moment["duration"] as? Double))
                    result["name"] = moment["name"]
                    return result
                }]
            }
            #expect(path == "review-overlay")
            let evidence = try #require(body["inspection"] as? [String: Any])
            #expect(!(evidence["frames"] as? [[String: Any]] ?? []).isEmpty)
            reviewCount += 1
            if cancelReview { throw CancellationError() }
            if failReview { return ["passed": false, "issues": ["Unreadable visual"]] }
            if reviewCount == 1 {
                var repaired = reply(id: "repair", duration: try #require(body["duration"] as? Double))
                repaired["name"] = (body["asset"] as? [String: Any])?["name"]
                return ["passed": false, "issues": ["Needs a repair"],
                        "repaired": repaired]
            }
            return ["passed": true, "issues": [String]()]
        })
        await session.importMedia([url])
        let base = try #require(session.project.media.first)
        session.updateProject { project in
            project.transcript = ["we", "have", "grown"].enumerated().map { index, word in
                TranscriptWord(mediaID: base.id, text: word, start: 0.4 + Double(index) * 0.5, end: 0.8 + Double(index) * 0.5)
            }
        }
        let previous = session.project
        await session.performGeneratedOverlays(instruction: "Create visuals for our growth", revising: [])
        #expect(designBatchSizes == [3])
        if failReview {
            #expect(session.project == previous)
            #expect(reviewCount == 1)
        } else {
            #expect(reviewCount == 6) // All three rechecked against the new render.
            #expect(session.project.media.filter(\.isScene).count == 3)
            #expect(session.project.media.filter(\.isScene).map(\.name) == ["Panel 0", "Panel 1", "Panel 2"])
            #expect(Set((session.project.overlays ?? []).map { "\($0.x),\($0.y)" }).count > 1)
            #expect(session.project.media.filter(\.isScene).allSatisfy { $0.generated?.versions.last?.notes.contains(where: { $0.contains("Composited-frame review passed") }) == true })
            #expect(session.project.media.filter(\.isScene).contains { $0.generated?.versions.count == 2 })
            await session.undo()
            #expect(session.project == previous)
        }
    }

    private func reply(id: String, duration: Double) -> [String: Any] {
        ["id": id, "name": "Blue panel", "description": "A blue panel.", "scene": ["version": 1, "duration": duration,
          "nodes": [["id": "blue", "type": "rect", "x": 0.5, "y": 0.5, "width": 1, "height": 1, "fill": "#0000FF"]], "animations": []]]
    }
}

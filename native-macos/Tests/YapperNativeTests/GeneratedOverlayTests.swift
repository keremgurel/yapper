@preconcurrency import AVFoundation
import AppKit
import Foundation
import Testing
@testable import YapperNative

@Suite(.serialized)
struct GeneratedOverlayTests {
    @MainActor @Test func exportReviewedEditorialForOptInVisualQA() async throws {
        guard ProcessInfo.processInfo.environment["OVERLAY_EDITORIAL_EXPORT"] == "1",
              let directory = ProcessInfo.processInfo.environment["OVERLAY_EVAL_OUTPUT"],
              let source = ProcessInfo.processInfo.environment["OVERLAY_EVAL_PROJECT"] else { return }
        let folder = URL(fileURLWithPath:directory)
        var project = try #require(await ProjectPackageStore(package:ProjectPackage(url:URL(fileURLWithPath:source))).load())
        let data = try #require(JSONSerialization.jsonObject(with:Data(contentsOf:folder.appending(path:"designed.json"))) as? [String:Any])
        let moments = try #require(data["moments"] as? [[String:Any]])
        let result = try #require(data["result"] as? [String:Any])
        let scenes = try #require(result["scenes"] as? [[String:Any]])
        // Only this in-memory QA composition changes. No user's project is saved.
        project.overlays = []
        var times: [Double] = []
        for moment in moments {
            let id = try #require(moment["id"] as? String)
            let reply = try #require(scenes.first { $0["id"] as? String == id })
            let box = try #require(moment["box"] as? [String:Any])
            let size = CGSize(width:try #require(box["widthPx"] as? Double),height:try #require(box["heightPx"] as? Double))
            let media = try await GeneratedOverlayService.save(reply:reply,brand:nil,moment:moment,size:size,instruction:"Editorial QA",root:folder)
            let start = try #require(moment["start"] as? Double)
            let duration = try #require(moment["duration"] as? Double)
            project.media.append(media)
            let overlayWidth = size.width/(1080*project.resolvedAspectRatio)
            project.overlays?.append(.init(mediaID:media.id,timelineStart:start,duration:duration,
                x:0.04,y:0.04,width:overlayWidth,height:size.height/1080))
            times += [start+0.4,start+duration*0.5,start+duration-0.35,start+duration+0.3]
        }
        let output=folder.appending(path:"editorial-export.mp4")
        try await ExportService.export(project:project,to:output)
        let generator=AVAssetImageGenerator(asset:AVURLAsset(url:output))
        generator.appliesPreferredTrackTransform=true
        generator.maximumSize=CGSize(width:540,height:960)
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = .zero
        for (i,time) in times.enumerated() {
            let image = try await generator.image(at:CMTime(seconds:time,preferredTimescale:600)).image
            let png = try #require(NSBitmapImageRep(cgImage:image).representation(using:.png,properties:[:]))
            try png.write(to:folder.appending(path:"editorial-\(i).png"))
        }
    }
    @MainActor @Test func prepareInteractiveCopyForOptInQA() async throws {
        guard let directory = ProcessInfo.processInfo.environment["OVERLAY_EVAL_OUTPUT"],
              let source = ProcessInfo.processInfo.environment["OVERLAY_EVAL_PROJECT"] else { return }
        var project = try #require(await ProjectPackageStore(package: ProjectPackage(url: URL(fileURLWithPath:source))).load())
        let sceneIDs = Set(project.media.filter(\.isScene).map(\.id))
        project.media.removeAll { sceneIDs.contains($0.id) }
        project.overlays?.removeAll { sceneIDs.contains($0.mediaID) }
        project.id = UUID()
        project.name = "Overlay QA"
        let folder = URL(fileURLWithPath:directory).appending(path:"Overlay QA.yapperproj")
        try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
        try await ProjectPackageStore(package:ProjectPackage(url:folder)).save(project)
    }
    @MainActor @Test func exportRealProjectForOptInVisualQA() async throws {
        guard let directory = ProcessInfo.processInfo.environment["OVERLAY_EVAL_OUTPUT"],
              let source = ProcessInfo.processInfo.environment["OVERLAY_EVAL_PROJECT"] else { return }
        let folder = URL(fileURLWithPath: directory)
        let package = ProjectPackage(url: URL(fileURLWithPath: source))
        var project = try #require(await ProjectPackageStore(package: package).load())
        let result = try #require(JSONSerialization.jsonObject(with: Data(contentsOf: folder.appending(path: "result.json"))) as? [String: Any])
        let reply = try #require((result["scenes"] as? [[String: Any]])?.first)
        let media = try await GeneratedOverlayService.save(reply: reply, brand: nil, moment: [:],
            size: CGSize(width:254,height:160),instruction:"visual QA",root:folder)
        // Operate only on this in-memory copy. User's project is never saved.
        project.media.append(media)
        project.overlays = [.init(mediaID:media.id,timelineStart:7.41,duration:7.7,
            x:0.08,y:0.06,width:254/(1080*project.resolvedAspectRatio),height:160/1080)]
        var remaining = 18.0
        project.clips = project.clips.compactMap { clip in
            guard remaining > 0 else { return nil }
            var copy = clip
            copy.sourceEnd = min(clip.sourceEnd,clip.sourceStart+remaining)
            remaining -= copy.duration
            return copy
        }
        let output = folder.appending(path:"real-project.mp4")
        try await ExportService.export(project:project,to:output)
        let generator = AVAssetImageGenerator(asset:AVURLAsset(url:output))
        generator.appliesPreferredTrackTransform = true
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = .zero
        for (i,time) in [7.8,8.6,10.2,12.4,14.6,16.0].enumerated() {
            let image = try await generator.image(at:CMTime(seconds:time,preferredTimescale:600)).image
            let png = try #require(NSBitmapImageRep(cgImage:image).representation(using:.png,properties:[:]))
            try png.write(to:folder.appending(path:"export-\(i).png"))
        }
    }
    @Test func routesCreationWithoutImportedMedia() {
        for instruction in ["create an overlay where it makes sense", "animate the numbers from 1200 to 2850", "design a visual metaphor for the transcript"] {
            #expect(AssistantRouter.route(instruction) == .placeOverlays)
            #expect(GeneratedOverlayCommand.creates(instruction))
        }
        #expect(!GeneratedOverlayCommand.creates("place my overlays"))
    }

    @Test func deletingAnElementDoesNotDeleteTheAsset() {
        #expect(GeneratedOverlayCommand.removesWholeAsset("remove from the video"))
        #expect(GeneratedOverlayCommand.removesWholeAsset("delete"))
        #expect(!GeneratedOverlayCommand.removesWholeAsset("remove the red circle"))
        #expect(!GeneratedOverlayCommand.removesWholeAsset("delete the background"))
    }

    private var sceneJSON: [String: Any] {
        ["version": 1, "duration": 2, "nodes": [["id": "block", "type": "rect", "x": 0, "y": 0,
            "width": 1, "height": 1, "fill": "#0000FF"]], "animations": []]
    }

    @Test @MainActor func savesNamedMediaAndImmutableRevisions() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let reply: [String: Any] = ["scene": sceneJSON, "name": "Blue clarity panel", "description": "A blue panel behind the key point."]
        let first = try await GeneratedOverlayService.save(reply: reply, brand: nil,
            moment: ["quote": "we have grown", "brief": "show a panel"], size: CGSize(width: 320, height: 200),
            instruction: "create a panel", root: directory)
        let originalBytes = try Data(contentsOf: first.url)
        let second = try await GeneratedOverlayService.save(reply: reply, brand: nil,
            moment: [:], size: CGSize(width: 320, height: 200), instruction: "make it minimal", root: directory, existing: first)
        #expect(first.id == second.id)
        #expect(first.url != second.url)
        #expect(second.generated?.versions.count == 2)
        #expect(second.generated?.description == "A blue panel behind the key point.")
        #expect(try Data(contentsOf: first.url) == originalBytes)
        #expect(FileManager.default.fileExists(atPath: second.url.deletingLastPathComponent().appending(path: "v2.poster.png").path))
        let decoded = try SceneExportLayer.loadScene(for: second)
        #expect(decoded.nodes.count == 1)
        let copiedRoot = directory.appending(path: "copy.yapperproj")
        let project = EditorProject(media: [second])
        try GeneratedAssetLayout.copyAssets(in: project, to: copiedRoot)
        let copied = GeneratedAssetLayout.relocated(project, to: copiedRoot)
        #expect(copied.media[0].url != second.url)
        #expect(try Data(contentsOf: copied.media[0].url) == Data(contentsOf: second.url))
    }

    @Test @MainActor func generatedSceneConnectsToExportButNotPlayerAnimationTool() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let videoURL = directory.appending(path: "base.mov")
        try await SyntheticVideo.write(color: NSColor.black.cgColor, size: CGSize(width: 160, height: 90), seconds: 2, to: videoURL)
        let video = try await MediaProbe.inspect(url: videoURL)
        let media = try await GeneratedOverlayService.save(reply: ["scene": sceneJSON, "name": "Blue panel"], brand: nil,
            moment: [:], size: CGSize(width: 160, height: 90), instruction: "create a panel", root: directory)
        let project = EditorProject(media: [video, media], clips: [.init(mediaID: video.id, sourceStart: 0, sourceEnd: 2)],
            overlays: [.init(mediaID: media.id, timelineStart: 0.5, duration: 1)])
        let exported = try await CompositionBuilder.build(project: project, for: .export)
        let preview = try await CompositionBuilder.build(project: project, for: .preview)
        #expect(exported.videoComposition?.animationTool != nil)
        #expect(preview.videoComposition?.animationTool == nil)
        let poster = try #require(ScenePosterRenderer.render(scene: SceneExportLayer.loadScene(for: media),
            size: CGSize(width: 160, height: 90), palette: .house, assets: EmptySceneAssetResolver()))
        let pixel = NSBitmapImageRep(cgImage: poster).colorAt(x: 80, y: 45)
        #expect((pixel?.blueComponent ?? 0) > 0.9)

        // The snapshot must retain local image references, not just the JSON.
        let png = try #require(NSBitmapImageRep(cgImage: poster).representation(using: .png, properties: [:]))
        var imageScene = sceneJSON
        imageScene["nodes"] = [["id": "picture", "type": "image", "x": 0, "y": 0, "width": 1, "height": 1, "asset": "image:test"]]
        let pictured = try await GeneratedOverlayService.save(reply: ["scene": imageScene, "name": "Picture panel",
            "images": [["key": "test", "data": png.base64EncodedString()]]], brand: nil, moment: [:],
            size: CGSize(width: 160, height: 90), instruction: "add a picture", root: directory)
        var withPicture = project
        withPicture.media.append(pictured)
        withPicture.overlays = [.init(mediaID: pictured.id, timelineStart: 0.5, duration: 1, x: 0, y: 0, width: 1, height: 1)]
        let snapshot = try await ExportSourceSnapshot.create(project: withPicture)
        defer { snapshot.discard() }
        let saved = try #require(snapshot.project.media.first(where: { $0.id == pictured.id }))
        #expect(saved.url != pictured.url)
        #expect(FileSceneAssetResolver(sceneFile: saved.url).image(forAsset: "image:test") != nil)
        let output = directory.appending(path: "finished.mp4")
        try await ExportService.export(project: withPicture, to: output)
        let generator = AVAssetImageGenerator(asset: AVURLAsset(url: output))
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = .zero
        for (time, blue) in [(0.1, false), (1.0, true), (1.8, false)] {
            let frame = try await generator.image(at: CMTime(seconds: time, preferredTimescale: 600)).image
            let pixel = NSBitmapImageRep(cgImage: frame).colorAt(x: frame.width / 2, y: frame.height / 2)
            #expect(((pixel?.blueComponent ?? 0) > 0.8) == blue)
        }

        var moving = sceneJSON
        moving["nodes"] = [["id": "block", "type": "rect", "x": 0.05, "y": 0.1, "width": 0.2, "height": 0.2, "fill": "#0000FF"]]
        moving["animations"] = [["node": "block", "property": "x", "from": 0.05, "to": 0.75, "start": 0, "end": 1, "easing": "easeInOut"]]
        let animated = try await GeneratedOverlayService.save(reply: ["scene": moving, "name": "Moving blue panel"], brand: nil,
            moment: [:], size: CGSize(width: 160, height: 90), instruction: "animate the panel", root: directory)
        var animatedProject = project
        animatedProject.media.append(animated)
        animatedProject.overlays = [.init(mediaID: animated.id, timelineStart: 0.5, duration: 1.4, x: 0, y: 0, width: 1, height: 1)]
        let animatedOutput = directory.appending(path: "animated.mp4")
        try await ExportService.export(project: animatedProject, to: animatedOutput)
        let animatedFrames = AVAssetImageGenerator(asset: AVURLAsset(url: animatedOutput))
        animatedFrames.requestedTimeToleranceBefore = .zero
        animatedFrames.requestedTimeToleranceAfter = .zero
        for (time, x) in [(0.55, 0.15), (1.6, 0.85)] {
            let frame = try await animatedFrames.image(at: CMTime(seconds: time, preferredTimescale: 600)).image
            let bitmap = NSBitmapImageRep(cgImage: frame)
            let pixel = bitmap.colorAt(x: Int(Double(frame.width) * x), y: Int(Double(frame.height) * 0.2))
            #expect((pixel?.blueComponent ?? 0) > 0.8)
        }
    }
}

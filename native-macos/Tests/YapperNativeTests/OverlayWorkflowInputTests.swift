import Foundation
import Testing
@testable import YapperNative

private actor WorkflowInputStore: ProjectPersisting {
    func load() async throws -> EditorProject? { nil }
    func save(_: EditorProject) async throws {}
}

/// Records which files each placement request was offered, and places none.
private actor RecordingPlacementPlanner: OverlayPlacementPlanning {
    private(set) var offered: [[String]] = []

    func plan(instruction _: String, words _: [String], files: [OverlayPlacementService.File],
              frameAspect _: Double, speaker _: [SpeakerSample],
              placed _: [OverlayPlacementService.Placed]) async throws -> OverlayPlacementService.Plan {
        offered.append(files.map(\.name))
        return .init(placements: [], sounds: [], texts: [])
    }
}

/// The overlay workflow does what the planner's mode and media IDs say, never
/// what the sentence happens to contain.
@MainActor
@Suite(.serialized)
struct OverlayWorkflowInputTests {
    private let main: ProjectMedia
    private let chart: ProjectMedia
    private let coffee: ProjectMedia
    private let placed: ProjectMedia
    private let card: ProjectMedia
    private let reveal: ProjectMedia
    private let placedOverlay: ProjectOverlay
    private let revealOverlay: ProjectOverlay

    init() {
        main = Self.media("main.mov", kind: .video)
        chart = Self.media("chart.png", kind: .image)
        coffee = Self.media("coffee.mov", kind: .video)
        placed = Self.media("placed.png", kind: .image)
        let card = Self.media("card.png", kind: .image)
        var record = GeneratedOverlayRecord(description: "Reveal", brief: "", quote: "", palette: .house)
        record.revealSourceMediaID = card.id
        reveal = ProjectMedia(url: URL(filePath: "/tmp/workflow-reveal.json"), name: "card.png · spoken reveal",
                              duration: 4, width: 320, height: 180, hasAudio: false, kind: .scene, generated: record)
        self.card = card
        placedOverlay = ProjectOverlay(mediaID: placed.id, timelineStart: 0, duration: 2)
        revealOverlay = ProjectOverlay(mediaID: reveal.id, timelineStart: 4, duration: 3)
    }

    @Test func placesOnlyTheNamedUnusedFiles() async throws {
        let (session, planner) = await fixture()
        let before = session.project.overlays
        _ = await session.performAppAction(request(.placeImported, [chart.id, placed.id]))
        #expect(await planner.offered == [["chart.png"]])
        #expect(session.project.overlays == before)
    }

    @Test func leavingFilesOutPlacesEveryUnusedImport() async throws {
        let (session, planner) = await fixture()
        _ = await session.performAppAction(request(.placeImported, nil))
        // Not the placed screenshot, the reveal, or the image the reveal was made from.
        #expect(await planner.offered == [["chart.png", "coffee.mov"]])
    }

    /// "A pop on every overlay" sent here by mistake must not stack those
    /// overlays on the timeline a second time.
    @Test func filesAlreadyOnTheTimelineAreNeverPlacedAgain() async throws {
        let (session, planner) = await fixture()
        let before = session.project
        let result = await session.performAppAction(request(.placeImported, [placed.id, card.id, reveal.id]))
        #expect(result.status == .failed)
        #expect(result.message == "Those files are already on the timeline, so nothing was placed again.")
        #expect(await planner.offered.isEmpty)
        #expect(session.project == before)
    }

    @Test func nothingToPlaceIsAnsweredWithoutTheModel() async throws {
        let (session, planner) = await fixture(media: [main])
        let result = await session.performAppAction(request(.placeImported, nil))
        #expect(result.status == .failed)
        #expect(result.message == "Import the overlays you want placed first.")
        #expect(await planner.offered.isEmpty)

        let (allPlaced, allPlacedPlanner) = await fixture(media: [main, placed])
        let again = await allPlaced.performAppAction(request(.placeImported, nil))
        #expect(again.message == "Everything you imported is already on the timeline, so nothing was placed again.")
        #expect(await allPlacedPlanner.offered.isEmpty)
    }

    @Test func aFileThatIsNotInTheProjectIsRejected() async throws {
        let (session, planner) = await fixture()
        let result = await session.performAppAction(request(.placeImported, [UUID()]))
        #expect(result.status == .failed)
        #expect(result.message == "A requested file is no longer in this project.")
        #expect(await planner.offered.isEmpty)
    }

    @Test func reviseTakesOnlyGeneratedOverlays() async throws {
        let (session, _) = await fixture()
        #expect(try session.overlayWorkflowTarget(for: request(.revise, [reveal.id, chart.id])) == .revise([reveal]))
        let result = await session.performAppAction(request(.revise, [chart.id]))
        #expect(result.status == .failed)
        #expect(result.message == "Choose the generated overlay to change.")
    }

    @Test func numberRevealsResolveOneSourceImage() async throws {
        let (session, _) = await fixture()
        #expect(try session.overlayWorkflowTarget(for: request(.revealNumbers, [card.id])) == .revealNumbers(card))
        // The reveal already on the timeline stands for the image it was made from.
        #expect(try session.overlayWorkflowTarget(for: request(.revealNumbers, [reveal.id, card.id])) == .revealNumbers(card))
        #expect(throws: AppActionError.self) {
            try session.overlayWorkflowTarget(for: request(.revealNumbers, [card.id, chart.id]))
        }
        #expect(throws: AppActionError.self) {
            try session.overlayWorkflowTarget(for: request(.revealNumbers, [coffee.id]))
        }
    }

    @Test func createNeedsNoFiles() async throws {
        let (session, _) = await fixture(media: [main])
        #expect(try session.overlayWorkflowTarget(for: request(.create, nil)) == .create)
    }

    private func request(_ mode: OverlayWorkflowModeInput, _ ids: [UUID]?) -> OverlayWorkflowInput {
        OverlayWorkflowInput(instruction: "put a pop on every overlay we have", mode: mode, mediaIDs: ids)
    }

    private func fixture(media: [ProjectMedia]? = nil) async -> (EditorSession, RecordingPlacementPlanner) {
        let planner = RecordingPlacementPlanner()
        let session = EditorSession(store: WorkflowInputStore(), overlayPlacementService: planner)
        await Task.yield()
        let all = media ?? [main, chart, coffee, placed, card, reveal]
        let ids = Set(all.map(\.id))
        let words = ["we", "grew", "sales", "this", "year"].enumerated().map { index, text in
            TranscriptWord(mediaID: main.id, text: text, start: Double(index), end: Double(index) + 0.5)
        }
        session.updateProject { project in
            project = EditorProject(media: all, clips: [.init(mediaID: main.id, sourceStart: 0, sourceEnd: 10)],
                                    transcript: words,
                                    overlays: [placedOverlay, revealOverlay].filter { ids.contains($0.mediaID) })
        }
        return (session, planner)
    }

    private static func media(_ name: String, kind: ProjectMedia.Kind) -> ProjectMedia {
        ProjectMedia(url: URL(filePath: "/tmp/workflow-\(name)"), name: name, duration: 10,
                     width: 320, height: 180, hasAudio: kind == .video, kind: kind)
    }
}

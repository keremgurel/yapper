@preconcurrency import AVFoundation
import AppKit
import Foundation
import Testing
@testable import YapperNative

struct OverlayLaneFitTests {
    private let media = UUID()

    @Test func aMoveOntoATakenLaneGoesUpALane() throws {
        let sitting = ProjectOverlay(mediaID: media, timelineStart: 2, duration: 2)
        var moved = ProjectOverlay(mediaID: media, timelineStart: 6, duration: 1)
        moved.timelineStart = 3
        let settled = try OverlayLaneFit.settle([moved], among: [sitting], keepingRequestedLane: false)
        #expect(settled.first?.lane == 1)
    }

    @Test func aMoveIntoAGapKeepsItsLane() throws {
        let sitting = ProjectOverlay(mediaID: media, timelineStart: 2, duration: 2)
        let moved = ProjectOverlay(mediaID: media, timelineStart: 4, duration: 1)
        #expect(try OverlayLaneFit.settle([moved], among: [sitting], keepingRequestedLane: false).first?.lane == 0)
    }

    @Test func overlaysMovedTogetherDoNotLandOnEachOther() throws {
        let first = ProjectOverlay(mediaID: media, timelineStart: 1, duration: 2)
        let second = ProjectOverlay(mediaID: media, timelineStart: 1.5, duration: 2)
        let settled = try OverlayLaneFit.settle([first, second], among: [], keepingRequestedLane: false)
        #expect(settled.map(\.lane) == [0, 1])
    }

    /// Project "5": 21.71588571110309 + 2.16 runs 5 µs into a neighbour at
    /// 23.8758807111031. That is butting, not overlapping.
    @Test func floatDriftIsTouchingNotOverlapping() throws {
        let next = ProjectOverlay(mediaID: media, timelineStart: 23.8758807111031, duration: 3)
        var writing = ProjectOverlay(mediaID: media, timelineStart: 21.71588571110309, duration: 1)
        writing.duration = 2.160
        #expect(!OverlayTracks.collide(writing.timelineStart, writing.duration, next.timelineStart, next.duration))
        let settled = try OverlayLaneFit.settle([writing], among: [next], keepingRequestedLane: true)
        #expect(settled.first?.lane == 0)
        // Pulled onto the neighbour, so they hand over on the same frame.
        #expect(settled.first.map { $0.timelineStart + $0.duration } == next.timelineStart)
        // A real overlap still is one.
        #expect(OverlayTracks.collide(21.7, 2.2, next.timelineStart, next.duration))
    }

    @Test func aRefusedLaneNamesWhatItRanInto() {
        let sitting = ProjectOverlay(mediaID: media, timelineStart: 2, duration: 2)
        let moved = ProjectOverlay(mediaID: media, timelineStart: 3, duration: 1)
        do {
            _ = try OverlayLaneFit.settle([moved], among: [sitting], keepingRequestedLane: true,
                                          name: { $0.id == moved.id ? "writing.mp4" : "live call.mp4" })
            Issue.record("A taken named lane was accepted")
        } catch {
            #expect((error as? AppActionError)?.message == "writing.mp4 would overlap live call.mp4 on lane 1 at 2.00 s.")
        }
    }

    @Test func aNamedLaneIsStillRefusedWhenTaken() {
        let sitting = ProjectOverlay(mediaID: media, timelineStart: 2, duration: 2)
        let moved = ProjectOverlay(mediaID: media, timelineStart: 3, duration: 1)
        #expect(throws: AppActionError.self) {
            try OverlayLaneFit.settle([moved], among: [sitting], keepingRequestedLane: true)
        }
    }
}

private actor LaneFitStore: ProjectPersisting {
    func load() async throws -> EditorProject? { nil }
    func save(_ project: EditorProject) async throws {}
}

/// The Ad 1 plan, reduced: place a new overlay, then move an existing one onto
/// the same moment, in one atomic edit.
@MainActor
@Suite(.serialized)
struct OverlayLaneFitPlanTests {
    @Test func addingThenMovingOntoTheSameTimeApplies() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: "lane-fit-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let mainURL = root.appending(path: "main.mov"), brollURL = root.appending(path: "broll.mov")
        try await SyntheticVideo.write(color: NSColor.black.cgColor, size: CGSize(width: 160, height: 90), seconds: 8, to: mainURL)
        try await SyntheticVideo.write(color: NSColor.blue.cgColor, size: CGSize(width: 160, height: 90), seconds: 3, to: brollURL)
        let main = try await MediaProbe.inspect(url: mainURL), broll = try await MediaProbe.inspect(url: brollURL)
        let liveCall = ProjectOverlay(mediaID: broll.id, timelineStart: 5, duration: 2)
        let session = EditorSession(store: LaneFitStore())
        await Task.yield()
        defer { session.player.replaceCurrentItem(with: nil) }
        session.updateProject {
            $0 = EditorProject(media: [main, broll], clips: [TimelineClip(mediaID: main.id, sourceStart: 0, sourceEnd: 8)])
            $0.overlays = [liveCall]
        }
        func call(_ input: some AppActionInput) throws -> ChirpyActionCall {
            guard case .object(let fields) = try ActionJSON.encoding(input) else { throw AppActionError("bad") }
            return .init(action: type(of: input).actionID.rawValue, arguments: fields)
        }
        let at = TimelineAnchorInput(kind: .time, time: 1, phrase: nil, occurrence: nil, eventID: nil, offset: nil)
        let plan = [
            try call(OverlayAddInput(mediaID: broll.id, at: at, duration: 2, until: nil, sourceStart: nil)),
            try call(OverlayPropertiesInput(overlayIDs: [liveCall.id], all: false, hidden: nil, behindSpeaker: nil, backdrop: nil,
                                            sourceStart: nil, timelineStart: 1.5, duration: nil, track: nil)),
        ]

        let receipts = await session.appActions.executeBatch(plan, projectID: session.project.id,
                                                            revision: session.actionRevision, in: session)

        #expect(receipts.allSatisfy { $0.status == .applied })
        let moved = try #require(session.overlays.first { $0.id == liveCall.id })
        #expect(moved.timelineStart == 1.5 && moved.lane == 1)
        #expect(session.overlays.count == 2)
        // A refused plan is answered in the conversation, not by the editor's
        // error sheet as well.
        #expect(session.errorMessage == nil)
    }

    @Test func aRefusedPlanDoesNotRaiseTheErrorSheet() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: "lane-fit-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let url = root.appending(path: "main.mov")
        try await SyntheticVideo.write(color: NSColor.black.cgColor, size: CGSize(width: 160, height: 90), seconds: 4, to: url)
        let main = try await MediaProbe.inspect(url: url)
        let session = EditorSession(store: LaneFitStore())
        await Task.yield()
        defer { session.player.replaceCurrentItem(with: nil) }
        session.updateProject { $0 = EditorProject(media: [main], clips: [TimelineClip(mediaID: main.id, sourceStart: 0, sourceEnd: 4)]) }
        let missing = TextLayerUpdateInput(textLayerID: UUID(), text: "x", timelineStart: nil, duration: nil)
        guard case .object(let fields) = try ActionJSON.encoding(missing) else { throw AppActionError("bad") }
        let add = TextLayerAddInput(text: "Hi", at: nil, duration: nil, asHook: nil, style: nil)
        guard case .object(let addFields) = try ActionJSON.encoding(add) else { throw AppActionError("bad") }

        let receipts = await session.appActions.executeBatch([
            .init(action: AppActionID.textLayerAdd.rawValue, arguments: addFields),
            .init(action: AppActionID.textLayerUpdate.rawValue, arguments: fields),
        ], projectID: session.project.id, revision: session.actionRevision, in: session)

        #expect(receipts.allSatisfy { $0.status == .rejected })
        #expect(session.errorMessage == nil)
        #expect(session.project.textLayers?.isEmpty ?? true)
    }
}

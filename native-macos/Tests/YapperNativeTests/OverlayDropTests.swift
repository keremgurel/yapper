import AppKit
import Foundation
import Testing
@testable import YapperNative

/// The rendered check drops only the cards that fail it. Stubbed backend; the
/// renders and saves are real.
@Suite(.serialized)
@MainActor
struct OverlayDropTests {
    private actor NoSave: ProjectPersisting {
        func load() async throws -> EditorProject? { nil }
        func save(_ project: EditorProject) async throws {}
    }

    /// A card name the stub fails, and what its final check refunds.
    private struct Plan {
        var failing: Set<String> = []
        var refunded: [String: [String: Int]] = [:]
        var broken: Set<String> = []
    }

    private final class Calls {
        var reviews: [[String: Any]] = []
    }

    private func session(_ plan: Plan, calls: Calls, root: URL) -> EditorSession {
        EditorSession(store: NoSave(), generatedAssetRoot: root, generatedOverlayRequest: { path, body in
            guard path == "review-overlay" else { throw NativeEditorError.aiFailed("unexpected \(path)") }
            calls.reviews.append(body)
            let asset = body["asset"] as? [String: Any] ?? [:]
            let name = asset["name"] as? String ?? ""
            if plan.broken.contains(name) { throw NativeEditorError.aiFailed("offline") }
            guard plan.failing.contains(name) else { return ["passed": true, "issues": []] }
            if body["repair"] as? Bool == true {
                return ["passed": false, "issues": ["Clipped"], "repaired": ["name": name, "description": "", "images": [],
                        "scene": asset["scene"] ?? [:]]]
            }
            var reply: [String: Any] = ["passed": false, "issues": ["Clipped at 1.2s"]]
            if let refunded = plan.refunded[name] { reply["refunded"] = refunded }
            return reply
        })
    }

    private func card(_ name: String, root: URL) async throws -> ProjectMedia {
        try await GeneratedOverlayService.save(
            reply: ["name": name, "description": "A card.", "scene": ["version": 1, "duration": 2,
                "nodes": [["id": "card", "type": "rect", "x": 0.5, "y": 0.5, "width": 1, "height": 1, "fill": "#0000FF"]],
                "animations": []]],
            brand: nil, moment: [:], size: CGSize(width: 400, height: 240), instruction: "", root: root)
    }

    private func setUp(_ plan: Plan, names: [String]) async throws
        -> (EditorSession, EditorProject, [ProjectMedia], Calls, URL) {
        let root = FileManager.default.temporaryDirectory.appending(path: "overlay-drop-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let video = root.appending(path: "source.mov")
        try await SyntheticVideo.write(color: NSColor.darkGray.cgColor, size: CGSize(width: 270, height: 480), seconds: 6, to: video)
        let calls = Calls()
        let session = session(plan, calls: calls, root: root)
        await session.importMedia([video])
        let previous = session.project
        var cards: [ProjectMedia] = []
        for (index, name) in names.enumerated() {
            let media = try await card(name, root: root)
            cards.append(media)
            session.updateProject { project in
                project.media.append(media)
                project.overlays = (project.overlays ?? []) + [ProjectOverlay(mediaID: media.id, timelineStart: 0.5 + Double(index) * 2.5,
                    duration: 2, x: 0.1, y: 0.1, width: 0.8, height: 0.3)]
            }
        }
        return (session, previous, cards, calls, root)
    }

    private func charges(_ cards: [ProjectMedia]) -> [UUID: GeneratedOverlayCharge] {
        Dictionary(uniqueKeysWithValues: cards.map {
            ($0.id, GeneratedOverlayCharge(usageId: "00000000-0000-4000-8000-000000000002", id: $0.id.uuidString)!)
        })
    }

    @Test func partialFailureKeepsThePassingCardAndNamesTheDroppedOne() async throws {
        var plan = Plan(failing: ["Loss chip"])
        plan.refunded["Loss chip"] = ["credits": 30, "run": 0]
        let (session, previous, cards, calls, root) = try await setUp(plan, names: ["Revenue counter", "Loss chip"])
        defer { try? FileManager.default.removeItem(at: root) }

        let review = try await session.verifyGeneratedChanges(since: previous, instruction: "Add overlays", charges: charges(cards))

        #expect(session.project.media.contains { $0.id == cards[0].id })
        #expect(!session.project.media.contains { $0.id == cards[1].id })
        #expect(session.project.overlays?.map(\.mediaID) == [cards[0].id])
        #expect(review.dropped == [cards[1].id])
        #expect(review.notes == ["Left out Loss chip because it did not pass the visual check: Clipped at 1.2s. 30 credits were refunded."])
        // Both cards are rechecked after each repair; the failing one drops on
        // its third and last check.
        let checked = calls.reviews.map { ($0["asset"] as? [String: Any])?["name"] as? String }
        #expect(checked.filter { $0 == "Revenue counter" }.count == 3)
        #expect(checked.filter { $0 == "Loss chip" }.count == 3)
        #expect(calls.reviews.last?["repair"] as? Bool == false)
        #expect(calls.reviews.allSatisfy { ($0["charge"] as? [String: String])?["usageId"] != nil })
    }

    @Test func totalFailureLeavesTheProjectAsItWasAndSaysWhatCameBack() async throws {
        var plan = Plan(failing: ["Comparison card"])
        plan.refunded["Comparison card"] = ["credits": 30, "run": 10]
        let (session, previous, cards, _, root) = try await setUp(plan, names: ["Comparison card"])
        defer { try? FileManager.default.removeItem(at: root) }

        let review = try await session.verifyGeneratedChanges(since: previous, instruction: "Add overlays", charges: charges(cards))

        #expect(session.project == previous)
        #expect(review.notes == [
            "Left out Comparison card because it did not pass the visual check: Clipped at 1.2s. 30 credits were refunded.",
            "No visual made it into the video, so the 10 credit planning charge was refunded too.",
        ])
    }

    @Test func allPassKeepsEveryCardAndSaysNothingExtra() async throws {
        let (session, previous, cards, calls, root) = try await setUp(Plan(), names: ["Revenue counter", "End line"])
        defer { try? FileManager.default.removeItem(at: root) }

        let review = try await session.verifyGeneratedChanges(since: previous, instruction: "Add overlays", charges: charges(cards))

        #expect(review == GeneratedOverlayReview())
        #expect(session.project.overlays?.count == 2)
        #expect(calls.reviews.count == 2)
        #expect(session.project.media.filter(\.isScene).allSatisfy {
            $0.generated?.versions.last?.notes.contains { $0.contains("Composited-frame review passed") } == true
        })
    }

    @Test func aCheckThatCannotRunDropsOnlyThatCard() async throws {
        let (session, previous, cards, _, root) = try await setUp(Plan(broken: ["Ad list"]), names: ["Ad list", "End line"])
        defer { try? FileManager.default.removeItem(at: root) }

        let review = try await session.verifyGeneratedChanges(since: previous, instruction: "Add overlays")

        #expect(review.dropped == [cards[0].id])
        #expect(session.project.overlays?.map(\.mediaID) == [cards[1].id])
        #expect(review.notes.first?.hasPrefix("Left out Ad list because it did not pass the visual check: The visual check could not be completed") == true)
    }

    @Test func aFailedRevisionReturnsToItsPreviousVersion() async throws {
        let (session, _, cards, _, root) = try await setUp(Plan(failing: ["Revenue counter"]), names: ["Revenue counter"])
        defer { try? FileManager.default.removeItem(at: root) }
        let before = session.project
        let revised = try await GeneratedOverlayService.save(
            reply: ["name": "Revenue counter", "description": "Revised.", "scene": ["version": 1, "duration": 2,
                "nodes": [["id": "card", "type": "rect", "x": 0.5, "y": 0.5, "width": 1, "height": 1, "fill": "#FF0000"]],
                "animations": []]],
            brand: nil, moment: [:], size: CGSize(width: 400, height: 240), instruction: "Make it red", root: root, existing: cards[0])
        session.updateProject { project in
            if let index = project.media.firstIndex(where: { $0.id == revised.id }) { project.media[index] = revised }
        }

        let review = try await session.verifyGeneratedChanges(since: before, instruction: "Make it red")

        #expect(session.project == before)
        #expect(review.notes.first?.hasPrefix("Kept the previous version of Revenue counter") == true)
    }
}

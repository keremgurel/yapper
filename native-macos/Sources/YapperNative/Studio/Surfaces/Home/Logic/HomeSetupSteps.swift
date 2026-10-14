import Foundation

/// The three things a new creator does once. Home shows them until all three
/// are done, then never again. Same steps and words as the web's
/// `setup-steps.ts`.
struct HomeSetupStep: Equatable, Identifiable {
    enum ID: String { case idea, brain, channel }

    let id: ID
    let title: String
    let detail: String
    let done: Bool
    /// Where the step is finished. The idea step has none: the composer is
    /// right above it.
    let action: (label: String, destination: StudioDestination)?

    static func == (lhs: HomeSetupStep, rhs: HomeSetupStep) -> Bool {
        lhs.id == rhs.id && lhs.done == rhs.done
    }

    static func steps(brain: Bool, channel: Bool, idea: Bool) -> [HomeSetupStep] {
        [
            HomeSetupStep(
                id: .idea,
                title: "Capture your first idea",
                detail: "Type it or say it above. Yapper turns it into a script.",
                done: idea,
                action: nil
            ),
            HomeSetupStep(
                id: .brain,
                title: "Teach Yapper your voice",
                detail: "Tell it what you make and who it’s for.",
                done: brain,
                action: ("Open Brain", .brain)
            ),
            HomeSetupStep(
                id: .channel,
                title: "Connect a channel",
                detail: "Publish from Studio and see which posts land.",
                done: channel,
                action: ("Connect", .connections)
            ),
        ]
    }

    /// The Brain counts as started once the creator has said anything about
    /// what they make, who it is for, or how they sound, or has a pillar.
    static func brainStarted(_ project: BrainProject, pillarCount: Int) -> Bool {
        [project.whatIMake, project.audience, project.voice]
            .contains { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            || pillarCount > 0
    }
}

import Foundation

/// Whether one video can go to one platform, and if not, why. Mirrors
/// `lib/publish/destination-readiness.ts`.
struct PosterReadiness: Equatable {
    enum State: Equatable {
        case disconnected, empty, blocked, ready, scheduled, posted, failed

        var label: String {
            switch self {
            case .disconnected: "Not connected"
            case .empty: "Nothing written"
            case .blocked: "Needs a fix"
            case .ready: "Ready"
            case .scheduled: "Scheduled"
            case .posted: "Posted"
            case .failed: "Failed"
            }
        }

        var tone: NativeChip.Tone {
            switch self {
            case .disconnected, .empty: .neutral
            case .blocked, .failed: .yellow
            case .ready, .posted: .green
            case .scheduled: .cyan
            }
        }
    }

    let platform: PublishPlatform
    let spec: PosterCaptionSpec
    var state: State = .empty
    var blockers: [String] = []
    var notes: [String] = []
    let titleUsed: Int
    let bodyUsed: Int
    let hashtagsUsed: Int

    static func == (lhs: PosterReadiness, rhs: PosterReadiness) -> Bool {
        lhs.platform == rhs.platform && lhs.state == rhs.state && lhs.blockers == rhs.blockers
            && lhs.notes == rhs.notes && lhs.titleUsed == rhs.titleUsed && lhs.bodyUsed == rhs.bodyUsed
    }

    init(platform: PublishPlatform, connected: Bool, caption: PosterCaption, hasCover: Bool, outcome: PosterOutcome? = nil) {
        let spec = PosterCaptionSpec.of(platform)
        let body = caption.rendered
        self.platform = platform
        self.spec = spec
        titleUsed = caption.title.trimmingCharacters(in: .whitespacesAndNewlines).count
        bodyUsed = body.count
        hashtagsUsed = caption.hashtags.count

        if let outcome {
            switch outcome.status {
            case .posted, .draft: state = .posted
            case .scheduled: state = .scheduled
            case .pending: state = .scheduled
            case .failed: state = .failed
            }
            notes.append(outcome.summary)
            return
        }
        guard connected else {
            state = .disconnected
            blockers.append("Connect your \(platform.label) account first.")
            return
        }
        notes.append(platform.postMeaning)
        if platform == .instagram {
            notes.append("Needs a Professional account (Business or Creator). A personal account connects but cannot publish.")
        }
        let hasBody = !body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        if !hasBody && !(spec.hasTitle && titleUsed > 0) {
            state = .empty
            return
        }
        if spec.hasTitle && titleUsed == 0 { blockers.append("A title is required.") }
        if spec.hasTitle && titleUsed > spec.titleMax {
            blockers.append("Title is \(titleUsed - spec.titleMax) over the \(spec.titleMax) limit.")
        }
        if bodyUsed > spec.bodyMax {
            blockers.append("Caption is \(bodyUsed - spec.bodyMax) over the \(spec.bodyMax) limit.")
        }
        if !hasCover && spec.hasTitle { blockers.append("Pick a cover image.") }
        if hashtagsUsed < spec.hashtagMin {
            notes.append("\(spec.hashtagMin) to \(spec.hashtagMax) hashtags work best here.")
        }
        state = blockers.isEmpty ? .ready : .blocked
    }
}

/// What the publish button says and whether it can be pressed.
struct PosterPublishSummary: Equatable {
    let ready: Int
    let blocked: Int

    init(_ readiness: [PosterReadiness]) {
        ready = readiness.filter { $0.state == .ready }.count
        blocked = readiness.filter { $0.state == .blocked || $0.state == .disconnected }.count
    }

    var canPublish: Bool { ready > 0 }
    var label: String {
        switch ready {
        case 0: "Nothing ready to publish"
        case 1: "Publish to 1 destination"
        default: "Publish to \(ready) destinations"
        }
    }
}

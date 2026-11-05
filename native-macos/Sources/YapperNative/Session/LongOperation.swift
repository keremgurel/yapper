import Foundation

enum LongOperation: Equatable, Sendable {
    case importingMedia
    case importingAudio
    case relinkingMedia
    case transcribing
    case oneClickEdit
    case captions
    case autoTrim
    case overlayAI
    case exporting
    case recoveringMedia

    var isAI: Bool {
        switch self {
        case .transcribing, .oneClickEdit, .captions, .autoTrim, .overlayAI: true
        default: false
        }
    }

    var isExport: Bool { self == .exporting }

    /// What a refusal says while this holds the editor. "Wait for the current
    /// operation" left a creator staring at a Projects screen for minutes with
    /// nothing visibly running and no way to tell what to wait for.
    var waitMessage: String {
        switch self {
        case .importingMedia: "Wait for the media import to finish."
        case .importingAudio: "Wait for the audio import to finish."
        case .relinkingMedia: "Wait for the media relink to finish."
        case .transcribing: "Wait for transcription to finish."
        case .oneClickEdit: "Wait for 1-Click Edit to finish."
        case .captions: "Wait for captions to finish."
        case .autoTrim: "Wait for auto-trim to finish."
        case .overlayAI: "Wait for the overlay job to finish."
        case .exporting: "Wait for the export to finish."
        case .recoveringMedia: "Wait a moment: Yapper is checking the project's media files."
        }
    }

    var cancelLabel: String {
        switch self {
        case .transcribing: "Cancel transcription"
        case .oneClickEdit: "Cancel 1-Click Edit"
        case .captions: "Cancel captions"
        case .autoTrim: "Cancel auto-trim"
        case .overlayAI: "Cancel overlay placement"
        case .exporting: "Cancel export"
        default: "Cancel operation"
        }
    }
}

struct LongOperationLease: Equatable, Sendable {
    let operation: LongOperation
    let token: UUID
}

struct LongOperationCoordinator: Sendable {
    private(set) var active: LongOperationLease?

    mutating func acquire(_ operation: LongOperation) -> LongOperationLease? {
        guard active == nil else { return nil }
        let lease = LongOperationLease(operation: operation, token: UUID())
        active = lease
        return lease
    }

    @discardableResult
    mutating func release(_ lease: LongOperationLease) -> Bool {
        guard active?.token == lease.token else { return false }
        active = nil
        return true
    }
}

enum PendingMediaRecovery: Equatable, Sendable {
    case verify
    case restored

    mutating func merge(_ event: PendingMediaRecovery) {
        // Restoration includes identity verification plus rebuild/restart, so
        // it dominates a verification-only notification.
        if self == .restored || event == .restored { self = .restored }
    }
}

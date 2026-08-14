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

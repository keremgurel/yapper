import Foundation

/// Monotonic per-source tokens prevent cancelled or slow work from publishing
/// after a relink, delete, undo, redo, or rollback changed its identity.
struct DerivedMediaGenerationFence {
    private var generations: [UUID: Int] = [:]

    mutating func advance(_ mediaID: UUID) -> Int {
        generations[mediaID, default: 0] += 1
        return generations[mediaID, default: 0]
    }

    func accepts(_ mediaID: UUID, generation: Int) -> Bool {
        generations[mediaID] == generation
    }
}

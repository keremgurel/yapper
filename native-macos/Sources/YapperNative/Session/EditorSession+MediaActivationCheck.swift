import Foundation

extension EditorSession {
    /// Whether a file the edit needs no longer holds the bytes the project was
    /// built on. Reads the same samples the locked check reads, and holds
    /// nothing while it does, so an action started meanwhile is not refused.
    ///
    /// A file that cannot be read counts as changed: the locked check is the
    /// one that knows what to do about it.
    func requiredMediaChangedOnDisk() async -> Bool {
        do {
            for subject in MediaIdentitySubject.required(in: project) {
                guard try await subject.matchesDisk() else { return true }
            }
            return false
        } catch is CancellationError {
            return false
        } catch {
            return true
        }
    }
}

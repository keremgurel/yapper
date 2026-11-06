import Foundation

/// One export the app is running or has run this launch.
///
/// Everything here is captured when the job starts, so it still describes
/// the right project after the editor has moved on to another one.
struct ExportJob: Identifiable, Equatable, Sendable {
    enum Kind: String, Sendable {
        /// A file the creator chose a place for.
        case file
        /// Rendered to a temporary file, then uploaded to Poster.
        case poster
    }

    enum Result: Equatable, Sendable {
        case file(URL)
        case poster(itemID: String)
    }

    let id: UUID
    let kind: Kind
    let projectID: UUID
    let projectName: String
    let package: ProjectPackage?
    let destination: URL
    let startedAt: Date
    var state: ExportJobState
}

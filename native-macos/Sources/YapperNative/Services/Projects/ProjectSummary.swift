import Foundation

/// What the projects grid needs to draw a card without decoding the project.
///
/// Written beside `project.json` on every save. A grid of forty projects reads
/// forty small files instead of forty timelines, and a project whose media is
/// on an unplugged card still lists correctly.
struct ProjectSummary: Codable, Hashable, Sendable {
    struct PosterSource: Codable, Hashable, Sendable {
        var mediaURL: URL
        var time: Double
    }

    var id: UUID
    var name: String
    var createdAt: Date
    var updatedAt: Date
    /// Seconds of the edited timeline, after cuts.
    var duration: Double
    var clipCount: Int
    var mediaCount: Int
    /// Where a poster frame can be drawn from when none is cached yet.
    var posterSource: PosterSource?

    init(project: EditorProject) {
        id = project.id
        name = project.name
        createdAt = project.createdAt
        updatedAt = project.updatedAt
        duration = project.clips.reduce(0) { $0 + max(0, $1.sourceEnd - $1.sourceStart) }
        clipCount = project.clips.count
        mediaCount = project.media.count
        if let first = project.clips.first,
           let media = project.media.first(where: { $0.id == first.mediaID }),
           !media.isImage
        {
            posterSource = PosterSource(mediaURL: media.url, time: first.sourceStart)
        } else if let media = project.media.first(where: { !$0.isImage }) {
            posterSource = PosterSource(mediaURL: media.url, time: min(1, media.duration * 0.08))
        } else {
            posterSource = nil
        }
    }
}

/// A package with what its summary says about it.
struct ProjectListing: Identifiable, Hashable, Sendable {
    let package: ProjectPackage
    let summary: ProjectSummary

    var id: URL { package.url }
}

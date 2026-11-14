import Foundation

/// The kinds of file Yapper writes that each get their own folder, so editor
/// projects can live on an external drive while recorder downloads stay in
/// Downloads.
enum StorageKind: String, CaseIterable, Identifiable, Sendable {
    case editorProjects
    case editorRecordings
    case recorderDownloads
    case exports

    var id: String { rawValue }

    var title: String {
        switch self {
        case .editorProjects: "Editor projects"
        case .editorRecordings: "Recordings for the editor"
        case .recorderDownloads: "Recorder downloads"
        case .exports: "Exports"
        }
    }

    /// What lands in the folder.
    var detail: String {
        switch self {
        case .editorProjects: "Every project, with the footage imported into it."
        case .editorRecordings: "Takes you open in the editor from the recorder."
        case .recorderDownloads: "Takes you save with Download in the recorder."
        case .exports: "Where the export window opens."
        }
    }

    /// The lowercase name used inside a sentence.
    var phrase: String {
        switch self {
        case .editorProjects: "editor projects"
        case .editorRecordings: "recordings for the editor"
        case .recorderDownloads: "recorder downloads"
        case .exports: "exports"
        }
    }

    var systemImage: String {
        switch self {
        case .editorProjects: "film.stack"
        case .editorRecordings: "video"
        case .recorderDownloads: "arrow.down.to.line"
        case .exports: "square.and.arrow.up"
        }
    }

    /// Exports have no folder of their own until one is chosen: the export
    /// window keeps opening wherever the last export went.
    var usesLastFolderByDefault: Bool { self == .exports }

    var defaultsKey: String { "storageFolder.\(rawValue)" }
}

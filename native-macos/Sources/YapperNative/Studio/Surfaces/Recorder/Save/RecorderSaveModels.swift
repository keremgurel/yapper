import Foundation

/// `POST /api/media/upload-url` body.
struct RecorderUploadRequest: Encodable {
    let sizeBytes: Int
    let mimeType: String
    let ext: String
    let purpose = "recording"
}

/// `POST /api/media/upload-url` reply: where to PUT the file, and its key.
struct RecorderUploadTicket: Codable, Equatable {
    let url: String
    let key: String
}

/// `POST /api/submissions` body. A take with no idea asks the route to make
/// its own library item.
struct RecorderSubmissionRequest: Encodable {
    let mediaKey: String
    let title: String?
    let createLibraryItem: Bool?
}

/// `POST /api/submissions` reply, reduced to what linking needs.
struct RecorderSubmissionEnvelope: Codable, Equatable {
    struct Submission: Codable, Equatable {
        let id: String
        let contentItemId: String?
    }
    let submission: Submission
}

/// `PATCH /api/content/[id]` body that links the take to its idea.
struct RecorderLinkRequest: Encodable {
    let submissionId: String
}

/// Why a save failed, in the words the web recorder uses.
enum RecorderSaveError: Error, Equatable {
    case storageFull, locked, tooLarge, unavailable, failed

    var message: String {
        switch self {
        case .storageFull: "You're out of storage. Delete old sessions or upgrade."
        case .locked: "Saving recordings needs a subscription."
        case .tooLarge: "This take exceeds the upload limit. Download it to keep a copy and shorten it before uploading."
        case .unavailable: "Cloud storage is unavailable. Your take is still here; download it or try saving again later."
        case .failed: "Could not save the take. It's still here; try again."
        }
    }

    static func from(_ error: Error) -> RecorderSaveError {
        if let known = error as? RecorderSaveError { return known }
        guard let api = error as? StudioAPIError else { return .failed }
        switch api.code {
        case "not_entitled": return .locked
        case "storage_full": return .storageFull
        case "clip_too_large", "media_too_large": return .tooLarge
        case "storage_unavailable": return .unavailable
        default: return api.status == 413 ? .tooLarge : .failed
        }
    }
}

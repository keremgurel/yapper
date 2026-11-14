import Foundation

/// One thing to warn about: a drive or folder that several kinds of file may
/// share, and the open project when it lives there too.
struct StorageWarning: Equatable, Identifiable, Sendable {
    let availability: StorageAvailability
    let kinds: [StorageKind]
    /// The open project's name, when it is on the missing drive.
    var openProjectName: String?

    var id: String {
        "\(availability)|\(kinds.map(\.rawValue).joined(separator: ","))|\(openProjectName ?? "")"
    }

    var message: String {
        if kinds.isEmpty, case .driveDisconnected(let name) = availability {
            return "“\(name)” isn’t connected."
        }
        return StorageWarningCopy.summary(kinds: kinds, availability: availability) ?? ""
    }

    var openProjectNote: String? {
        guard let openProjectName else { return nil }
        return "“\(openProjectName)” is open from it, so edits you make now can’t be saved. Plug it back in to keep working."
    }

    /// Groups the folders that can't be used by drive, in the order the kinds
    /// are listed, and folds in the open project when it is on one of them.
    static func list(statuses: [StorageKind: StorageAvailability], openProject: ProjectPackage?) -> [StorageWarning] {
        var warnings: [StorageWarning] = []
        for kind in StorageKind.allCases {
            let availability = statuses[kind] ?? .available
            guard availability != .available else { continue }
            if let index = warnings.firstIndex(where: { $0.availability == availability }) {
                warnings[index] = StorageWarning(availability: availability, kinds: warnings[index].kinds + [kind])
            } else {
                warnings.append(StorageWarning(availability: availability, kinds: [kind]))
            }
        }
        guard let openProject,
              case .driveDisconnected = StorageAvailability.check(openProject.url, isDefault: false)
        else { return warnings }
        let drive = StorageAvailability.check(openProject.url, isDefault: false)
        if let index = warnings.firstIndex(where: { $0.availability == drive }) {
            warnings[index].openProjectName = openProject.displayName
        } else {
            warnings.insert(StorageWarning(availability: drive, kinds: [], openProjectName: openProject.displayName), at: 0)
        }
        return warnings
    }
}

import Foundation

/// What an export renders, frozen the moment it starts.
///
/// A value copy of the project model plus the package it came from. After
/// this is taken the editor can keep changing the project, open another one,
/// or close it, and the export still renders exactly this. The footage gets
/// the same treatment as the job's first step: see `ExportSourceSnapshot`.
struct ExportProjectSnapshot: Sendable {
    let project: EditorProject
    let package: ProjectPackage?

    var projectID: UUID { project.id }
    var projectName: String { project.name }
}

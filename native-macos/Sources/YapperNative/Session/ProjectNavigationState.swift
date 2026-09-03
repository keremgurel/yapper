import Foundation

/// Which project is open and whether the projects grid is showing, kept apart
/// from the editor session so the shell can observe this and nothing else.
/// Observing the whole session from the shell would rebuild the sidebar on
/// every caption edit; see `PreviewPresentationState` for the same reasoning.
@MainActor
final class ProjectNavigationState: ObservableObject {
    @Published var currentPackage: ProjectPackage?
    /// True while the grid of projects covers the editor.
    @Published var showsProjectsHome = false
    @Published var recentProjects: [URL] = RecentProjects.all()
    /// Bumped whenever a package is created, renamed, duplicated or trashed, so
    /// the grid reloads without polling the folder.
    @Published var libraryVersion = 0

    func noteOpened(_ package: ProjectPackage) {
        currentPackage = package
        RecentProjects.record(package.url)
        recentProjects = RecentProjects.all()
        showsProjectsHome = false
    }

    func noteLibraryChanged() {
        recentProjects = RecentProjects.all()
        libraryVersion += 1
    }
}

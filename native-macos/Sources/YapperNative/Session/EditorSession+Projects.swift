import Foundation

/// Opening, creating and managing projects. Each project is a package in the
/// library; the session swaps its store to the package's and restores from it,
/// so everything the editor already does to save and recover keeps working
/// per project.
extension EditorSession {
    /// At launch: the project that was open last, or the projects grid.
    ///
    /// The one legacy `CurrentProject.json` is migrated into the library first,
    /// so a creator upgrading finds their work as the first project rather than
    /// an empty grid.
    func restoreLastProject() async {
        do {
            if let migrated = try await library.migrateLegacyProject(from: ProjectStore.directory) {
                await openProject(migrated)
                return
            }
        } catch {
            show(error)
        }
        if let last = RecentProjects.lastOpened,
           FileManager.default.fileExists(atPath: ProjectPackage(url: last).projectFileURL.path)
        {
            await openProject(ProjectPackage(url: last))
            return
        }
        projectNavigation.showsProjectsHome = true
    }

    func openProject(_ package: ProjectPackage) async {
        if projectNavigation.currentPackage == package {
            projectNavigation.showsProjectsHome = false
            return
        }
        await leaveCurrentProject()
        store = ProjectPackageStore(package: package)
        projectNavigation.noteOpened(package)
        if (try? await store.load()) != nil {
            await restoreProject()
        } else {
            // A package with no project inside yet: freshly created, or its
            // file lost. Start it empty rather than showing the last project's
            // timeline under the wrong name.
            resetProject(to: EditorProject(name: package.displayName))
            try? await persist()
        }
    }

    func createProject(named name: String) async {
        do {
            let package = try await library.create(named: name)
            projectNavigation.noteLibraryChanged()
            await openProject(package)
        } catch {
            show(error)
        }
    }

    /// Screen Studio's "Create project from video": one drop, a project named
    /// after the file, with the file already on the timeline.
    func createProject(fromVideos urls: [URL]) async {
        guard let first = urls.first else { return }
        await createProject(named: first.deletingPathExtension().lastPathComponent)
        await importMedia(urls)
    }

    func renameCurrentProject(to name: String) async {
        guard let package = projectNavigation.currentPackage else { return }
        do {
            let renamed = try await library.rename(package, to: name)
            store = ProjectPackageStore(package: renamed)
            projectNavigation.currentPackage = renamed
            var updated = project
            updated.name = renamed.displayName
            resetProject(to: updated, keepingHistory: true)
            try await persist()
            projectNavigation.noteLibraryChanged()
        } catch {
            show(error)
        }
    }

    func duplicateCurrentProject() async {
        guard let package = projectNavigation.currentPackage else { return }
        try? await persist()
        await duplicateProject(package)
    }

    func duplicateProject(_ package: ProjectPackage) async {
        do {
            let copy = try await library.duplicate(package)
            projectNavigation.noteLibraryChanged()
            await openProject(copy)
        } catch {
            show(error)
        }
    }

    /// Into the Trash. Trashing the open project leaves the grid showing.
    func trashProject(_ package: ProjectPackage) async {
        do {
            if projectNavigation.currentPackage == package {
                await leaveCurrentProject()
                store = ProjectStore(directory: FileManager.default.temporaryDirectory
                    .appending(path: "yapper-detached-\(UUID().uuidString)", directoryHint: .isDirectory))
                projectNavigation.currentPackage = nil
                resetProject(to: EditorProject())
                projectNavigation.showsProjectsHome = true
            }
            try await library.trash(package)
            await ProjectPosterLoader.shared.invalidate(package)
            projectNavigation.noteLibraryChanged()
        } catch {
            show(error)
        }
    }

    /// The same project written to a second package, which then becomes the
    /// open one. What Cmd+S means in an app that already saves everything.
    func saveCopy(to url: URL) async {
        let destination = ProjectPackage(url: url)
        do {
            try FileManager.default.createDirectory(at: destination.url, withIntermediateDirectories: true)
            var copy = project
            copy.id = UUID()
            copy.name = destination.displayName
            store = ProjectPackageStore(package: destination)
            resetProject(to: copy, keepingHistory: true)
            try await persist()
            projectNavigation.noteOpened(destination)
            projectNavigation.noteLibraryChanged()
        } catch {
            show(error)
        }
    }

    func showProjectsHome() {
        pausePlayback()
        projectNavigation.showsProjectsHome = true
    }

    func hideProjectsHome() {
        guard projectNavigation.currentPackage != nil else { return }
        projectNavigation.showsProjectsHome = false
    }

    /// Everything the open project needs before another takes its place: a
    /// paused player, a final save, and a poster that reflects the last edit.
    private func leaveCurrentProject() async {
        pausePlayback()
        guard let current = projectNavigation.currentPackage else { return }
        try? await persist()
        await ProjectPosterLoader.shared.invalidate(current)
    }
}

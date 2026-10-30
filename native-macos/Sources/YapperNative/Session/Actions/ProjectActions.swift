import Foundation

/// The project library as actions: the projects grid, the File menu and Chirpy
/// all create, open, rename, duplicate and trash through these.
extension AppActionRegistry {
    func registerProjectActions() {
        registerApp(ProjectCreateInput.self) { session, input in
            let deferred = await session.changeProjectsAfterAssistantTurn { await session.createProject(named: input.name) }
            return session.projectReceipt("project.open", from: session.project.name, to: input.name,
                message: deferred ? "Creating “\(input.name)” and opening it." : "Created “\(input.name)”.")
        }
        registerApp(ProjectOpenInput.self) { session, input in
            let listing = try await session.libraryProject(input.projectID)
            guard !session.isOpen(listing) else {
                // From the projects grid, opening the open project goes back to it.
                session.projectNavigation.showsProjectsHome = false
                return AppActionMutation(message: "“\(listing.summary.name)” is already open.")
            }
            let deferred = await session.changeProjectsAfterAssistantTurn { await session.openProject(listing.package) }
            return session.projectReceipt("project.open", from: session.project.name, to: listing.summary.name,
                message: deferred ? "Opening “\(listing.summary.name)”." : "Opened “\(listing.summary.name)”.")
        }
        registerApp(ProjectRenameInput.self, availability: { session in
            session.projectNavigation.currentPackage == nil ? .init(reason: "Open a project to rename it.") : .available
        }) { session, input in
            let old = session.project.name
            guard input.name != old else { return AppActionMutation(message: "The project is already called “\(old)”.") }
            let deferred = await session.changeProjectsAfterAssistantTurn { await session.renameCurrentProject(to: input.name) }
            return session.projectReceipt("project.name", from: old, to: input.name,
                message: deferred ? "Renaming the project to “\(input.name)”." : "Renamed the project to “\(input.name)”.")
        }
        registerApp(ProjectDuplicateInput.self) { session, input in
            let listing = try await session.libraryProject(input.projectID)
            let deferred = await session.changeProjectsAfterAssistantTurn {
                if session.isOpen(listing) {
                    await session.duplicateCurrentProject()
                } else {
                    await session.duplicateProject(listing.package)
                }
            }
            return session.projectReceipt("project.open", from: session.project.name, to: "Copy of \(listing.summary.name)",
                message: deferred ? "Duplicating “\(listing.summary.name)” and opening the copy." : "Duplicated “\(listing.summary.name)”.")
        }
        registerApp(ProjectTrashInput.self, confirmation: { session, input in
            let listing = try await session.libraryProject(input.projectID)
            return AppActionConfirmation(title: "Move “\(listing.summary.name)” to the Trash?",
                detail: "You can put it back from the Trash in Finder.", confirmLabel: "Move to Trash")
        }) { session, input in
            let listing = try await session.libraryProject(input.projectID)
            if PosterProjectSync.shared.isUploading(projectID: listing.summary.id) {
                throw AppActionError("Wait for this project’s upload to finish before moving it to Trash.")
            }
            let deferred = await session.changeProjectsAfterAssistantTurn { await session.trashProject(listing.package) }
            return session.projectReceipt("project.trashed", from: listing.summary.name, to: "Trash",
                message: deferred ? "Moving “\(listing.summary.name)” to the Trash." : "Moved “\(listing.summary.name)” to the Trash.")
        }
    }
}

extension EditorSession {
    /// By ID: the same folder can be listed under two spellings of its path.
    func isOpen(_ listing: ProjectListing) -> Bool {
        projectNavigation.currentPackage != nil && listing.summary.id == project.id
    }

    /// A project in the library by its stable ID, or the one that is open.
    func libraryProject(_ id: UUID) async throws -> ProjectListing {
        if let listing = try await library.listings().first(where: { $0.summary.id == id }) { return listing }
        if id == project.id, let package = projectNavigation.currentPackage {
            return ProjectListing(package: package, summary: ProjectSummary(project: project))
        }
        throw AppActionError("That project is not in your library.")
    }

    /// Swapping or renaming the open project under a running Chirpy turn would
    /// file the turn's receipt in the wrong project and cancel the turn itself,
    /// so during a turn the change waits until it ends. Returns whether it waited.
    func changeProjectsAfterAssistantTurn(_ change: @escaping @MainActor () async -> Void) async -> Bool {
        guard let turn = assistantTask else {
            await change()
            return false
        }
        Task { @MainActor in
            await turn.value
            await change()
        }
        return true
    }

    func projectReceipt(_ property: String, from before: String, to after: String, message: String) -> AppActionMutation {
        AppActionMutation(message: message,
            changes: [.init(targetID: project.id, property: property, before: before, after: after)])
    }
}

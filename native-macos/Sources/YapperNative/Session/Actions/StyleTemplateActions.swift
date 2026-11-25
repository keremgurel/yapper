import Foundation

/// Style library templates: applying one to the project, and the settings
/// that belong to the template itself. Everything else a template sets
/// (caption style, backdrop, a clip's framing) is an ordinary project value
/// with its own action, so those are not repeated here.
extension AppActionRegistry {
    func registerStyleTemplateActions() {
        registerStyleApply()
        registerStyleSplit()
        registerStyleTopVisual()
    }

    private func registerStyleApply() {
        register(StyleApplyInput.self, availability: { session in
            session.project.clips.isEmpty ? .init(reason: "Add a clip to the main track before applying a template.") : .available
        }) { session, input in
            let catalog = StyleTemplateCatalog.bundled
            guard let plan = catalog.template(input.templateID) else {
                let ids = catalog.templates.map(\.id).joined(separator: ", ")
                throw AppActionError("There is no template called \(input.templateID). Choose one of: \(ids).")
            }
            let topMedia = try input.topMediaID.map { try session.styleTopMedia($0) }
            if let captions = plan.captions { _ = try TextStylePatch(captions.style) }

            let before = session.project
            var skipped: [UUID] = []
            session.updateProject { project in
                skipped = project.applyStyleLayout(plan)
                if let backdrop = plan.backdrop { project.applyStyleBackdrop(backdrop) }
                if let captions = plan.captions { try? project.applyStyleCaptions(captions) }
            }
            if let topMedia, session.project.styleTopBox != nil {
                session.placeStyleTopVisual(topMedia)
            }
            let changes = [AppActionChange(targetID: before.id, property: "style",
                                           before: before.appliedStyle?.templateID ?? "none", after: plan.id)]
            let gaps = plan.unsupported.isEmpty ? "" : " · " + plan.unsupported.joined(separator: " ")
            return AppActionMutation(message: "\(plan.name) applied\(gaps)", changes: changes, skippedIDs: skipped)
        }
    }

    private func registerStyleSplit() {
        register(StyleSplitInput.self, availability: { session in
            session.project.cameraRegion == nil ? .init(reason: "Apply the half-and-half template first.") : .available
        }) { session, input in
            guard input.seam != nil || input.cameraZoom != nil || input.cameraFocusY != nil || input.visualInset != nil else {
                throw AppActionError("Include seam, cameraZoom, cameraFocusY or visualInset.")
            }
            let before = session.project.styleSplitSettings
            var skipped: [UUID] = []
            session.updateProject { project in
                skipped = project.setStyleSplit(input)
            }
            let after = session.project.styleSplitSettings
            let changes = try PropertyChanges.diff(targetID: session.project.id, before: before, after: after, prefix: "split")
            let fields = PropertyChanges.fieldNames(changes).joined(separator: ", ")
            return AppActionMutation(message: changes.isEmpty ? "The split already looks like that." : "Split · \(fields)",
                                     changes: changes, skippedIDs: skipped)
        }
    }

    private func registerStyleTopVisual() {
        register(StyleTopVisualInput.self, availability: { session in
            session.project.styleTopBox == nil ? .init(reason: "Apply the half-and-half template first.") : .available
        }) { session, input in
            let media = try session.styleTopMedia(input.mediaID)
            let before = session.project.styleTopOverlay.flatMap { session.media(for: $0)?.name } ?? "empty"
            let overlay = session.placeStyleTopVisual(media)
            return AppActionMutation(
                message: "Top half · \(media.name)",
                changes: [.init(targetID: overlay.id, property: "topVisual", before: before, after: media.name)],
                afterCommit: { session.selectTimelineItem(.overlay(overlay.id)) }
            )
        }
    }
}

extension EditorSession {
    /// Media the creator imported, checked before anything is changed.
    func styleTopMedia(_ id: UUID) throws -> ProjectMedia {
        guard let media = project.media.first(where: { $0.id == id }) else {
            throw AppActionError("That media is not in this project. Import it first.")
        }
        guard media.isImage || media.duration > 0.1 else {
            throw AppActionError("\(media.name) has no picture to show.")
        }
        return media
    }

    /// Puts `media` in the top area: swaps what the template's top visual
    /// shows, or adds one covering the whole video when there is none yet.
    @discardableResult
    func placeStyleTopVisual(_ media: ProjectMedia) -> ProjectOverlay {
        if let existing = project.styleTopOverlay {
            updateProject { project in
                guard let index = project.overlays?.firstIndex(where: { $0.id == existing.id }) else { return }
                project.overlays![index].mediaID = media.id
                project.overlays![index].sourceStart = 0
                if !media.isImage {
                    project.overlays![index].duration = min(existing.duration, media.duration)
                }
                project.fitStyleTopOverlay()
            }
            return project.styleTopOverlay ?? existing
        }
        let length = media.isImage ? duration : min(duration, media.duration)
        let overlay = introducedOverlay(media: media, timelineStart: 0, duration: max(0.1, length))
        updateProject { project in
            project.overlays = (project.overlays ?? []) + [overlay]
            project.appliedStyle?.topOverlayID = overlay.id
            project.fitStyleTopOverlay()
        }
        return project.styleTopOverlay ?? overlay
    }
}

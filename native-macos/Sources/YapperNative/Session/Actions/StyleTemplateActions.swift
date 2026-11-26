import Foundation

/// Style library templates: offering them, laying one over a stretch of the
/// video, and the settings that belong to a laid-out stretch. Everything else
/// a template sets (caption style, backdrop) is an ordinary project value with
/// its own action, so those are not repeated here.
extension AppActionRegistry {
    func registerStyleTemplateActions() {
        registerStyleOffer()
        registerStyleApply()
        registerStyleSplit()
        registerStyleTopVisual()
    }

    private func registerStyleOffer() {
        register(StyleOfferInput.self, availability: { session in
            session.project.clips.isEmpty ? .init(reason: "Add a clip to the main track first.") : .available
        }) { session, input in
            let catalog = StyleTemplateCatalog.bundled
            let wanted = input.templateIDs ?? catalog.templates.map(\.id)
            let plans = wanted.compactMap(catalog.template)
            guard !plans.isEmpty else {
                throw AppActionError("None of those templates exist. Choose from: \(catalog.templates.map(\.id).joined(separator: ", ")).")
            }
            let ranges = try StyleRange.resolve(at: input.at, until: input.until, project: session.project, playhead: session.currentTime)
            let extent = session.project.timelineExtent(of: ranges)
            let offer = StyleOffer(at: input.at, until: input.until, start: extent.lowerBound, end: extent.upperBound,
                                   templateIDs: plans.map(\.id))
            session.pendingStyleOffer = offer
            let choices = plans.map { "\($0.name) (\($0.id))" }.joined(separator: ", ")
            return AppActionMutation(message: "Pick a look for \(StyleOfferLabel.range(offer)): \(choices).")
        }
    }

    private func registerStyleApply() {
        register(StyleApplyInput.self, availability: { session in
            session.project.clips.isEmpty ? .init(reason: "Add a clip to the main track before applying a template.") : .available
        }) { session, input in
            let catalog = StyleTemplateCatalog.bundled
            guard let plan = catalog.template(input.templateID) else {
                throw AppActionError("There is no template called \(input.templateID). Choose one of: \(catalog.templates.map(\.id).joined(separator: ", ")).")
            }
            let ranges = try StyleRange.resolve(at: input.at, until: input.until, project: session.project, playhead: session.currentTime)
            guard !ranges.isEmpty else { throw AppActionError("There is no recorded take on the main track to lay out.") }
            let topMedia = try input.topMediaID.map { try session.styleTopMedia($0) }
            if let captions = plan.captions { _ = try TextStylePatch(captions.style) }

            var placed: [LayoutSpan] = []
            session.updateProject { project in
                placed = project.applyStyleTemplate(plan, over: ranges)
            }
            if let topMedia, let first = placed.first {
                session.placeStyleTopVisual(topMedia, in: first.id)
            }
            let changes = placed.map { AppActionChange(targetID: $0.id, property: "layout", before: "full frame", after: plan.id) }
                + [AppActionChange(targetID: session.project.id, property: "style", before: "", after: plan.id)]
            let gaps = plan.unsupported.isEmpty ? "" : " · " + plan.unsupported.joined(separator: " ")
            return AppActionMutation(message: "\(plan.name) applied\(gaps)", changes: changes)
        }
    }

    private func registerStyleSplit() {
        register(StyleSplitInput.self, availability: { session in
            session.project.resolvedLayoutSpans.isEmpty ? .init(reason: "Lay a split over part of the video first.") : .available
        }) { session, input in
            guard let before = session.project.layoutSpan(input.spanID) else { throw AppActionError("That laid-out stretch no longer exists.") }
            guard input.seam != nil || input.cameraZoom != nil || input.cameraFocusY != nil || input.visualInset != nil else {
                throw AppActionError("Include seam, cameraZoom, cameraFocusY or visualInset.")
            }
            session.updateProject { $0.setSplit(input.spanID, input) }
            let after = session.project.layoutSpan(input.spanID)?.settings ?? before.settings
            let changes = try PropertyChanges.diff(targetID: input.spanID, before: before.settings, after: after, prefix: "split")
            let fields = PropertyChanges.fieldNames(changes).joined(separator: ", ")
            return AppActionMutation(message: changes.isEmpty ? "The split already looks like that." : "Split · \(fields)", changes: changes)
        }
    }

    private func registerStyleTopVisual() {
        register(StyleTopVisualInput.self, availability: { session in
            session.project.resolvedLayoutSpans.isEmpty ? .init(reason: "Lay a split over part of the video first.") : .available
        }) { session, input in
            guard let span = session.project.layoutSpan(input.spanID), session.project.topBox(of: span) != nil else {
                throw AppActionError("That stretch has no top area. Lay a split over it first.")
            }
            let media = try session.styleTopMedia(input.mediaID)
            let before = session.project.topOverlay(of: span).flatMap { session.media(for: $0)?.name } ?? "empty"
            let overlay = session.placeStyleTopVisual(media, in: span.id)
            return AppActionMutation(
                message: "Top half · \(media.name)",
                changes: [.init(targetID: overlay?.id ?? span.id, property: "topVisual", before: before, after: media.name)]
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

    /// Puts `media` in a span's top area: swaps what its top visual shows, or
    /// adds one for as long as the span is on screen.
    @discardableResult
    func placeStyleTopVisual(_ media: ProjectMedia, in spanID: UUID) -> ProjectOverlay? {
        guard let span = project.layoutSpan(spanID), let extent = project.timelineExtent(of: span) else { return nil }
        if let existing = project.topOverlay(of: span) {
            updateProject { project in
                guard let index = project.overlays?.firstIndex(where: { $0.id == existing.id }) else { return }
                project.overlays![index].mediaID = media.id
                project.overlays![index].sourceStart = 0
                project.fitTopOverlay(of: spanID)
            }
            return project.topOverlay(of: span)
        }
        let length = extent.upperBound - extent.lowerBound
        let overlay = introducedOverlay(media: media, timelineStart: extent.lowerBound,
                                        duration: max(0.1, media.isImage ? length : min(length, media.duration)))
        updateProject { project in
            project.overlays = (project.overlays ?? []) + [overlay]
            if let index = project.layoutSpans?.firstIndex(where: { $0.id == spanID }) {
                project.layoutSpans![index].topOverlayID = overlay.id
            }
            project.fitTopOverlay(of: spanID)
        }
        return project.overlays?.first { $0.id == overlay.id }
    }
}

import Foundation

/// Caption look and selection: everything that changes how cards are drawn
/// without changing what they say.
extension EditorSession {
    var captionStyle: TextStyle { project.captionStyleOrDefault }
    var captionWordsPerCard: Int { project.wordsPerCaptionCard }
    /// Every card the project holds, shown or hidden. The inspector edits cards
    /// that are currently hidden just as happily as visible ones.
    var captions: [ProjectCaption] { project.storedCaptions }
    var hasCaptions: Bool { !project.storedCaptions.isEmpty }
    var captionsVisible: Bool { project.captionsEnabled == true }

    /// True when styling would go nowhere: Apply-to-all is off and nothing is
    /// selected. The controls stay visible but inert, which is clearer than
    /// silently discarding the change.
    var captionStylingHasNoTarget: Bool {
        !captionApplyToAll && selectedCaptionIDs.isEmpty
    }

    /// The style the controls should display: the shared one, or the look of the
    /// single card being restyled.
    var editingCaptionStyle: TextStyle {
        guard !captionApplyToAll,
              selectedCaptionIDs.count == 1,
              let id = selectedCaptionIDs.first,
              let caption = project.caption(withID: id)
        else { return captionStyle }
        return caption.resolvedStyle(base: captionStyle)
    }

    // MARK: - Selection

    func selectCaption(_ id: UUID?) {
        setSelectedCaptionIDs(id.map { [$0] } ?? [])
        captionSelectionAnchor = id
    }

    func toggleCaptionSelection(_ id: UUID) {
        var ids = selectedCaptionIDs
        if ids.contains(id) { ids.remove(id) } else { ids.insert(id) }
        setSelectedCaptionIDs(ids)
        captionSelectionAnchor = id
    }

    /// Every card between the last one picked and this one, which is what
    /// shift-click means in a list. With nothing to reach back to it adds this
    /// card, so the modifier is never a dead key.
    func extendCaptionSelection(through id: UUID) {
        let ordered = captions.map(\.id)
        guard
            let anchor = captionSelectionAnchor,
            anchor != id,
            let from = ordered.firstIndex(of: anchor),
            let to = ordered.firstIndex(of: id)
        else {
            setSelectedCaptionIDs(selectedCaptionIDs.union([id]))
            captionSelectionAnchor = id
            return
        }
        // The anchor stays put, so a run can be stretched and shrunk by
        // shift-clicking further down and back up again.
        setSelectedCaptionIDs(
            selectedCaptionIDs.union(ordered[min(from, to) ... max(from, to)])
        )
    }

    /// One place the caption list routes a click through, so the modifiers mean
    /// the same thing there as everywhere else: shift takes a run, command
    /// picks one out, a plain click starts again.
    func pickCaption(_ id: UUID, ranging: Bool, toggling: Bool) {
        if ranging {
            extendCaptionSelection(through: id)
        } else if toggling {
            toggleCaptionSelection(id)
        } else {
            selectCaption(id)
        }
    }

    func isCaptionSelected(_ id: UUID) -> Bool {
        selectedCaptionIDs.contains(id)
    }

    func toggleCaptionApplyToAll() {
        captionApplyToAll.toggle()
    }

    // MARK: - Style

    /// The one way styling reaches the project. `live` is for controls that fire
    /// continuously — sliders, colour drags — so a whole gesture becomes one
    /// undo step rather than one per pixel.
    func setCaptionStyle(_ patch: TextStylePatch, live: Bool = false) {
        applyCaptionStyle(patch, coalescing: live)
    }

    /// A template writes the whole look at once, leaving size, casing and
    /// position where the creator put them.
    func applyCaptionTemplate(_ template: TextTemplate) {
        let base = editingCaptionStyle.appearance
        setCaptionStyle(.everything(in: template.applied(to: base)))
        setStatus("Caption look: \(template.name)")
    }

    /// A drag on the preview. Moving a card always writes where it was dropped;
    /// with Apply-to-all on that becomes the shared position.
    func moveCaption(_ id: UUID, x: Double, y: Double) {
        applyCaptionStyle(
            TextStylePatch(x: x, y: y),
            coalescing: true,
            layoutTargets: layoutTargets(draggedBy: id)
        )
    }

    func resizeCaption(_ id: UUID, width: Double) {
        applyCaptionStyle(
            TextStylePatch(width: width),
            coalescing: true,
            layoutTargets: layoutTargets(draggedBy: id)
        )
    }

    /// Grouping is a property of the cards, so changing it rebuilds them.
    func setCaptionWordsPerCard(_ value: Int) {
        guard value != project.wordsPerCaptionCard else { return }
        scheduleVisualCommit(
            successStatus: value == CaptionWordsPerCard.auto
                ? "Captions grouped by phrase"
                : "Captions set to \(value) word\(value == 1 ? "" : "s") per card"
        ) { [self] in
            updateProject { $0.setCaptionWordsPerCard(value) }
            setSelectedCaptionIDs([])
            return true
        }
    }

    // MARK: - Routing

    /// Which cards a drag on the preview lands on.
    ///
    /// Dragging a card that is part of the selection places every card in it:
    /// marquee a run on the caption track, move one where you want it, and the
    /// run follows. Dragging a card outside the selection is how that card gets
    /// picked up instead, so it becomes the selection and moves alone.
    private func layoutTargets(draggedBy id: UUID) -> Set<UUID> {
        // Apply-to-all writes the shared position, so the target set is moot
        // and the selection is left exactly as the creator set it.
        if captionApplyToAll { return [id] }
        if selectedCaptionIDs.contains(id) { return selectedCaptionIDs }
        setSelectedCaptionIDs([id])
        return [id]
    }

    private func applyCaptionStyle(
        _ patch: TextStylePatch,
        coalescing: Bool,
        layoutTargets: Set<UUID>? = nil
    ) {
        let targets = layoutTargets ?? selectedCaptionIDs
        guard captionApplyToAll || !targets.isEmpty else { return }
        if coalescing {
            scheduleVisualCommit { [self] in
                updateProject {
                    $0.applyCaptionStyle(patch, applyToAll: captionApplyToAll, selection: targets)
                }
                return true
            }
        } else {
            scheduleVisualCommit { [self] in
                updateProject {
                    $0.applyCaptionStyle(patch, applyToAll: captionApplyToAll, selection: targets)
                }
                return true
            }
        }
    }
}

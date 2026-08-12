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
    }

    func toggleCaptionSelection(_ id: UUID) {
        var ids = selectedCaptionIDs
        if ids.contains(id) { ids.remove(id) } else { ids.insert(id) }
        setSelectedCaptionIDs(ids)
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
        selectCaptionForLayout(id)
        applyCaptionStyle(TextStylePatch(x: x, y: y), coalescing: true, layoutTarget: id)
    }

    func resizeCaption(_ id: UUID, width: Double) {
        selectCaptionForLayout(id)
        applyCaptionStyle(TextStylePatch(width: width), coalescing: true, layoutTarget: id)
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

    /// A drag has to act on the card under the pointer even when it is not the
    /// selected one, so it selects first and styles second.
    private func selectCaptionForLayout(_ id: UUID) {
        guard !captionApplyToAll, !selectedCaptionIDs.contains(id) else { return }
        setSelectedCaptionIDs([id])
    }

    private func applyCaptionStyle(
        _ patch: TextStylePatch,
        coalescing: Bool,
        layoutTarget: UUID? = nil
    ) {
        let targets = layoutTarget.map { Set([$0]) } ?? selectedCaptionIDs
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

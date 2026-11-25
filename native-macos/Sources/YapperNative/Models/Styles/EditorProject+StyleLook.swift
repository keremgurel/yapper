import Foundation

/// The project-wide look a template brings: the backdrop and the caption
/// style. Each is an ordinary project value afterwards.
extension EditorProject {
    /// Sets the backdrop a template asks for. A preset keeps the colours the
    /// template gave it, which `editor.project.setBackdrop` would reset.
    mutating func applyStyleBackdrop(_ backdrop: ProjectBackdropInput) {
        if let token = backdrop.preset, let preset = BackdropPreset(rawValue: token) {
            backdropPreset = preset
            backdropPresetColors = backdrop.presetColors.map { preset.resolvedColors($0) }
        } else if let hex = backdrop.color, let color = StudioColor(hex: hex) {
            backdropPreset = nil
            backdropPresetColors = nil
            self.backdrop = color
        }
        updatedAt = Date()
    }

    /// Sets the caption look for every caption, and for captions generated
    /// later. Locked captions keep their own look, as they do in the
    /// inspector. The height is left alone unless `includingHeight`: a split
    /// moves only the captions spoken inside it, through each caption's own
    /// height. See `EditorProject+LayoutSpanEdits`.
    mutating func applyStyleCaptions(_ plan: StyleCaptionPlan, includingHeight: Bool) throws {
        var patch = try TextStylePatch(plan.style)
        if !includingHeight { patch.y = nil }
        if storedCaptions.isEmpty {
            var style = captionStyleOrDefault
            style.apply(patch)
            captionStyle = style
        } else {
            applyCaptionStyle(patch, applyToAll: true, selection: [])
        }
        setCaptionWordsPerCard(plan.wordsPerCard)
        updatedAt = Date()
    }
}

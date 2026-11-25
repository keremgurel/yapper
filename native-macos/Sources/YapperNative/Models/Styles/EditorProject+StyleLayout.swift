import Foundation

/// The project edits a template's layout is made of. Each is an ordinary
/// project value afterwards; these only set several of them in step.
extension EditorProject {
    /// Gives the camera `region` (or the whole frame for `nil`) and frames
    /// every clip that can be reframed the way the template draws it. Returns
    /// the clips left alone: locked ones, and ones with framing keyframes,
    /// whose movement was set by hand.
    @discardableResult
    mutating func setCameraLayout(
        _ region: CameraRegion?,
        zoom: Double = 1,
        focusY: Double = 0.5
    ) -> [UUID] {
        cameraRegion = region
        var skipped: [UUID] = []
        for index in clips.indices {
            let clip = clips[index]
            guard !clip.locked, !VideoFramingTrack.isKeyed(clip) else {
                skipped.append(clip.id)
                continue
            }
            clips[index].framing = framingForLayout(clip, region: region, zoom: zoom, focusY: focusY)
        }
        updatedAt = Date()
        return skipped
    }

    /// Reframes clips inside the current camera region without moving it.
    @discardableResult
    mutating func reframeCamera(zoom: Double, focusY: Double) -> [UUID] {
        setCameraLayout(cameraRegion, zoom: zoom, focusY: focusY)
    }

    private func framingForLayout(
        _ clip: TimelineClip,
        region: CameraRegion?,
        zoom: Double,
        focusY: Double
    ) -> VideoFraming? {
        guard let region else { return nil }
        guard let source = media(for: clip), source.width > 0, source.height > 0 else {
            return VideoFraming(scale: zoom, x: 0, y: 0)
        }
        return CameraRegionFraming.framing(
            zoom: zoom,
            focusY: focusY,
            sourceAspect: CompositionBuilder.aspect(of: source),
            region: region,
            frameAspect: resolvedAspectRatio
        )
    }

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

    /// Sets the caption style for every caption, and for captions generated
    /// later. Locked captions keep their own look, as they do in the inspector.
    mutating func applyStyleCaptions(_ plan: StyleCaptionPlan) throws {
        let patch = try TextStylePatch(plan.style)
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

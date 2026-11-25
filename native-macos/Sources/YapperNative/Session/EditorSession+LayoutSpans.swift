import Foundation

extension EditorSession {
    /// True while a split laid out by a template is on screen. There the
    /// template frames the camera, so the clip's own framing handles stand
    /// down rather than move a picture they do not control.
    var isLayoutSpanAtPlayhead: Bool {
        project.layoutSpan(atTimeline: currentTime) != nil
    }
}

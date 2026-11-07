import Foundation

/// The one way a running job's work tells the app how far it has got.
struct ExportJobReporter: Sendable {
    let rendered: @MainActor @Sendable (Double) -> Void
    let posting: @MainActor @Sendable (PosterHandoffStage) -> Void

    /// For progress that arrives off the main thread, as AVFoundation's does.
    var renderedFromAnyThread: ExportProgressHandler {
        let rendered = rendered
        return { fraction in
            Task { @MainActor in rendered(fraction) }
        }
    }
}

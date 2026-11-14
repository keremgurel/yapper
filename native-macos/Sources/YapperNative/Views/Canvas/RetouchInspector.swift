import SwiftUI

/// Blemish and teeth adjustments for the largest face in the selected clip.
/// Both default to zero, which skips face detection and retouch rendering.
struct RetouchInspector: View {
    @ObservedObject var session: EditorSession
    /// Watched so the sliders follow the playhead onto the next clip, which is
    /// the clip they act on.
    @ObservedObject var clock: PlaybackClock

    private var retouch: ClipRetouch { session.retouch }

    var body: some View {
        InspectorSection(
            "Retouch",
            id: "video.retouch",
            accessory: AnyView(ApplyToAllButton(what: "retouch", count: session.otherClipCount) {
                session.applyRetouchToAllClips()
            })
        ) {
            InspectorRow("Clear blemishes") {
                InspectorCommitSlider(
                    value: retouch.clearBlemishes * 100,
                    range: 0 ... 100,
                    decimals: 0
                ) { percent in
                    await session.setClearBlemishes(percent / 100)
                }
            }

            InspectorRow("Whiten teeth", detail: summary) {
                InspectorCommitSlider(
                    value: retouch.whitenTeeth * 100,
                    range: 0 ... 100,
                    decimals: 0
                ) { percent in
                    await session.setWhitenTeeth(percent / 100)
                }
            }
        }
    }

    private var summary: String {
        "Works on the largest face in shot"
    }
}

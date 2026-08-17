import SwiftUI

/// One slider for the speaker's face.
///
/// The panel this is modelled on offers eight, and six of them reshape a face
/// rather than tidy it: plumping, slimming, eye enlarging. Those are a
/// different product.
///
/// The seventh, clearing blemishes, was built here and taken out again: see
/// `ClipRetouch` for why. What is left costs one thing to run, which is finding
/// the face on every frame, so it sits behind a zero that means genuinely off.
struct RetouchInspector: View {
    @ObservedObject var session: EditorSession
    /// Watched so the sliders follow the playhead onto the next clip, which is
    /// the clip they act on.
    @ObservedObject var clock: PlaybackClock

    private var retouch: ClipRetouch { session.retouch }

    var body: some View {
        InspectorSection("Retouch", id: "video.retouch") {
            InspectorRow("Clear blemishes") {
                InspectorSlider(
                    value: retouch.clearBlemishes * 100,
                    range: 0 ... 100,
                    decimals: 0
                ) { percent in
                    session.setClearBlemishes(percent / 100)
                }
            }

            InspectorRow("Whiten teeth") {
                InspectorSlider(
                    value: retouch.whitenTeeth * 100,
                    range: 0 ... 100,
                    decimals: 0
                ) { percent in
                    session.setWhitenTeeth(percent / 100)
                }
            }

            InspectorRow("") {
                Text(summary)
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)

                ApplyToAllButton(what: "retouch", count: session.otherClipCount) {
                    session.applyRetouchToAllClips()
                }
            }
        }
    }

    private var summary: String {
        guard !retouch.isNeutral else { return "Off. Nothing is looked for." }
        return "Applied to the largest face in shot"
    }
}

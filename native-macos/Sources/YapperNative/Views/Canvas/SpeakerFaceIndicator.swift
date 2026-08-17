import SwiftUI

/// Four corner brackets around the face the retouch is acting on.
///
/// Corners rather than a full rectangle, and this is the one place in the app
/// where copying the convention is the right call: every editor that retouches
/// a face draws exactly this, so it needs no label and is not mistaken for the
/// framing box, which is a complete dashed rectangle in orange a few points
/// away. A closed box here would also draw a line straight across a cheek,
/// which is the thing being judged.
///
/// The box is measured against `VideoFramingGeometry.mediaBox` rather than the
/// stage, so it follows a punch-in: zoom into the shot and the brackets zoom
/// with the face rather than staying where the face used to be.
struct SpeakerFaceIndicator: View {
    @ObservedObject var session: EditorSession
    /// Watched so the box follows the playhead onto the next clip.
    @ObservedObject var clock: PlaybackClock
    let stageSize: CGSize

    /// The face in the source's own fractions, origin top left. Held here
    /// rather than on the session: it is a thing being drawn, it is worth
    /// nothing once this view is gone, and it must not be part of the project.
    @State private var face: CGRect?

    /// Detection is asked for again whenever this changes. Quantised to a fifth
    /// of a second because that is roughly `FaceDetectionService`'s own cache
    /// step, and asking per frame during playback would decode far more than
    /// anyone is looking at.
    private var moment: Int { Int((session.currentTime * 5).rounded()) }

    var body: some View {
        ZStack(alignment: .topLeading) {
            if let box = onStage {
                ForEach(Corner.allCases, id: \.self) { corner in
                    bracket(corner)
                        .stroke(Color.faceIndicator, style: .init(lineWidth: 2, lineCap: .round))
                        .frame(width: arm, height: arm)
                        .position(corner.point(of: box))
                }
            }
        }
        .frame(width: stageSize.width, height: stageSize.height)
        .allowsHitTesting(false)
        .animation(.easeOut(duration: 0.12), value: onStage)
        .task(id: moment) {
            face = await session.faceBoxAtPlayhead()
        }
    }

    /// How long each arm of a bracket is, as a fraction of the shorter side of
    /// the face, held between two sizes so it is neither a speck on a close-up
    /// nor a full box on a face at the back of a room.
    private var arm: CGFloat {
        guard let box = onStage else { return 18 }
        return min(34, max(12, min(box.width, box.height) * 0.22))
    }

    /// The face on the stage, in points.
    ///
    /// Measured against where the picture actually is, which is what carries
    /// the fit and the framing in one step. See `VideoFramingGeometry.mediaBox`.
    private var onStage: CGRect? {
        guard let face, stageSize.width > 1, stageSize.height > 1 else { return nil }
        let picture = VideoFramingGeometry.mediaBox(
            framing: session.displayedFraming,
            sourceAspect: session.framingSourceAspect,
            stageSize: stageSize
        )
        let box = CGRect(
            x: picture.minX + face.minX * picture.width,
            y: picture.minY + face.minY * picture.height,
            width: face.width * picture.width,
            height: face.height * picture.height
        )
        // A face pushed off the stage by a punch-in has nothing to point at.
        return box.intersects(CGRect(origin: .zero, size: stageSize)) ? box : nil
    }

    /// One corner, drawn in its own little square so it can be positioned by
    /// its own point rather than by arithmetic at every call site.
    private func bracket(_ corner: Corner) -> Path {
        Path { path in
            let inset: CGFloat = 1
            switch corner {
            case .topLeft:
                path.move(to: CGPoint(x: inset, y: arm))
                path.addLine(to: CGPoint(x: inset, y: inset))
                path.addLine(to: CGPoint(x: arm, y: inset))
            case .topRight:
                path.move(to: CGPoint(x: arm - inset, y: arm))
                path.addLine(to: CGPoint(x: arm - inset, y: inset))
                path.addLine(to: CGPoint(x: 0, y: inset))
            case .bottomLeft:
                path.move(to: CGPoint(x: inset, y: 0))
                path.addLine(to: CGPoint(x: inset, y: arm - inset))
                path.addLine(to: CGPoint(x: arm, y: arm - inset))
            case .bottomRight:
                path.move(to: CGPoint(x: arm - inset, y: 0))
                path.addLine(to: CGPoint(x: arm - inset, y: arm - inset))
                path.addLine(to: CGPoint(x: 0, y: arm - inset))
            }
        }
    }

    private enum Corner: CaseIterable {
        case topLeft, topRight, bottomLeft, bottomRight

        /// Where this corner's little square is centred, given the face box.
        func point(of box: CGRect) -> CGPoint {
            switch self {
            case .topLeft: CGPoint(x: box.minX, y: box.minY)
            case .topRight: CGPoint(x: box.maxX, y: box.minY)
            case .bottomLeft: CGPoint(x: box.minX, y: box.maxY)
            case .bottomRight: CGPoint(x: box.maxX, y: box.maxY)
            }
        }
    }
}

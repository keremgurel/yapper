import CoreGraphics
import SwiftUI

/// The picture with the kept rectangle bright and the rest dimmed: drag inside
/// it to pan, drag a corner to resize.
///
/// Knows nothing about overlays or the project. It is handed a picture and a
/// rectangle and reports the rectangle it ends up with, which is what lets the
/// same surface be a thumbnail in the inspector and the whole of a sheet.
struct CropCanvas: View {
    let image: CGImage?
    let mediaAspect: Double
    let crop: OverlayCrop
    /// Every step of a drag, for anything drawing along with it.
    var onChange: (OverlayCrop) -> Void = { _ in }
    /// Once, when the drag lets go. The only one that has to be saved.
    let onCommit: (OverlayCrop) -> Void

    @State private var draft: OverlayCrop?
    @State private var dragOrigin: OverlayCrop?
    @State private var resizeCorner: CanvasResizeCorner?

    private var shown: OverlayCrop { draft ?? crop }

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .topLeading) {
                picture
                Color.black.opacity(0.55)
                    .allowsHitTesting(false)
                keptRectangle(in: proxy.size)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            // The picture stands still while the kept rectangle is dragged
            // around inside it, which makes it the only honest thing to measure
            // those drags against. See CanvasCoordinateSpace.
            .coordinateSpace(name: CanvasCoordinateSpace.crop)
            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
        }
        .aspectRatio(mediaAspect, contentMode: .fit)
    }

    @ViewBuilder
    private var picture: some View {
        if let image {
            Image(decorative: image, scale: 1)
                .resizable()
                .interpolation(.high)
                .scaledToFill()
        } else {
            Color.black
        }
    }

    private func keptRectangle(in size: CGSize) -> some View {
        let crop = shown
        return ZStack(alignment: .topLeading) {
            picture
                .frame(width: max(1, size.width), height: max(1, size.height))
                .offset(
                    x: -size.width * crop.x,
                    y: -size.height * crop.y
                )
                .frame(
                    width: max(1, size.width * crop.width),
                    height: max(1, size.height * crop.height),
                    alignment: .topLeading
                )
                .clipped()
        }
        .frame(
            width: max(1, size.width * crop.width),
            height: max(1, size.height * crop.height)
        )
        .overlay { Rectangle().stroke(Color.cyan, lineWidth: 1.5) }
        .overlay(alignment: .topLeading) { handle(.topLeading, in: size) }
        .overlay(alignment: .topTrailing) { handle(.topTrailing, in: size) }
        .overlay(alignment: .bottomLeading) { handle(.bottomLeading, in: size) }
        .overlay(alignment: .bottomTrailing) { handle(.bottomTrailing, in: size) }
        .offset(x: size.width * crop.x, y: size.height * crop.y)
        .contentShape(Rectangle())
        .cursor(.openHand)
        .gesture(
            DragGesture(minimumDistance: 0, coordinateSpace: .named(CanvasCoordinateSpace.crop))
                .onChanged { value in
                    if dragOrigin == nil {
                        dragOrigin = crop
                        resizeCorner = CropHandleMetrics.corner(
                            at: CGPoint(
                                x: value.startLocation.x - size.width * crop.x,
                                y: value.startLocation.y - size.height * crop.y
                            ),
                            cropSize: CGSize(
                                width: size.width * crop.width,
                                height: size.height * crop.height
                            )
                        )
                    }
                    guard let dragOrigin, size.width > 0, size.height > 0 else { return }

                    if let resizeCorner {
                        update(
                            dragOrigin.resized(
                                corner: resizeCorner,
                                dx: Double(value.translation.width) / Double(size.width),
                                dy: Double(value.translation.height) / Double(size.height)
                            )
                        )
                    } else {
                        update(dragOrigin.moved(
                            dx: Double(value.translation.width) / Double(size.width),
                            dy: Double(value.translation.height) / Double(size.height)
                        ))
                    }
                }
                .onEnded { _ in commit() }
        )
    }

    private func handle(_ corner: CanvasResizeCorner, in size: CGSize) -> some View {
        // Keep both the visible grip and its larger hit target wholly inside the
        // crop. A grip centred on the outline gets clipped at picture edges and
        // misleadingly exposes pixels that cannot reliably receive the drag.
        ZStack(alignment: alignment(for: corner)) {
            Color.clear

            Circle()
                .fill(Color.white)
                .overlay { Circle().stroke(Color.cyan, lineWidth: 2) }
                .shadow(color: .black.opacity(0.3), radius: 2, y: 1)
                .frame(
                    width: CropHandleMetrics.gripSide,
                    height: CropHandleMetrics.gripSide
                )
                .offset(
                    x: corner.xSign < 0 ? CropHandleMetrics.gripInset : -CropHandleMetrics.gripInset,
                    y: corner.ySign < 0 ? CropHandleMetrics.gripInset : -CropHandleMetrics.gripInset
                )
                .allowsHitTesting(false)
        }
            .frame(
                width: CropHandleMetrics.targetLength(for: size.width * shown.width),
                height: CropHandleMetrics.targetLength(for: size.height * shown.height)
            )
            .contentShape(Rectangle())
            .cursor(.crosshair)
            .accessibilityLabel("Crop from \(corner.accessibilityName)")
            .help("Drag to crop from \(corner.accessibilityName)")
    }

    private func alignment(for corner: CanvasResizeCorner) -> Alignment {
        switch corner {
        case .topLeading: .topLeading
        case .topTrailing: .topTrailing
        case .bottomLeading: .bottomLeading
        case .bottomTrailing: .bottomTrailing
        }
    }

    private func update(_ crop: OverlayCrop) {
        draft = crop
        onChange(crop)
    }

    private func commit() {
        if let draft { onCommit(draft) }
        draft = nil
        dragOrigin = nil
        resizeCorner = nil
    }
}

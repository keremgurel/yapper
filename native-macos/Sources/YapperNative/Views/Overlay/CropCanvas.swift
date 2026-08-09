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
            DragGesture(minimumDistance: 1, coordinateSpace: .named(CanvasCoordinateSpace.crop))
                .onChanged { value in
                    if dragOrigin == nil { dragOrigin = crop }
                    guard let dragOrigin, size.width > 0, size.height > 0 else { return }
                    update(
                        dragOrigin.moved(
                            dx: Double(value.translation.width) / Double(size.width),
                            dy: Double(value.translation.height) / Double(size.height)
                        )
                    )
                }
                .onEnded { _ in commit() }
        )
    }

    private func handle(_ corner: CanvasResizeCorner, in size: CGSize) -> some View {
        Circle()
            .fill(Color.white)
            .overlay { Circle().stroke(Color.cyan, lineWidth: 1.5) }
            .frame(width: 12, height: 12)
            .offset(x: corner.xOffset * 0.7, y: corner.yOffset * 0.7)
            .contentShape(Rectangle().inset(by: -10))
            .cursor(.crosshair)
            .highPriorityGesture(
                DragGesture(minimumDistance: 0, coordinateSpace: .named(CanvasCoordinateSpace.crop))
                    .onChanged { value in
                        if dragOrigin == nil { dragOrigin = shown }
                        guard let dragOrigin, size.width > 0, size.height > 0 else { return }
                        update(
                            dragOrigin.resized(
                                corner: corner,
                                dx: Double(value.translation.width) / Double(size.width),
                                dy: Double(value.translation.height) / Double(size.height)
                            )
                        )
                    }
                    .onEnded { _ in commit() }
            )
            .accessibilityLabel("Crop from \(corner.accessibilityName)")
    }

    private func update(_ crop: OverlayCrop) {
        draft = crop
        onChange(crop)
    }

    private func commit() {
        if let draft { onCommit(draft) }
        draft = nil
        dragOrigin = nil
    }
}

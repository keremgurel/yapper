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
    /// Width/height in source fractions when an aspect preset is active.
    var aspectRatio: Double? = nil
    /// Every step of a drag, for anything drawing along with it.
    var onChange: (OverlayCrop) -> Void = { _ in }
    /// Once, when the drag lets go. The only one that has to be saved.
    let onCommit: (OverlayCrop) -> Void

    @State private var draft: OverlayCrop?
    @State private var dragOrigin: OverlayCrop?
    @State private var dragIntent: CropDragIntent?

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
            .overlay {
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .stroke(Color.white.opacity(0.14), lineWidth: 1)
                    .allowsHitTesting(false)
            }
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
        .overlay { selectionGrid }
        .overlay {
            Rectangle()
                .stroke(Color.yapperOrange, lineWidth: 2)
                .shadow(color: .black.opacity(0.55), radius: 2)
                .allowsHitTesting(false)
        }
        .overlay(alignment: .topLeading) { cornerHandle(.topLeading) }
        .overlay(alignment: .topTrailing) { cornerHandle(.topTrailing) }
        .overlay(alignment: .bottomLeading) { cornerHandle(.bottomLeading) }
        .overlay(alignment: .bottomTrailing) { cornerHandle(.bottomTrailing) }
        .overlay(alignment: .top) { edgeHandle(.top) }
        .overlay(alignment: .bottom) { edgeHandle(.bottom) }
        .overlay(alignment: .leading) { edgeHandle(.leading) }
        .overlay(alignment: .trailing) { edgeHandle(.trailing) }
        .overlay { moveAffordance(in: size, crop: crop) }
        .offset(x: size.width * crop.x, y: size.height * crop.y)
        .contentShape(Rectangle())
        .cursor(.openHand)
        .gesture(
            DragGesture(minimumDistance: 0, coordinateSpace: .named(CanvasCoordinateSpace.crop))
                .onChanged { value in
                    if dragOrigin == nil {
                        dragOrigin = crop
                        dragIntent = CropHandleMetrics.intent(
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
                    guard let dragOrigin, let dragIntent,
                          size.width > 0, size.height > 0
                    else { return }

                    switch dragIntent {
                    case .corner(let corner):
                        update(
                            CropGeometry.resized(
                                dragOrigin,
                                corner: corner,
                                dx: Double(value.translation.width) / Double(size.width),
                                dy: Double(value.translation.height) / Double(size.height),
                                ratio: aspectRatio,
                                minimumSide: OverlayCrop.minimumSide
                            )
                        )
                    case .edge(let edge):
                        let delta = edge.isHorizontal
                            ? Double(value.translation.width) / Double(size.width)
                            : Double(value.translation.height) / Double(size.height)
                        update(
                            CropGeometry.resized(
                                dragOrigin,
                                edge: edge,
                                delta: delta,
                                ratio: aspectRatio,
                                minimumSide: OverlayCrop.minimumSide
                            )
                        )
                    case .move:
                        update(
                            CropGeometry.moved(
                                dragOrigin,
                                dx: Double(value.translation.width) / Double(size.width),
                                dy: Double(value.translation.height) / Double(size.height),
                                minimumSide: OverlayCrop.minimumSide
                            )
                        )
                    }
                }
                .onEnded { _ in commit() }
        )
    }

    private var selectionGrid: some View {
        GeometryReader { proxy in
            Path { path in
                for fraction in [1.0 / 3.0, 2.0 / 3.0] {
                    path.move(to: CGPoint(x: proxy.size.width * fraction, y: 0))
                    path.addLine(to: CGPoint(x: proxy.size.width * fraction, y: proxy.size.height))
                    path.move(to: CGPoint(x: 0, y: proxy.size.height * fraction))
                    path.addLine(to: CGPoint(x: proxy.size.width, y: proxy.size.height * fraction))
                }
            }
            .stroke(Color.white.opacity(0.4), lineWidth: 0.8)
        }
        .allowsHitTesting(false)
    }

    private func cornerHandle(_ corner: CanvasResizeCorner) -> some View {
        CropCornerMark(corner: corner)
            .stroke(Color.black.opacity(0.65), style: StrokeStyle(lineWidth: 6, lineCap: .round, lineJoin: .round))
            .overlay {
                CropCornerMark(corner: corner)
                    .stroke(Color.yapperOrange, style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
            }
            .frame(width: CropHandleMetrics.cornerMarkSide, height: CropHandleMetrics.cornerMarkSide)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }

    private func edgeHandle(_ edge: CropEdge) -> some View {
        Capsule(style: .continuous)
            .fill(Color.white)
            .overlay {
                Capsule(style: .continuous)
                    .stroke(Color.yapperOrange, lineWidth: 2)
            }
            .shadow(color: .black.opacity(0.45), radius: 2, y: 1)
            .frame(
                width: edge.isHorizontal
                    ? CropHandleMetrics.edgeGripThickness
                    : CropHandleMetrics.edgeGripLength,
                height: edge.isHorizontal
                    ? CropHandleMetrics.edgeGripLength
                    : CropHandleMetrics.edgeGripThickness
            )
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }

    @ViewBuilder
    private func moveAffordance(in size: CGSize, crop: OverlayCrop) -> some View {
        if size.width * crop.width >= 92, size.height * crop.height >= 92 {
            Image(systemName: "arrow.up.and.down.and.arrow.left.and.right")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white)
                .padding(9)
                .background(Color.black.opacity(0.58), in: Circle())
                .overlay { Circle().stroke(Color.white.opacity(0.22), lineWidth: 1) }
                .shadow(color: .black.opacity(0.35), radius: 4, y: 2)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
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
        dragIntent = nil
    }
}

private struct CropCornerMark: Shape {
    let corner: CanvasResizeCorner

    func path(in rect: CGRect) -> Path {
        let horizontalEnd = corner.xSign < 0 ? rect.maxX : rect.minX
        let verticalEnd = corner.ySign < 0 ? rect.maxY : rect.minY
        let x = corner.xSign < 0 ? rect.minX : rect.maxX
        let y = corner.ySign < 0 ? rect.minY : rect.maxY
        var path = Path()
        path.move(to: CGPoint(x: horizontalEnd, y: y))
        path.addLine(to: CGPoint(x: x, y: y))
        path.addLine(to: CGPoint(x: x, y: verticalEnd))
        return path
    }
}

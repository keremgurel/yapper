import SwiftUI

/// Direct manipulation stays local; only a completed gesture writes settings.
/// Scrolling text has its own observation boundary.
struct TeleprompterOverlayView: View {
    let text: String
    @Binding var settings: TeleprompterSettings
    let scroller: TeleprompterScroller
    @Environment(\.colorScheme) private var colorScheme
    @GestureState private var drag: PromptDrag?
    @State private var hovered = false
    @FocusState private var focused: Bool

    var body: some View {
        GeometryReader { geometry in
            let size = geometry.size
            let saved = settings.promptLayout.frame(in: size)
            let frame = drag.map { $0.frame(in: size) } ?? saved
            let active = hovered || focused || drag != nil
            promptBox(frame: frame, saved: saved, in: size, active: active)
            // Rebuild the mixed AppKit/SwiftUI cursor surface on appearance changes.
            // Its layout and reading progress are owned outside this identity.
            .id(colorScheme)
            .position(x: frame.midX, y: frame.midY)
            .transaction { $0.animation = nil }
        }
        .coordinateSpace(name: "teleprompterPreview")
        .onChange(of: settings.pointsPerSecond, initial: true) { _, value in
            scroller.pointsPerSecond = value
        }
    }

    private func promptBox(frame: CGRect, saved: CGRect, in size: CGSize, active: Bool) -> some View {
        ZStack(alignment: .topLeading) {
            TeleprompterTextViewport(text: text, settings: settings, scroller: scroller, size: frame.size)
                .contentShape(Rectangle())
                .gesture(gesture(handle: nil, start: saved, in: size))
                .cursor(drag == nil ? .openHand : .closedHand)
                .overlay(alignment: .top) {
                    HStack(spacing: 5) {
                        Image(systemName: "arrow.up.and.down.and.arrow.left.and.right")
                        Text("Drag to move")
                    }
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(.white.opacity(0.85))
                    .padding(.top, 8).opacity(active ? 1 : 0).allowsHitTesting(false)
                }
                .overlay {
                    RoundedRectangle(cornerRadius: 10)
                        .strokeBorder(.white.opacity(active ? 0.85 : 0.18), lineWidth: focused ? 2 : 1)
                        .allowsHitTesting(false)
                }
            ForEach(TeleprompterLayout.Handle.allCases, id: \.self) { handle in
                resizeHandle(handle, size: frame.size, active: active)
                    .gesture(gesture(handle: handle, start: saved, in: size))
            }
        }
        .frame(width: frame.width, height: frame.height)
        .onHover { hovered = $0 }
        .focusable().focused($focused).focusEffectDisabled()
        .onKeyPress(keys: [.leftArrow, .rightArrow, .upArrow, .downArrow]) { press in
            let dx: Double = press.key == .leftArrow ? -4 : press.key == .rightArrow ? 4 : 0
            let dy: Double = press.key == .upArrow ? -4 : press.key == .downArrow ? 4 : 0
            adjust(by: CGSize(width: dx, height: dy), resize: press.modifiers.contains(.shift), in: size)
            return .handled
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Teleprompter position and size")
        .accessibilityValue(layoutDescription(frame))
        .accessibilityHint("Drag to move. Drag edges to resize. Arrow keys move; Shift and arrow keys resize. Right-click for layout controls.")
        .accessibilityAction(named: "Move left") { adjust(by: CGSize(width: -12, height: 0), in: size) }
        .accessibilityAction(named: "Move right") { adjust(by: CGSize(width: 12, height: 0), in: size) }
        .accessibilityAction(named: "Move up") { adjust(by: CGSize(width: 0, height: -12), in: size) }
        .accessibilityAction(named: "Move down") { adjust(by: CGSize(width: 0, height: 12), in: size) }
        .accessibilityAction(named: "Wider") { adjust(by: CGSize(width: 12, height: 0), resize: true, in: size) }
        .accessibilityAction(named: "Narrower") { adjust(by: CGSize(width: -12, height: 0), resize: true, in: size) }
        .accessibilityAction(named: "Taller") { adjust(by: CGSize(width: 0, height: 12), resize: true, in: size) }
        .accessibilityAction(named: "Shorter") { adjust(by: CGSize(width: 0, height: -12), resize: true, in: size) }
        .contextMenu { layoutMenu(in: size) }

    }

    private func layoutDescription(_ frame: CGRect) -> String {
        let dimensions = "\(Int(frame.width)) by \(Int(frame.height)) points"
        return "\(dimensions), \(Int(frame.minX)) from left, \(Int(frame.minY)) from top"
    }

    private func gesture(handle: TeleprompterLayout.Handle?, start: CGRect, in size: CGSize) -> some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .named("teleprompterPreview"))
            .updating($drag) { value, state, transaction in
                transaction.animation = nil
                state = PromptDrag(origin: state?.origin ?? start, handle: handle, translation: value.translation)
            }
            .onChanged { _ in focused = true }
            .onEnded { value in
                guard value.translation != .zero else { return }
                let final = PromptDrag(origin: drag?.origin ?? start, handle: handle, translation: value.translation).frame(in: size)
                settings.promptLayout = TeleprompterLayout(frame: final, in: size)
            }
    }

    private func resizeHandle(_ handle: TeleprompterLayout.Handle, size: CGSize, active: Bool) -> some View {
        let corner = (handle.movesLeft || handle.movesRight) && (handle.movesTop || handle.movesBottom)
        let horizontal = handle == .top || handle == .bottom
        return Capsule().fill(.white)
            .frame(width: corner ? 8 : horizontal ? 24 : 4, height: corner ? 8 : horizontal ? 4 : 24)
            .opacity(active ? 0.95 : 0)
            .frame(width: corner ? 22 : horizontal ? max(22, size.width - 44) : 16,
                   height: corner ? 22 : horizontal ? 16 : max(22, size.height - 44))
            .contentShape(Rectangle())
            .cursor(corner ? .crosshair : horizontal ? .resizeUpDown : .resizeLeftRight)
            .position(x: handle.movesLeft ? 8 : handle.movesRight ? size.width - 8 : size.width / 2,
                      y: handle.movesTop ? 8 : handle.movesBottom ? size.height - 8 : size.height / 2)
            .accessibilityHidden(true)
    }

    private func adjust(by delta: CGSize, resize: Bool = false, in size: CGSize) {
        let frame = TeleprompterLayout.adjusting(settings.promptLayout.frame(in: size),
                                               handle: resize ? .bottomRight : nil, by: delta, in: size)
        settings.promptLayout = TeleprompterLayout(frame: frame, in: size)
    }

    @ViewBuilder private func layoutMenu(in size: CGSize) -> some View {
        Button("Move left") { adjust(by: CGSize(width: -12, height: 0), in: size) }
        Button("Move right") { adjust(by: CGSize(width: 12, height: 0), in: size) }
        Button("Move up") { adjust(by: CGSize(width: 0, height: -12), in: size) }
        Button("Move down") { adjust(by: CGSize(width: 0, height: 12), in: size) }
        Divider()
        Button("Wider") { adjust(by: CGSize(width: 12, height: 0), resize: true, in: size) }
        Button("Narrower") { adjust(by: CGSize(width: -12, height: 0), resize: true, in: size) }
        Button("Taller") { adjust(by: CGSize(width: 0, height: 12), resize: true, in: size) }
        Button("Shorter") { adjust(by: CGSize(width: 0, height: -12), resize: true, in: size) }
        Divider()
        Button("Reset position and size") { settings.layout = nil; settings.heightFraction = 0.44 }
    }
}

private struct PromptDrag {
    let origin: CGRect
    let handle: TeleprompterLayout.Handle?
    let translation: CGSize
    func frame(in size: CGSize) -> CGRect {
        TeleprompterLayout.adjusting(origin, handle: handle, by: translation, in: size)
    }
}

private struct TeleprompterTextViewport: View {
    let text: String
    let settings: TeleprompterSettings
    @ObservedObject var scroller: TeleprompterScroller
    let size: CGSize
    @State private var textHeight: CGFloat = 0

    var body: some View {
        VStack(spacing: 0) {
            Color.clear.frame(height: 24)
            Text(text)
                .font(.system(size: TeleprompterSettings.baseFontSize * settings.fontScale, weight: .semibold))
                .foregroundStyle(.white).multilineTextAlignment(.center).lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 16).padding(.top, 6).padding(.bottom, 16)
                .frame(width: size.width)
                .background(GeometryReader { text in
                    Color.clear.preference(key: PromptHeightKey.self, value: text.size.height)
                })
                .offset(y: -scroller.offset)
                .frame(height: max(0, size.height - 24), alignment: .top)
                .clipped()
        }
        .frame(width: size.width, height: size.height, alignment: .top)
        .background(Color.black.opacity(settings.shade))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .onPreferenceChange(PromptHeightKey.self) { textHeight = $0 }
        .onChange(of: max(0, textHeight - max(0, size.height - 24)), initial: true) { _, value in
            guard textHeight > 0 else { return }
            scroller.maxOffset = value
        }
    }
}

private struct PromptHeightKey: PreferenceKey {
    static let defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = max(value, nextValue()) }
}

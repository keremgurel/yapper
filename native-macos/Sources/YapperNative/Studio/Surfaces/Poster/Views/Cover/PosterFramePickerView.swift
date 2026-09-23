import SwiftUI

/// A full-width strip for finding the moment, then stepping to its exact
/// frame. Drag across the strip, or use the arrow keys: a frame at a time,
/// or a second at a time with Shift.
struct PosterFramePickerView: View {
    @ObservedObject var picker: PosterFramePicker
    @State private var enteredFrame = ""
    @FocusState private var stripFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                Text(Self.clock(picker.time)).font(.system(size: 17, weight: .medium).monospacedDigit())
                Text("/ \(Self.clock(picker.duration))").font(.system(size: 11).monospacedDigit()).foregroundStyle(.secondary)
                Spacer()
                status
            }
            .padding([.horizontal, .top], 16).padding(.bottom, 12)

            strip.padding(.horizontal, 16)

            HStack(spacing: 6) {
                stepButton("1s", systemImage: "chevron.left.2", enabled: picker.index > 0) { picker.jump(-1) }
                stepButton("1f", systemImage: "chevron.left", enabled: picker.index > 0) { picker.step(-1) }
                stepButton("1f", systemImage: "chevron.right", enabled: picker.index < picker.frameCount - 1) { picker.step(1) }
                stepButton("1s", systemImage: "chevron.right.2", enabled: picker.index < picker.frameCount - 1) { picker.jump(1) }
                Spacer()
                Text("Frame").font(.system(size: 12)).foregroundStyle(.secondary)
                TextField(picker.ready ? String(picker.index + 1) : "", text: $enteredFrame)
                    .textFieldStyle(.native)
                    .frame(width: 72)
                    .multilineTextAlignment(.center)
                    .disabled(!picker.ready)
                    .onSubmit {
                        if let number = Int(enteredFrame) { picker.select(number - 1) }
                        enteredFrame = ""
                    }
                Text("/ \(picker.frameCount)").font(.system(size: 11).monospacedDigit()).foregroundStyle(.secondary)
            }
            .padding(16)

            Rectangle().fill(Color.studioLine).frame(height: 1)
            HStack {
                Text("Drag to find the moment. Step to get it exact.")
                Spacer()
                Text("Arrow keys step a frame, Shift steps a second")
            }
            .font(.system(size: 11)).foregroundStyle(.secondary)
            .padding(.horizontal, 16).padding(.vertical, 10)

            if let error = picker.error {
                Rectangle().fill(Color.studioLine).frame(height: 1)
                HStack {
                    Text(error).font(.system(size: 12)).foregroundStyle(NativeChip.Tone.yellow.color)
                    Spacer()
                    Button("Retry") { picker.retry() }.buttonStyle(EditorGhostButtonStyle(size: .small))
                }
                .padding(.horizontal, 16).padding(.vertical, 8)
            }
        }
        .background(NativeCardBackground(radius: 12))
        .onChange(of: picker.index) { _, _ in enteredFrame = "" }
    }

    @ViewBuilder
    private var status: some View {
        HStack(spacing: 6) {
            if picker.error != nil {
                Text("Frame unavailable")
            } else if picker.busy || picker.loading {
                ProgressView().controlSize(.mini)
                Text(picker.ready ? "Updating thumbnail" : "Loading frames")
            } else if picker.ready {
                Image(systemName: "checkmark").foregroundStyle(NativeChip.Tone.green.color)
                Text("Frame selected")
            }
        }
        .font(.system(size: 11)).foregroundStyle(.secondary)
    }

    private var strip: some View {
        GeometryReader { proxy in
            let progress = picker.duration > 0 ? min(1, max(0, picker.time / picker.duration)) : 0
            ZStack(alignment: .leading) {
                HStack(spacing: 0) {
                    ForEach(Array(picker.tiles.enumerated()), id: \.offset) { _, tile in
                        ZStack {
                            Color.studioInputBackground
                            if let tile { Image(decorative: tile, scale: 1).resizable().scaledToFill() }
                        }
                        .frame(width: proxy.size.width / CGFloat(max(1, picker.tiles.count)), height: proxy.size.height)
                        .clipped()
                    }
                }
                .frame(width: proxy.size.width, height: proxy.size.height, alignment: .leading)
                .background(Color.studioInputBackground)
                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                if picker.ready {
                    Rectangle().fill(Color.yapperOrange).frame(width: 2, height: proxy.size.height + 8)
                        .offset(x: proxy.size.width * progress - 1)
                }
            }
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance: 0).onChanged { value in
                guard proxy.size.width > 0 else { return }
                stripFocused = true
                picker.seek(to: picker.duration * min(1, max(0, value.location.x / proxy.size.width)))
            })
        }
        .frame(height: 64)
        .focusable()
        .focused($stripFocused)
        .focusEffectDisabled()
        .onKeyPress(keys: [.leftArrow, .rightArrow]) { press in
            let direction = press.key == .leftArrow ? -1 : 1
            if press.modifiers.contains(.shift) { picker.jump(Double(direction)) } else { picker.step(direction) }
            return .handled
        }
        .cursor(.resizeLeftRight)
    }

    private func stepButton(_ label: String, systemImage: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(label, systemImage: systemImage).font(.system(size: 12).monospacedDigit())
        }
        .buttonStyle(EditorGhostButtonStyle(size: .small))
        .disabled(!picker.ready || !enabled)
    }

    static func clock(_ seconds: Double) -> String {
        guard seconds.isFinite, seconds > 0 else { return "0:00.00" }
        let minutes = Int(seconds) / 60
        let rest = seconds - Double(minutes * 60)
        return String(format: "%d:%05.2f", minutes, rest)
    }
}

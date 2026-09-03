import SwiftUI

/// Cropping, given the window.
///
/// The inspector's crop well is 260 points wide, which is fine for checking a
/// crop and miserable for making one: the corners are a few points apart and
/// the picture is too small to see what you are cutting off. This is the same
/// editor with room to aim in, opened from wherever the file is: the bin, the
/// timeline, or the inspector.
struct CropSheet: View {
    @ObservedObject var session: EditorSession
    let request: CropRequest

    /// Held here and written on every gesture, so the preview behind the sheet
    /// follows along and the crop can be abandoned by pressing Escape without
    /// having touched anything else.
    @State private var crop: OverlayCrop
    @State private var aspect: CropAspect = .free

    init(session: EditorSession, request: CropRequest) {
        self.session = session
        self.request = request
        _crop = State(initialValue: request.crop)
    }

    private var mediaAspect: Double {
        session.project.media
            .first { $0.id == request.mediaID }
            .map(CompositionBuilder.aspect(of:)) ?? 1
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header

            Divider()

            controls

            ZStack {
                Color.black.opacity(0.88)

                CropCanvas(
                    image: session.thumbnailsByMedia[request.mediaID]?.first,
                    mediaAspect: mediaAspect,
                    crop: crop,
                    aspectRatio: fractionRatio,
                    onChange: { crop = $0 },
                    onCommit: { committed in
                        crop = committed
                        session.applyCrop(committed, to: request)
                    }
                )
                .padding(28)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .overlay {
                Rectangle()
                    .stroke(Color.white.opacity(0.08), lineWidth: 1)
                    .allowsHitTesting(false)
            }

            Divider()

            footer
        }
        .frame(minWidth: 780, idealWidth: 920, minHeight: 620, idealHeight: 760)
        .background(Color.panelBackground)
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 14) {
            Image(systemName: "crop")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Color.yapperOrange)
                .frame(width: 34, height: 34)
                .background(Color.yapperOrange.opacity(0.12), in: RoundedRectangle(cornerRadius: 9))

            VStack(alignment: .leading, spacing: 3) {
                Text(request.name)
                    .font(.system(size: 17, weight: .bold))
                Text(request.subtitle)
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 12)

            Text(readout)
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .padding(.horizontal, 11)
                .padding(.vertical, 7)
                .background(Color.primary.opacity(0.07), in: Capsule())
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 15)
    }

    private var controls: some View {
        HStack(spacing: 14) {
            Text("Aspect")
                .font(.studioCaption)
                .foregroundStyle(.secondary)

            Picker("Aspect", selection: $aspect) {
                ForEach(CropAspect.allCases) { option in
                    Text(option.title).tag(option)
                }
            }
            .labelsHidden()
            .pickerStyle(.segmented)
            .frame(maxWidth: 430)
            .onChange(of: aspect) { _, newValue in
                apply(newValue)
            }

            Spacer(minLength: 12)

            Label("Drag inside to reposition", systemImage: "arrow.up.and.down.and.arrow.left.and.right")
                .font(.studioCaption)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 11)
    }

    private var footer: some View {
        HStack(spacing: 9) {
            Button("Reset") {
                crop = .full
                aspect = .free
                session.applyCrop(.full, to: request)
            }
            .buttonStyle(EditorSecondaryButtonStyle())
            .disabled(crop.isFull)

            Label("Edges and corners resize", systemImage: "rectangle.dashed")
                .font(.studioCaption)
                .foregroundStyle(.secondary)

            Spacer(minLength: 0)

            Button("Done") { session.endCropping() }
                .buttonStyle(EditorPrimaryButtonStyle())
                .keyboardShortcut(.defaultAction)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
    }

    private var readout: String {
        "W \(Int((crop.width * 100).rounded()))%  ·  H \(Int((crop.height * 100).rounded()))%"
    }

    private var fractionRatio: Double? {
        guard let realRatio = aspect.ratio(sourceAspect: mediaAspect) else { return nil }
        return CropGeometry.fractionRatio(forRealRatio: realRatio, sourceAspect: mediaAspect)
    }

    private func apply(_ selectedAspect: CropAspect) {
        let ratio = selectedAspect.ratio(sourceAspect: mediaAspect).flatMap {
            CropGeometry.fractionRatio(forRealRatio: $0, sourceAspect: mediaAspect)
        }
        let fitted = CropGeometry.maximized(
            crop,
            to: ratio,
            minimumSide: OverlayCrop.minimumSide
        )
        guard fitted != crop else { return }
        crop = fitted
        session.applyCrop(fitted, to: request)
    }
}

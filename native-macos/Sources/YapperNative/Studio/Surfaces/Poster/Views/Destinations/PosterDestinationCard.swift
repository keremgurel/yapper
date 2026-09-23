import SwiftUI

/// One destination, as its own object: its state, its fields with live
/// counts, and why it cannot go yet. A cross-post is several posts, and
/// this is what lets someone see that YouTube needs a title while TikTok
/// is ready, before pressing anything.
struct PosterDestinationCard: View {
    let readiness: PosterReadiness
    let caption: PosterCaption
    let sending: Bool
    let onChange: (PosterCaption) -> Void
    let onRemove: () -> Void

    private var done: Bool { [.posted, .scheduled].contains(readiness.state) }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                Image(systemName: readiness.platform.symbol).font(.system(size: 13)).foregroundStyle(.secondary)
                Text(readiness.spec.label).font(.system(size: 13, weight: .semibold))
                Spacer()
                NativeChip(text: sending ? "Sending" : readiness.state.label, tone: sending ? .neutral : readiness.state.tone)
                if !done {
                    Button(action: onRemove) { Image(systemName: "xmark").font(.system(size: 11, weight: .semibold)) }
                        .buttonStyle(EditorGhostButtonStyle(size: .mini))
                        .help("Remove \(readiness.platform.label)")
                }
            }
            .padding(.horizontal, 16).padding(.vertical, 12)
            Rectangle().fill(Color.studioLine).frame(height: 1)
            if done {
                notes.padding(16)
            } else {
                fields.padding(16)
            }
        }
        .background(NativeCardBackground(radius: 12))
    }

    private var fields: some View {
        VStack(alignment: .leading, spacing: 12) {
            if readiness.spec.hasTitle {
                field("Title", used: readiness.titleUsed, max: readiness.spec.titleMax) {
                    TextField("The whole click decision, in plain words", text: binding(\.title))
                        .textFieldStyle(.native)
                }
            }
            field("Caption", used: readiness.bodyUsed, max: readiness.spec.bodyMax) {
                NativeTextArea(text: binding(\.body), placeholder: "What this says here", font: .system(size: 13), minHeight: 84)
            }
            Text(foldNote).font(.system(size: 11)).foregroundStyle(.secondary)
            PosterHashtagEditor(tags: caption.hashtags, min: readiness.spec.hashtagMin, max: readiness.spec.hashtagMax) { tags in
                var next = caption
                next.hashtags = tags
                onChange(next)
            }
            ForEach(readiness.blockers, id: \.self) { blocker in
                Label(blocker, systemImage: "exclamationmark.triangle")
                    .font(.system(size: 12)).foregroundStyle(NativeChip.Tone.yellow.color)
            }
            notes
        }
    }

    private var notes: some View {
        VStack(alignment: .leading, spacing: 4) {
            ForEach(readiness.notes, id: \.self) { note in
                Label(note, systemImage: "info.circle")
                    .font(.system(size: 12)).foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var foldNote: String {
        let visible = readiness.spec.visibleChars
        let hidden = readiness.bodyUsed - visible
        return "First \(visible) characters show before \"more\"" + (hidden > 0 ? ", \(hidden) hidden" : "")
    }

    private func field<Content: View>(_ label: String, used: Int, max: Int, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(label).font(.nativeLabel).foregroundStyle(.secondary)
                Spacer()
                Text("\(used)/\(max)").font(.system(size: 11).monospacedDigit())
                    .foregroundStyle(used > max ? NativeChip.Tone.yellow.color : Color.secondary)
            }
            content()
        }
    }

    private func binding(_ path: WritableKeyPath<PosterCaption, String>) -> Binding<String> {
        Binding(get: { caption[keyPath: path] }, set: { value in
            var next = caption
            next[keyPath: path] = value
            onChange(next)
        })
    }
}

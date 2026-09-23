import SwiftUI

/// Picking published videos to teach the Brain a voice. The cost is on every
/// tile and totalled in the footer before anything is charged.
struct BrainVideoPicker: View {
    let platforms: [String]
    let sampled: [BrainVoiceSample]
    @ObservedObject var picker: BrainVideoPickerStore
    let deriving: Bool
    let onBack: () -> Void
    let onClose: () -> Void
    let onFinished: (Int) async -> Void

    @State private var platform: String = ""
    private let columns = [GridItem(.flexible(), spacing: 8, alignment: .top), GridItem(.flexible(), spacing: 8, alignment: .top)]

    var body: some View {
        BrainSheetFrame(
            title: "Add videos to your voice",
            description: "Pick videos you actually talk in. Each is transcribed once and kept word for word. One credit covers three minutes; YouTube captions are free.",
            closeDisabled: picker.busy,
            onClose: onClose
        ) {
            HStack(spacing: 8) {
                Button { onBack() } label: { Label("Your videos", systemImage: "chevron.left") }
                    .buttonStyle(EditorGhostButtonStyle(size: .small))
                    .disabled(picker.busy)
                Spacer()
                if platforms.count > 1 {
                    Picker("Channel", selection: $platform) {
                        ForEach(platforms, id: \.self) { Text(BrainVoiceFormat.platformLabel($0)).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .labelsHidden()
                    .fixedSize()
                    .disabled(picker.busy)
                }
            }
            grid
        } footer: {
            BrainSheetFooter { footer }
        }
        .onAppear { if platform.isEmpty { platform = platforms.first ?? "" } }
        .task(id: platform) { if !platform.isEmpty { await picker.show(platform) } }
    }

    @ViewBuilder
    private var grid: some View {
        if let videos = picker.videos {
            if let error = picker.listError {
                Text(error).font(.system(size: 13)).foregroundStyle(.secondary)
            } else if videos.isEmpty {
                Text("No videos on this channel yet.").font(.system(size: 13)).foregroundStyle(.secondary)
            } else {
                LazyVGrid(columns: columns, spacing: 8) {
                    ForEach(videos) { video in
                        BrainVideoTile(
                            platform: platform,
                            video: video,
                            selected: picker.picked[video.id] != nil,
                            sampled: sampledIDs.contains(video.id)
                        ) { picker.toggle(video) }
                    }
                }
            }
        } else {
            NativeLoadingState(label: "Loading your videos…")
        }
    }

    private var footer: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let current = picker.current {
                progressLine("Listening to \(current.index + 1) of \(current.total): \(current.title)")
            }
            if deriving { progressLine("Writing your voice profile from what it heard…") }
            ForEach(picker.failures) { failure in
                BrainInlineError(message: "\(failure.title.isEmpty ? "Untitled" : failure.title): \(BrainVoiceFormat.failure(failure.code))")
            }
            HStack(spacing: 12) {
                Text(summary).font(.system(size: 13)).foregroundStyle(.secondary)
                Spacer()
                Button(picker.busy ? "Listening…" : "Transcribe and learn") {
                    Task { await onFinished(await picker.run { BrainVoiceStore.shared.add($0) }) }
                }
                .buttonStyle(EditorPrimaryButtonStyle())
                .disabled(picker.selection.isEmpty || picker.busy || deriving)
            }
        }
    }

    private func progressLine(_ text: String) -> some View {
        HStack(spacing: 8) {
            ProgressView().controlSize(.small)
            Text(text).font(.system(size: 13)).foregroundStyle(.secondary).lineLimit(1)
        }
    }

    private var summary: String {
        let count = picker.selection.count
        if count == 0 { return "Pick up to \(BrainVideoPickerStore.maxPick) videos" }
        let credits = picker.totalCredits
        return credits == 0 ? "\(count) selected \u{00B7} free" : "\(count) selected \u{00B7} \(credits) credit\(credits == 1 ? "" : "s")"
    }

    private var sampledIDs: Set<String> {
        Set(sampled.filter { $0.platform == platform }.map(\.externalPostId))
    }
}

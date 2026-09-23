import SwiftUI

/// Learning how the creator sounds from their own videos: the set it has
/// heard, rebuilding from it, and picking more from a connected channel.
struct BrainVoiceSheet: View {
    let onClose: () -> Void

    @ObservedObject private var voice = BrainVoiceStore.shared
    @ObservedObject private var connections = ConnectionsStore.shared
    @StateObject private var picker = BrainVideoPickerStore()
    @State private var picking = false

    var body: some View {
        Group {
            if picking {
                BrainVideoPicker(
                    platforms: platforms,
                    sampled: voice.samples ?? [],
                    picker: picker,
                    deriving: voice.deriving,
                    onBack: { picking = false },
                    onClose: onClose,
                    onFinished: finished
                )
            } else {
                samplesView
            }
        }
        .task {
            await connections.refresh()
            await voice.refresh()
        }
    }

    private var samplesView: some View {
        BrainSheetFrame(
            title: "From your videos",
            description: "Pick videos where you talk to camera. Yapper listens once and writes how you sound and how your scripts are built into the fields on this page. Rebuild any time you add more.",
            onClose: onClose
        ) {
            HStack(spacing: 8) {
                if voice.count > 0 {
                    Button {
                        Task { await voice.derive() }
                    } label: {
                        HStack(spacing: 6) {
                            if voice.deriving { ProgressView().controlSize(.mini) } else { Image(systemName: "arrow.clockwise") }
                            Text("Rebuild from \(voice.count) video\(voice.count == 1 ? "" : "s")")
                        }
                    }
                    .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                    .disabled(voice.deriving)
                }
                if !platforms.isEmpty {
                    Button { picking = true } label: { Label("Add videos", systemImage: "plus") }
                        .buttonStyle(EditorPrimaryButtonStyle(size: .small))
                }
            }
            if platforms.isEmpty, connections.response != nil { connectNote }
            list
            if voice.deriving {
                NativeLoadingState(label: "Writing your voice profile…")
            }
            if let error = voice.deriveError { BrainInlineError(message: error) }
            if voice.removeError { BrainInlineError(message: "That video could not be removed. Try again.") }
        }
    }

    private var connectNote: some View {
        HStack(spacing: 10) {
            Text("Connect Instagram, TikTok or YouTube and your published videos appear here to pick from.")
                .font(.system(size: 13)).foregroundStyle(.secondary)
            Spacer(minLength: 0)
            Button("Open Connections") {
                onClose()
                StudioNavigation.shared.goTo(.connections)
            }
            .buttonStyle(EditorSecondaryButtonStyle(size: .small))
        }
    }

    @ViewBuilder
    private var list: some View {
        if let samples = voice.samples {
            if samples.isEmpty {
                if !platforms.isEmpty {
                    Text("No videos yet. Three or four where you talk to camera are enough to start.")
                        .font(.system(size: 13)).foregroundStyle(.secondary)
                }
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(samples.enumerated()), id: \.element.id) { index, sample in
                        if index > 0 { Rectangle().fill(Color.studioLine).frame(height: 1) }
                        BrainVoiceSampleRow(sample: sample) { Task { await voice.remove(sample.id) } }
                    }
                }
            }
        } else if voice.failed {
            NativeErrorState(message: "Your voice samples could not be loaded.") { Task { await voice.refresh() } }
        } else {
            NativeLoadingState(label: "Loading your videos…")
        }
    }

    /// Connected channels Yapper can read videos from. Facebook can't.
    private var platforms: [String] {
        (connections.response?.connections ?? [])
            .filter { $0.status == "active" && $0.platform != "facebook" }
            .map(\.platform)
    }

    private func finished(_ added: Int) async {
        guard added > 0 else { return }
        await voice.derive()
        picking = false
    }
}

@preconcurrency import AVFoundation
import Foundation

/// Shelves shared by the editor and the audio library.
enum SoundEffectCategory: String, CaseIterable, Identifiable, Sendable {
    case whooshes
    case risers
    case pops
    case clicks
    case typing
    case paperAndMarkers
    /// The ones that are a moment rather than a transition. A crowd going up
    /// and a comedy outro are neither a whoosh nor a click, and burying them in
    /// a shelf they do not belong on is how a library stops being browsable.
    case stings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .whooshes: "Whooshes"
        case .risers: "Risers"
        case .pops: "Pops"
        case .clicks: "Clicks"
        case .typing: "Typing"
        case .paperAndMarkers: "Paper and markers"
        case .stings: "Stings"
        }
    }

    var icon: String {
        switch self {
        case .whooshes: "wind"
        case .risers: "chart.line.uptrend.xyaxis"
        case .pops: "circle.fill"
        case .clicks: "cursorarrow.click.2"
        case .typing: "keyboard"
        case .paperAndMarkers: "highlighter"
        case .stings: "sparkles"
        }
    }
}

struct SoundEffectDescriptor: Identifiable, Equatable, Sendable {
    /// Stable library identifier, independent of the selected recording.
    let id: String
    let name: String
    let detail: String
    let icon: String
    let duration: Double
    let category: SoundEffectCategory

    var resourceName: String {
        switch id {
        case "pop": "cheek-pop"
        case "mouse-click": "mouse-click-classic"
        default: id
        }
    }

    static func effect(id: String) -> SoundEffectDescriptor? {
        let canonical = ["cheek-pop": "pop", "mouse-click-classic": "mouse-click"][id] ?? id
        return library.first { $0.id == canonical }
    }

    /// Sounds shipped with the Mac app. IDs also identify audio in saved projects.
    static let library: [SoundEffectDescriptor] = [
        // Whooshes
        .init(id: "whoosh", name: "Whoosh", detail: "Short air pass", icon: "wind", duration: 0.32, category: .whooshes),
        .init(id: "fast-swoosh", name: "Fast swoosh", detail: "Tight, quick sweep", icon: "wind", duration: 0.99, category: .whooshes),
        .init(id: "swoosh", name: "Swoosh", detail: "Long cinematic sweep", icon: "wind", duration: 1.19, category: .whooshes),
        .init(id: "impact-swoosh", name: "Impact swoosh", detail: "Fight-scene hit", icon: "bolt.fill", duration: 0.34, category: .whooshes),

        // Risers
        .init(id: "metal-riser", name: "Metal riser", detail: "Builds to a drop", icon: "chart.line.uptrend.xyaxis", duration: 2.69, category: .risers),
        .init(id: "drum-roll", name: "Drum roll", detail: "Builds to a reveal", icon: "chart.line.uptrend.xyaxis", duration: 3.10, category: .risers),

        // Pops
        .init(id: "pop", name: "Pop", detail: "Comedy mouth pop", icon: "mouth", duration: 0.40, category: .pops),
        .init(id: "soft-bubble-pop", name: "Soft bubble pop", detail: "Rounded cartoon pop for reveals", icon: "circle.fill", duration: 0.18, category: .pops),

        // Clicks
        .init(id: "mouse-click", name: "Mouse click", detail: "Crisp mechanical click", icon: "cursorarrow.click", duration: 0.04, category: .clicks),
        .init(id: "ratchet", name: "Ratchet", detail: "Rotary clicks for a count-up", icon: "gearshape", duration: 3.23, category: .clicks),
        .init(id: "shutter-snap", name: "Shutter snap", detail: "One fast frame", icon: "camera", duration: 0.17, category: .clicks),
        .init(id: "camera-shutter", name: "Camera shutter", detail: "Mirror and mechanism", icon: "camera", duration: 0.46, category: .clicks),
        .init(id: "mechanical-tick-run", name: "Mechanical tick run", detail: "Accelerating ticks for a transition", icon: "gearshape", duration: 0.63, category: .clicks),

        // Typing
        .init(id: "muted-key-tap", name: "Muted key tap", detail: "One soft keyboard press", icon: "keyboard", duration: 0.12, category: .typing),
        .init(id: "muted-keyboard-burst", name: "Muted keyboard burst", detail: "Soft typing for a text reveal", icon: "keyboard", duration: 1.42, category: .typing),
        .init(id: "keyboard-click", name: "Keyboard click", detail: "Several spaced key presses", icon: "keyboard", duration: 4.38, category: .typing),
        .init(id: "keyboard-typing", name: "Keyboard typing", detail: "Nearly ten seconds of typing", icon: "keyboard", duration: 9.80, category: .typing),

        // Paper and markers
        .init(id: "page-flip", name: "Page flip", detail: "Paper turning once", icon: "book.pages", duration: 0.76, category: .paperAndMarkers),
        .init(id: "quick-highlighter-stroke", name: "Quick highlighter stroke", detail: "Short felt-tip swipe for underlines", icon: "highlighter", duration: 0.46, category: .paperAndMarkers),
        .init(id: "highlighter", name: "Highlighter", detail: "Longer marker stroke on paper", icon: "highlighter", duration: 1.42, category: .paperAndMarkers),

        // Stings
        .init(id: "close-heartbeat", name: "Close heartbeat", detail: "Three low double beats for tension", icon: "heart", duration: 1.78, category: .stings),
        .init(id: "cha-ching", name: "Cha-ching", detail: "Cash register hit", icon: "dollarsign.circle.fill", duration: 2.05, category: .stings),
        .init(id: "magic-reveal", name: "Magic reveal", detail: "Sparkle on a reveal", icon: "wand.and.rays", duration: 0.81, category: .stings),
        .init(id: "meme-outro", name: "Meme outro", detail: "Comedy sign-off", icon: "sparkles", duration: 10.15, category: .stings),
        .init(id: "crowd-cheer", name: "Crowd cheer", detail: "Stadium roar", icon: "person.3.fill", duration: 17.44, category: .stings),
    ]

    static func library(in category: SoundEffectCategory) -> [SoundEffectDescriptor] {
        library.filter { $0.category == category }
    }
}

actor SoundEffectService {
    static let shared = SoundEffectService()

    /// Loads the packaged file with no runtime generation or network request.
    nonisolated func bundledURL(for effect: SoundEffectDescriptor) -> URL? {
        AppResources.url(
            forResource: effect.resourceName,
            withExtension: "m4a",
            subdirectory: "SoundEffects"
        )
    }

    func fileURL(for effect: SoundEffectDescriptor) throws -> URL {
        guard let url = bundledURL(for: effect) else {
            throw NativeEditorError.missingSoundEffect(effect.name)
        }
        return url
    }

    func duration(of url: URL) async throws -> Double {
        let asset = AVURLAsset(url: url)
        guard try await asset.loadTracks(withMediaType: .audio).first != nil else {
            throw NativeEditorError.noAudioTrack(url.lastPathComponent)
        }
        return try await asset.load(.duration).seconds
    }
}

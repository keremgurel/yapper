@preconcurrency import AVFoundation
import Foundation

/// What a sound effect is for, which is the only way a creator looks for one.
/// Four shelves is enough to find anything in a library this size without a
/// search box.
enum SoundEffectCategory: String, CaseIterable, Identifiable, Sendable {
    case whooshes
    case risers
    case pops
    case clicks
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
        case .stings: "Stings"
        }
    }

    var icon: String {
        switch self {
        case .whooshes: "wind"
        case .risers: "chart.line.uptrend.xyaxis"
        case .pops: "circle.fill"
        case .clicks: "cursorarrow.click.2"
        case .stings: "sparkles"
        }
    }
}

struct SoundEffectDescriptor: Identifiable, Equatable, Sendable {
    /// Also the file name in the bundle.
    let id: String
    let name: String
    let detail: String
    let icon: String
    let duration: Double
    let category: SoundEffectCategory

    /// The shipped library, levelled to one shared loudness so dropping any two
    /// of them on a timeline does not mean reaching for the volume.
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
        .init(id: "pop", name: "Pop", detail: "Bright accent", icon: "circle.fill", duration: 0.26, category: .pops),
        .init(id: "cheek-pop", name: "Cheek pop", detail: "Comedy mouth pop", icon: "mouth", duration: 0.40, category: .pops),

        // Clicks
        .init(id: "mouse-click", name: "Mouse click", detail: "Single UI click", icon: "cursorarrow.click", duration: 0.32, category: .clicks),
        .init(id: "mouse-click-classic", name: "Classic click", detail: "Crisp mechanical click", icon: "cursorarrow.click", duration: 0.04, category: .clicks),
        .init(id: "keyboard-click", name: "Keyboard click", detail: "A few keys", icon: "keyboard", duration: 4.38, category: .clicks),
        .init(id: "keyboard-typing", name: "Keyboard typing", detail: "Ten seconds of typing", icon: "keyboard", duration: 9.80, category: .clicks),
        .init(id: "shutter-snap", name: "Shutter snap", detail: "One fast frame", icon: "camera", duration: 0.17, category: .clicks),
        .init(id: "camera-shutter", name: "Camera shutter", detail: "Mirror and mechanism", icon: "camera", duration: 0.46, category: .clicks),
        .init(id: "page-flip", name: "Page flip", detail: "Paper turn", icon: "book.pages", duration: 0.76, category: .clicks),

        // Stings
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

    /// The file that ships with the app. Nothing is generated or cached: these
    /// are real recordings now, levelled once when they were brought in.
    nonisolated func bundledURL(for effect: SoundEffectDescriptor) -> URL? {
        Bundle.module.url(
            forResource: effect.id,
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

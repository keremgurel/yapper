@preconcurrency import AVFoundation
import SwiftUI

/// Shown in place of the frame when the camera and microphone were both
/// refused. The system only asks once, so the way back is System Settings.
struct RecorderPermissionView: View {
    @ObservedObject var permissions: RecorderPermissions

    var body: some View {
        NativeEmptyState(
            systemImage: "video.slash",
            title: "Yapper can't use your camera or microphone",
            message: "Allow Yapper Studio under Camera and Microphone in System Settings, then come back here."
        ) {
            HStack(spacing: 8) {
                Button("Open camera settings") { permissions.openSettings(for: .video) }
                    .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                Button("Open microphone settings") { permissions.openSettings(for: .audio) }
                    .buttonStyle(EditorGhostButtonStyle(size: .small))
            }
            .padding(.top, 4)
        }
        .nativeCard()
    }
}

/// A quieter note when only one of the two was refused: the take can still
/// be made with the other.
struct RecorderPartialAccessNote: View {
    @ObservedObject var permissions: RecorderPermissions

    var body: some View {
        if let missing {
            HStack(spacing: 10) {
                Text(missing.text).font(.system(size: 12)).foregroundStyle(.secondary)
                Spacer(minLength: 0)
                Button("Open settings") { permissions.openSettings(for: missing.media) }
                    .buttonStyle(EditorGhostButtonStyle(size: .small))
            }
            .nativeWell(padding: 10)
        }
    }

    private var missing: (text: String, media: AVMediaType)? {
        if permissions.camera == .denied {
            return ("Camera access is off, so this take is audio only.", .video)
        }
        if permissions.microphone == .denied {
            return ("Microphone access is off, so this take has no sound.", .audio)
        }
        return nil
    }
}

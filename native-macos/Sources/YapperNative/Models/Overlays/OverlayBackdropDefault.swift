import Foundation

/// The backdrop new overlays start with: whatever was picked last, on any
/// overlay, in any project. Off until something is picked, so nobody's edit
/// changes look without them asking.
enum OverlayBackdropDefault {
    private static let key = "overlayBackdropDefault"

    static var current: OverlayBackdrop? {
        UserDefaults.standard.string(forKey: key).flatMap(OverlayBackdrop.init(token:))
    }

    static func remember(_ backdrop: OverlayBackdrop?) {
        UserDefaults.standard.set(backdrop?.token ?? "none", forKey: key)
    }
}

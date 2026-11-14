import Foundation

/// Keeps every scroll bar in the app an overlay.
///
/// With a mouse attached macOS gives scroll views a permanent bar that takes
/// 15 points out of the content. A pane that grew tall enough to scroll, or a
/// section that unfolded, then re-laid everything beside it: the inspector
/// jumped sideways and the timeline's tracks slid out from under their ruler.
/// Overlay bars sit on top of the content, so nothing moves when one appears.
///
/// Set in the argument domain: it wins over the system setting, lasts only for
/// this run and writes nothing to the creator's preferences.
enum OverlayScrollers {
    static func enforce() {
        let defaults = UserDefaults.standard
        var arguments = defaults.volatileDomain(forName: UserDefaults.argumentDomain)
        arguments["AppleShowScrollBars"] = "WhenScrolling"
        defaults.setVolatileDomain(arguments, forName: UserDefaults.argumentDomain)
    }
}

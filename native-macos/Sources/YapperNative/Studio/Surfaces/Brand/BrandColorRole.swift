/// What a palette position means. The kit is stored as an ordered list and
/// the overlay renderer reads it by position (`paletteFor` on the web), so a
/// role is just an index with a name.
enum BrandColorRole: Equatable {
    case primary, secondary, background, accent

    static let core: [BrandColorRole] = [.primary, .secondary, .background]

    init(index: Int) {
        self = index < Self.core.count ? Self.core[index] : .accent
    }

    var title: String {
        switch self {
        case .primary: "Primary"
        case .secondary: "Secondary"
        case .background: "Background"
        case .accent: "Accent"
        }
    }

    var hint: String {
        switch self {
        case .primary: "Your main brand color. Highlights and key numbers."
        case .secondary: "Pairs with primary. Often a dark or light neutral."
        case .background: "Cards and lower thirds sit on this."
        case .accent: "An extra color for charts and emphasis."
        }
    }

    /// What to start the picker on when adding this role.
    func suggestion(avoiding existing: [String]) -> String {
        let preferred: String? = switch self {
        case .primary: "#FF7A21"
        case .secondary: "#151515"
        case .background: "#FFFFFF"
        case .accent: nil
        }
        if let preferred, !existing.contains(preferred) { return preferred }
        return BrandHex.next(after: existing) ?? "#FF7A21"
    }
}

import Foundation

/// Looks built on the installed faces: the caption styles people recognise
/// from short-form video, none of them named after anyone.
extension TextTemplate {
    static let faces: [TextTemplate] = [
        TextTemplate(id: "bold", name: "Bold", appearance: TextAppearance(
            font: .geometric, color: .white, shadowEnabled: true, shadowRadius: 0.25
        )),
        TextTemplate(id: "impact", name: "Meme", appearance: TextAppearance(
            font: .impact, color: .white, strokeEnabled: true, strokeColor: .black, strokeWidth: 0.12, shadowEnabled: false
        )),
        TextTemplate(id: "hype", name: "Hype", appearance: TextAppearance(
            font: .condensed, color: StudioColor(hex: "#FFD93D") ?? .white,
            strokeEnabled: true, strokeColor: .black, strokeWidth: 0.1, shadowEnabled: false
        )),
        TextTemplate(id: "lime", name: "Lime", appearance: TextAppearance(
            font: .geometric, color: StudioColor(hex: "#B8F34A") ?? .white,
            strokeEnabled: true, strokeColor: .black, strokeWidth: 0.09, shadowEnabled: false
        )),
        TextTemplate(id: "ember", name: "Ember", appearance: TextAppearance(
            font: .modern, color: .white, shadowEnabled: true,
            shadowColor: StudioColor.brand.withOpacity(0.9), shadowRadius: 0.45
        )),
        TextTemplate(id: "label", name: "Label", appearance: TextAppearance(
            font: .geometric, color: .black, backgroundEnabled: true,
            backgroundColor: StudioColor.white.withOpacity(0.97), cornerRadius: 0.2, shadowEnabled: false
        )),
        TextTemplate(id: "redbox", name: "Red box", appearance: TextAppearance(
            font: .condensed, color: .white, backgroundEnabled: true,
            backgroundColor: (StudioColor(hex: "#E5383B") ?? .black).withOpacity(0.96), cornerRadius: 0.18, shadowEnabled: false
        )),
        TextTemplate(id: "slab", name: "Slab", appearance: TextAppearance(
            font: .slab, color: .white, shadowEnabled: true, shadowRadius: 0.25
        )),
        TextTemplate(id: "marker", name: "Marker", appearance: TextAppearance(
            font: .marker, color: .white, strokeEnabled: true, strokeColor: .black, strokeWidth: 0.08, shadowEnabled: false
        )),
        TextTemplate(id: "typewriter", name: "Typewriter", appearance: TextAppearance(
            font: .typewriter, color: StudioColor(hex: "#1B1A17") ?? .black, backgroundEnabled: true,
            backgroundColor: (StudioColor(hex: "#F4EBD0") ?? .white).withOpacity(0.97), cornerRadius: 0.12, shadowEnabled: false
        )),
    ]
}

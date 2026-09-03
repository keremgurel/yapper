import AppKit
import Foundation

/// The font a text or number node is set in.
///
/// The three families are the editor's own, the same ones `TextAppearanceLayer`
/// maps for captions, so an export never meets a font it cannot load. Weight is
/// honoured here where the caption path fixes it, because a scene's hierarchy
/// is made of weight as much as size.
enum SceneFontResolver {
    static func font(_ family: SceneNode.Font, weight: SceneNode.Weight, size: CGFloat) -> NSFont {
        let size = max(1, size)
        let base = NSFont.systemFont(ofSize: size, weight: nsWeight(weight))
        let design: NSFontDescriptor.SystemDesign
        switch family {
        case .modern: return base
        case .rounded: design = .rounded
        case .editorial: design = .serif
        }
        if let descriptor = base.fontDescriptor.withDesign(design),
           let styled = NSFont(descriptor: descriptor, size: size)
        {
            return styled
        }
        return base
    }

    static func nsWeight(_ weight: SceneNode.Weight) -> NSFont.Weight {
        switch weight {
        case .regular: .regular
        case .medium: .medium
        case .semibold: .semibold
        case .bold: .bold
        case .black: .black
        }
    }
}

import Foundation

/// Palette changes. Every one sends the whole list (`PATCH /api/brand`) and
/// takes the server's normalized kit back.
extension BrandKitStore {
    private struct ColorsBody: Encodable { let brandColors: [String] }

    var colors: [String] { kit?.colors ?? [] }

    func saveColors(_ colors: [String]) async {
        var unique: [String] = []
        for color in colors where !unique.contains(color) { unique.append(color) }
        await perform {
            self.kit = try await StudioJSONClient.patch("api/brand", body: ColorsBody(brandColors: unique))
        }
    }

    func addColor(_ color: String) async {
        guard colors.count < BrandLimits.maxColors, !colors.contains(color) else { return }
        await saveColors(colors + [color])
    }

    func replaceColor(_ old: String, with new: String) async {
        guard old != new else { return }
        await saveColors(colors.map { $0 == old ? new : $0 })
    }

    func removeColor(_ color: String) async {
        await saveColors(colors.filter { $0 != color })
    }

    func makePrimary(color: String) async {
        await saveColors([color] + colors.filter { $0 != color })
    }

    /// Moves a color to another's place; landing first makes it primary.
    func moveColor(_ color: String, to target: String) async {
        guard color != target, let to = colors.firstIndex(of: target) else { return }
        var next = colors.filter { $0 != color }
        next.insert(color, at: min(to, next.count))
        await saveColors(next)
    }
}

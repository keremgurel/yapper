import Foundation

/// The string a number node shows for a value, in `en-US` as the format
/// promises, so a counter reads "2,850" on every machine it is rendered on.
enum SceneNumberFormatter {
    private static let locale = Locale(identifier: "en_US")

    static func format(
        value: Double,
        format: SceneNode.NumberFormat,
        prefix: String? = nil,
        suffix: String? = nil
    ) -> String {
        let body: String
        switch format {
        case .plain:
            body = integer(value, grouping: false)
        case .grouped:
            body = integer(value, grouping: true)
        case .percent:
            // A fraction is a share; anything past 1 was already written as
            // a percentage by whoever designed it.
            let percent = abs(value) <= 1 ? value * 100 : value
            body = integer(percent, grouping: true) + "%"
        case .compact:
            body = compact(value)
        case .decimal1:
            body = decimal(value, places: 1, grouping: true)
        }
        return (prefix ?? "") + body + (suffix ?? "")
    }

    private static func integer(_ value: Double, grouping: Bool) -> String {
        decimal(value, places: 0, grouping: grouping)
    }

    private static func decimal(_ value: Double, places: Int, grouping: Bool) -> String {
        let formatter = NumberFormatter()
        formatter.locale = locale
        formatter.numberStyle = .decimal
        formatter.usesGroupingSeparator = grouping
        formatter.minimumFractionDigits = places
        formatter.maximumFractionDigits = places
        formatter.roundingMode = .halfUp
        let rounded = (value * pow(10, Double(places))).rounded() / pow(10, Double(places))
        // "-0" reads as a bug on a counter that has just started.
        let clean = rounded == 0 ? 0 : rounded
        return formatter.string(from: NSNumber(value: clean)) ?? String(clean)
    }

    /// "1.2K", "3.4M", "2B": one decimal, dropped when it is a zero, the way
    /// people write these by hand.
    private static func compact(_ value: Double) -> String {
        let magnitude = abs(value)
        let sign = value < 0 ? "-" : ""
        let units: [(Double, String)] = [(1e9, "B"), (1e6, "M"), (1e3, "K")]
        for (threshold, unit) in units where magnitude >= threshold {
            let scaled = (magnitude / threshold * 10).rounded() / 10
            let text = scaled == scaled.rounded()
                ? String(Int(scaled))
                : String(format: "%.1f", locale: locale, scaled)
            return sign + text + unit
        }
        return integer(value, grouping: true)
    }
}

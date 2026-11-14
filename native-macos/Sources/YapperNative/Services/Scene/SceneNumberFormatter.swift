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
        case .clock:
            body = clock(value)
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

    /// Seconds as m:ss, rounded to the nearest second, so a countdown from
    /// 300 reads 5:00, 4:59 … 0:00. Minutes past 59 stay minutes: a timer
    /// people read at a glance rarely runs an hour, and 75:00 is still clear.
    static func clock(_ seconds: Double) -> String {
        let total = Int(abs(seconds).rounded())
        let sign = seconds < 0 && total > 0 ? "-" : ""
        return sign + "\(total / 60):" + String(format: "%02d", total % 60)
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

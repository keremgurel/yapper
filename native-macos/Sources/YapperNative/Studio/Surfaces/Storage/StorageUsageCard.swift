import SwiftUI

/// Used against allowance: the total, a pressure chip, the bar, and any bytes
/// held for uploads still in flight.
struct StorageUsageCard: View {
    let usage: StorageUsage

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(usage.plan.map { "\($0.name) membership" } ?? "Included storage")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(.secondary)
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(StorageFormat.bytes(usage.usedBytes))
                            .font(.system(size: 28, weight: .semibold).monospacedDigit())
                        Text("/ \(StorageFormat.bytes(usage.quotaBytes))")
                            .font(.system(size: 17, weight: .medium).monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer(minLength: 0)
                NativeChip(text: usage.pressure.label, tone: .neutral)
            }
            StorageUsageBar(usage: usage)
                .padding(.top, 20)
            HStack {
                Text("\(StorageFormat.percent(usage.percent)) committed")
                Spacer(minLength: 8)
                Text("\(StorageFormat.bytes(usage.freeBytes)) free")
            }
            .font(.system(size: 12).monospacedDigit())
            .foregroundStyle(.secondary)
            .padding(.top, 8)
            if usage.reservedBytes > 0 {
                Text(reservedNote)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .nativeWell(padding: 10)
                    .padding(.top, 16)
            }
        }
        .nativeCard(padding: 24)
    }

    private var reservedNote: String {
        let uploads = StorageFormat.count(usage.reservedCount, "in-progress upload", "in-progress uploads")
        return "\(StorageFormat.bytes(usage.reservedBytes)) is temporarily reserved for \(uploads)."
    }
}

/// The meter. Neutral while there is room; the danger colour only once the
/// allowance is nearly gone.
private struct StorageUsageBar: View {
    let usage: StorageUsage

    var body: some View {
        GeometryReader { proxy in
            let fraction = max(usage.percent, usage.committedBytes > 0 ? 0.5 : 0) / 100
            ZStack(alignment: .leading) {
                Capsule().fill(Color.studioInputBackground)
                Capsule()
                    .fill(usage.pressure == .critical ? Color.studioDanger : Color.primary.opacity(0.62))
                    .frame(width: proxy.size.width * min(1, fraction))
            }
        }
        .frame(height: 10)
        .accessibilityElement()
        .accessibilityLabel("Storage used")
        .accessibilityValue("\(StorageFormat.percent(usage.percent)) committed")
    }
}

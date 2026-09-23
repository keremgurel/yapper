import SwiftUI

/// Each plan's allowance and what it would leave free at today's usage.
struct StoragePlanHeadroom: View {
    let usage: StorageUsage

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Plan headroom").font(.nativeSectionTitle)
            HStack(alignment: .top, spacing: 12) {
                ForEach(usage.plans) { option in
                    StoragePlanCard(
                        option: option,
                        current: option.key == usage.plan?.key,
                        headroom: usage.headroom(on: option)
                    )
                }
            }
        }
    }
}

private struct StoragePlanCard: View {
    let option: StorageUsage.PlanOption
    let current: Bool
    let headroom: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(option.name).font(.system(size: 13, weight: .semibold))
                Spacer(minLength: 8)
                if current { NativeChip(text: "Your plan") }
            }
            .frame(minHeight: 22)
            Text(option.storageLabel)
                .font(.system(size: 22, weight: .semibold))
                .padding(.top, 10)
            Text("\(StorageFormat.bytes(headroom)) available at today's usage")
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
                .padding(.top, 4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background {
            let shape = RoundedRectangle(cornerRadius: 14, style: .continuous)
            shape.fill(Color.panelBackground)
                .overlay { shape.strokeBorder(current ? Color.studioLineStrong : Color.studioLine, lineWidth: 1) }
        }
    }
}

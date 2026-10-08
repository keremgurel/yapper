import SwiftUI

struct StoragePlanHeadroom: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("How temporary storage works").font(.nativeSectionTitle)
            Text("Every membership has the same 5 GB limit at any one time. Weekly, monthly and yearly describe billing only. Storage never resets or accumulates.")
            Text("Yapper keeps one current video, plus files needed by scheduled posts. Published files, including editor exports, are released after the 24-hour retry window and the next cleanup run.")
            Text("Keep originals on your Mac. Scripts, transcripts and feedback remain after video files are removed.")
        }
        .font(.system(size: 13))
        .foregroundStyle(.secondary)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nativeCard(padding: 20)
    }
}

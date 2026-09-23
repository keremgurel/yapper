import SwiftUI

/// The pipeline status as a chip that opens the four choices.
struct IdeaCanvasStatusMenu: View {
    let status: IdeaCanvasStatus
    let onChange: (IdeaCanvasStatus) -> Void

    var body: some View {
        IdeaCanvasPopoverMenu(
            options: IdeaCanvasStatus.allCases.map { option in
                IdeaCanvasMenuOption(
                    id: option.rawValue, title: option.label, dot: option.tone.color, checked: option == status
                ) {
                    if option != status { onChange(option) }
                }
            },
            width: 170
        ) {
            HStack(spacing: 4) {
                NativeChip(text: status.label, tone: status.tone, dot: true)
                Image(systemName: "chevron.down").font(.system(size: 11)).foregroundStyle(.secondary)
            }
        }
        .help("Status: \(status.label)")
    }
}

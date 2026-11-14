import SwiftUI

/// The primary button: a solid ink pill, matching the web's default variant.
/// Black on light, white on dark.
struct EditorPrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    var size: StudioControlSize = .regular

    func makeBody(configuration: Configuration) -> some View {
        let pressed = configuration.isPressed && isEnabled
        return configuration.label
            // A button says all of its label or it is not a button: "Crop..."
            // and "Match..." were labels cut down by the row around them.
            .lineLimit(1)
            .fixedSize(horizontal: true, vertical: false)
            .font(size.font)
            .foregroundStyle(Color.studioAccentForeground)
            .padding(.horizontal, size.horizontalPadding + 2)
            .frame(height: size.height)
            .background { Capsule(style: .continuous).fill(Color.studioAccent) }
            .clipShape(Capsule(style: .continuous))
            .opacity(isEnabled ? (pressed ? 0.86 : 1) : 0.4)
            .animation(.easeInOut(duration: 0.15), value: pressed)
            .clickableCursor(enabled: isEnabled)
    }
}

/// The secondary button: a raised white pill with a hairline ring and a soft
/// drop, matching the web's `outline` variant.
struct EditorSecondaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    var size: StudioControlSize = .regular

    func makeBody(configuration: Configuration) -> some View {
        let shape = Capsule(style: .continuous)
        return configuration.label
            // A button says all of its label or it is not a button: "Crop..."
            // and "Match..." were labels cut down by the row around them.
            .lineLimit(1)
            .fixedSize(horizontal: true, vertical: false)
            .font(size.font)
            .foregroundStyle(.primary)
            .padding(.horizontal, size.horizontalPadding + 2)
            .frame(height: size.height)
            .background {
                shape
                    .fill(Color.raisedBackground)
                    .overlay { shape.fill(Color.studioFaintFill.opacity(configuration.isPressed ? 1 : 0)) }
                    .overlay { shape.strokeBorder(Color.studioLineStrong, lineWidth: 0.5) }
            }
            .clipShape(shape)
            .shadow(color: .black.opacity(0.05), radius: 2, y: 1)
            .opacity(isEnabled ? 1 : 0.4)
            .clickableCursor(enabled: isEnabled)
            .animation(.easeInOut(duration: 0.15), value: configuration.isPressed)
    }
}

/// The ghost button: no chrome until it is hovered or pressed.
struct EditorGhostButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    @State private var isHovering = false
    var size: StudioControlSize = .small

    func makeBody(configuration: Configuration) -> some View {
        let shape = Capsule(style: .continuous)
        return configuration.label
            // A button says all of its label or it is not a button: "Crop..."
            // and "Match..." were labels cut down by the row around them.
            .lineLimit(1)
            .fixedSize(horizontal: true, vertical: false)
            .font(size.font)
            .foregroundStyle(.primary)
            .padding(.horizontal, size.horizontalPadding)
            .frame(height: size.height)
            .background {
                shape.fill(
                    configuration.isPressed
                        ? Color.studioFaintFill.opacity(1)
                        : (isHovering ? Color.studioFaintFill.opacity(0.7) : .clear)
                )
            }
            .contentShape(shape)
            .onHover { isHovering = $0 }
            .opacity(isEnabled ? 1 : 0.5)
            .clickableCursor(enabled: isEnabled)
    }
}

/// Destructive actions: a solid danger fill carrying white text, matching the
/// web's `destructive` variant, which dims its fill in dark mode.
struct EditorDestructiveButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.colorScheme) private var colorScheme
    var size: StudioControlSize = .regular

    func makeBody(configuration: Configuration) -> some View {
        let shape = RoundedRectangle(cornerRadius: size.cornerRadius, style: .continuous)
        let fill = Color.studioDanger.opacity(colorScheme == .dark ? 0.60 : 1)
        return configuration.label
            // A button says all of its label or it is not a button: "Crop..."
            // and "Match..." were labels cut down by the row around them.
            .lineLimit(1)
            .fixedSize(horizontal: true, vertical: false)
            .font(size.font)
            .foregroundStyle(.white)
            .padding(.horizontal, size.horizontalPadding)
            .frame(height: size.height)
            .background { shape.fill(fill.opacity(configuration.isPressed ? 0.9 : 1)) }
            .clipShape(shape)
            .scaleEffect(configuration.isPressed && isEnabled ? 0.98 : 1)
            .opacity(isEnabled ? 1 : 0.5)
            .clickableCursor(enabled: isEnabled)
            .animation(.spring(response: 0.35, dampingFraction: 0.6), value: configuration.isPressed)
    }
}

/// `.plain`, plus the pointer that says a thing is clickable.
///
/// The hand used to be added by hand at each call site, which meant a good half
/// of the editor's plain buttons never got one. Anything reaching for `.plain`
/// should reach for this instead.
struct StudioPlainButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed && isEnabled ? 0.72 : 1)
            .contentShape(Rectangle())
            .clickableCursor(enabled: isEnabled)
    }
}

extension ButtonStyle where Self == StudioPlainButtonStyle {
    static var studioPlain: StudioPlainButtonStyle { StudioPlainButtonStyle() }
}

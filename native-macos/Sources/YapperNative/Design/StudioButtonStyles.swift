import SwiftUI

/// The brand's primary button: the accent metal face from the web design
/// system, with the same spring press.
struct EditorPrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.colorScheme) private var colorScheme
    var size: StudioControlSize = .regular

    private var isDark: Bool { colorScheme == .dark }

    func makeBody(configuration: Configuration) -> some View {
        let pressed = configuration.isPressed && isEnabled
        let shape = RoundedRectangle(cornerRadius: size.cornerRadius, style: .continuous)
        let textShadow = StudioMetal.accentTextShadow(dark: isDark)

        return configuration.label
            .font(size.font)
            .foregroundStyle(StudioMetal.accentForeground(dark: isDark))
            .shadow(color: textShadow.color, radius: 1, y: textShadow.y)
            .padding(.horizontal, size.horizontalPadding)
            .frame(height: size.height)
            .background {
                shape
                    .fill(StudioMetal.accentFace(dark: isDark))
                    .overlay {
                        shape.fill(StudioMetal.accentInnerShadow(dark: isDark, pressed: pressed))
                    }
                    .overlay {
                        shape.strokeBorder(
                            StudioMetal.accentBezel(dark: isDark),
                            lineWidth: size.bezelWidth
                        )
                    }
            }
            .clipShape(shape)
            .brightness(pressed ? -0.02 : 0)
            .accentCastShadow(dark: isDark, pressed: pressed, visible: isEnabled)
            .scaleEffect(pressed ? 0.97 : 1)
            .opacity(isEnabled ? 1 : 0.5)
            .animation(.spring(response: 0.4, dampingFraction: 0.55), value: pressed)
            .clickableCursor(enabled: isEnabled)
    }
}

/// The outline button: a plain surface with a hairline border, matching the
/// web's `outline` variant.
struct EditorSecondaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    var size: StudioControlSize = .regular

    func makeBody(configuration: Configuration) -> some View {
        let shape = RoundedRectangle(cornerRadius: size.cornerRadius, style: .continuous)
        return configuration.label
            .font(size.font)
            .foregroundStyle(.primary)
            .padding(.horizontal, size.horizontalPadding)
            .frame(height: size.height)
            .background {
                shape
                    .fill(Color.raisedBackground)
                    .overlay { shape.fill(Color.studioFaintFill.opacity(configuration.isPressed ? 1 : 0)) }
                    .overlay { shape.strokeBorder(Color.studioLine, lineWidth: 1) }
            }
            .clipShape(shape)
            .shadow(color: .black.opacity(0.06), radius: 1, y: 1)
            .scaleEffect(configuration.isPressed && isEnabled ? 0.98 : 1)
            .opacity(isEnabled ? 1 : 0.5)
            .clickableCursor(enabled: isEnabled)
            .animation(.spring(response: 0.35, dampingFraction: 0.6), value: configuration.isPressed)
    }
}

/// The ghost button: no chrome until it is hovered or pressed.
struct EditorGhostButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    @State private var isHovering = false
    var size: StudioControlSize = .small

    func makeBody(configuration: Configuration) -> some View {
        let shape = RoundedRectangle(cornerRadius: size.cornerRadius, style: .continuous)
        return configuration.label
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

private extension View {
    /// The accent button's cast shadow, applied as the stack of layers the web
    /// token describes. Disabled buttons sit flat: an unusable control should
    /// not look like it is floating off the surface.
    @ViewBuilder
    func accentCastShadow(dark: Bool, pressed: Bool, visible: Bool) -> some View {
        if visible {
            StudioMetal.accentDropShadow(dark: dark, pressed: pressed)
                .reduce(AnyView(self)) { view, layer in
                    AnyView(view.shadow(color: layer.color, radius: layer.radius, y: layer.y))
                }
        } else {
            self
        }
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

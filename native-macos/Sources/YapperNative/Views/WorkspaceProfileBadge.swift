import SwiftUI
import Combine

/// One compact account control, with the exact credit balance inside.
struct WorkspaceProfileBadge: View {
    let name: String
    var email: String? = nil
    let onNavigate: (StudioDestination) -> Void
    /// The account actions, which the web session carries out because Clerk
    /// owns the session. See `StudioWebCommands`.
    var onManageAccount: () -> Void = { StudioWebCommands.shared.manageAccount() }
    var onSignOut: () -> Void = { StudioWebCommands.shared.signOut() }
    var imageURL: URL? = nil
    var userID: String? = nil
    @ObservedObject private var billing = StudioBilling.shared

    @State private var isHovering = false
    @State private var isOpen = false

    private var snapshot: StudioBillingSnapshot? { billing.snapshot(for: userID) }

    var body: some View {
        Button {
            isOpen.toggle()
            if isOpen { Task { await billing.refresh(userID: userID) } }
        } label: {
            CreditAvatar(name: name, imageURL: imageURL, meter: snapshot?.creditMeter, diameter: 34)
                .frame(width: 40, height: 40)
                .background(Circle().fill(isHovering ? Color.studioFaintFill : Color.clear))
                .contentShape(Circle())
        }
        .buttonStyle(.studioPlain)
        .clickableCursor()
        .onHover { isHovering = $0 }
        .animation(.easeOut(duration: 0.14), value: isHovering)
        .task(id: userID) { await billing.refresh(userID: userID) }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
            Task { await billing.refresh(userID: userID) }
        }
        .onReceive(NotificationCenter.default.publisher(for: .studioAccountBalanceChanged).debounce(for: .milliseconds(500), scheduler: RunLoop.main)) { _ in
            Task { await billing.refresh(userID: userID) }
        }
        .help(snapshot.map { "\($0.balance.formatted()) credits left" } ?? name)
        .accessibilityLabel("Account: \(name)")
        .accessibilityValue(snapshot.map { "\($0.balance.formatted()) credits left" } ?? "Balance unavailable")
        .popover(isPresented: $isOpen, arrowEdge: .bottom) {
            WorkspaceProfileMenu(
                name: name,
                email: email,
                imageURL: imageURL,
                snapshot: snapshot,
                onNavigate: { destination in
                    isOpen = false
                    onNavigate(destination)
                },
                onManageAccount: {
                    isOpen = false
                    onManageAccount()
                },
                onSignOut: {
                    isOpen = false
                    onSignOut()
                }
            )
        }
    }
}

/// What the badge opens: where else in the workspace you can go.
private struct WorkspaceProfileMenu: View {
    let name: String
    let email: String?
    let imageURL: URL?
    let snapshot: StudioBillingSnapshot?
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.openURL) private var openURL
    let onNavigate: (StudioDestination) -> Void
    let onManageAccount: () -> Void
    let onSignOut: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 10) {
                CreditAvatar(name: name, imageURL: imageURL, meter: snapshot?.creditMeter, diameter: 48)
                VStack(alignment: .leading, spacing: 3) {
                    Text(name).font(.system(size: 13, weight: .semibold)).lineLimit(1)
                    Text(snapshot?.creditMeter?.planLabel ?? "Account")
                        .font(.system(size: 11)).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
            }.padding(12)

            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Credits").fontWeight(.semibold)
                    Spacer()
                    Text(snapshot.map { "\($0.balance.formatted()) left" } ?? "Balance unavailable")
                        .foregroundStyle(.secondary).monospacedDigit()
                }.font(.system(size: 12))
                GeometryReader { proxy in
                    Capsule().fill(Color.primary.opacity(0.1))
                        .overlay(alignment: .leading) {
                            if let fraction = snapshot?.creditMeter?.clampedFraction {
                                Capsule().fill(creditColor(snapshot?.creditMeter, scheme: colorScheme))
                                    .frame(width: proxy.size.width * fraction)
                            }
                        }
                }.frame(height: 5).accessibilityHidden(true)
                if let allowance = snapshot?.creditMeter?.allowance {
                    Text("\(allowance.formatted()) included per \(snapshot?.creditMeter?.planLabel == "Studio trial" ? "trial" : "billing period"). Extra credits count too.")
                        .font(.system(size: 10)).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                }
                Button(snapshot?.entitled == true ? "Manage membership & credits" : "Explore membership") {
                    openURL(URL(string: "https://ypr.app/pricing")!)
                }
                .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                .frame(maxWidth: .infinity)
            }
            .padding(12)
            .background(Color.studioFaintFill, in: RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal, 8)
            .padding(.bottom, 8)

            row("Brain", "brain", .brain)
            row("Ideas", "lightbulb", .ideas)
            Divider().padding(.vertical, 4)
            row("Brand", "paintpalette", .brand)
            row("Storage", "externaldrive", .storage)
            row("Dictionary", "character.book.closed", .dictionary)
            row("Connections", "link", .connections)
            Divider().padding(.vertical, 4)
            // The two the badge was missing entirely, which left a creator
            // signed into the wrong account with nothing to click.
            WorkspaceMenuRow(
                title: "Manage account",
                icon: "person.crop.circle",
                action: onManageAccount
            )
            WorkspaceMenuRow(
                title: "Sign out",
                icon: "rectangle.portrait.and.arrow.right",
                action: onSignOut
            )
        }
        .padding(.bottom, 6)
        .frame(width: 288)
    }

    private func row(
        _ title: String,
        _ icon: String,
        _ destination: StudioDestination
    ) -> some View {
        WorkspaceMenuRow(title: title, icon: icon) { onNavigate(destination) }
    }
}

/// One line of the menu, highlighting under the pointer the way a menu does.
private struct WorkspaceMenuRow: View {
    let title: String
    let icon: String
    let action: () -> Void

    @State private var isHovering = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(isHovering ? Color.white : Color.secondary)
                    .frame(width: 16)
                Text(title)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(isHovering ? Color.white : Color.primary)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 10)
            .frame(height: 28)
            .background {
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(isHovering ? Color.yapperOrange : Color.clear)
                    .padding(.horizontal, 4)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.studioPlain)
        .clickableCursor()
        .onHover { isHovering = $0 }
    }
}

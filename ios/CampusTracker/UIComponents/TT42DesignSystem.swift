import SwiftUI

enum TT42Palette {
    static let magenta = Color(red: 0.90, green: 0.20, blue: 0.64)
    static let mint = Color(red: 0.24, green: 0.87, blue: 0.66)
    static let teal = Color(red: 0.07, green: 0.62, blue: 0.75)
    static let cyan = Color(red: 0.18, green: 0.72, blue: 0.86)

    static let primaryTint = teal
    static let secondaryTint = mint

    static let darkTrack = Color(red: 0.24, green: 0.24, blue: 0.26)
    static let cardLight = Color(red: 0.97, green: 0.98, blue: 1.00)
    static let cardDark = Color(red: 0.11, green: 0.12, blue: 0.14)

    static let appBackgroundLight = Color(red: 0.95, green: 0.96, blue: 0.99)
    static let appBackgroundDark = Color(red: 0.05, green: 0.06, blue: 0.08)
}

enum TT42Spacing {
    static let xSmall: CGFloat = 6
    static let small: CGFloat = 10
    static let medium: CGFloat = 16
    static let large: CGFloat = 24
}

enum TT42ThemeMode: String, CaseIterable, Identifiable {
    case system
    case light
    case dark

    var id: String { rawValue }

    var title: String {
        switch self {
        case .system:
            return "System"
        case .light:
            return "Light"
        case .dark:
            return "Dark"
        }
    }

    var colorScheme: ColorScheme? {
        switch self {
        case .system:
            return nil
        case .light:
            return .light
        case .dark:
            return .dark
        }
    }
}

extension View {
    func tt42CardStyle() -> some View {
        modifier(TT42CardModifier())
    }
}

private struct TT42CardModifier: ViewModifier {
    @Environment(\.colorScheme) private var colorScheme

    func body(content: Content) -> some View {
        content
            .padding(TT42Spacing.medium)
            .background(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(colorScheme == .dark ? TT42Palette.cardDark : TT42Palette.cardLight)
                    .shadow(
                        color: .black.opacity(colorScheme == .dark ? 0.25 : 0.08),
                        radius: colorScheme == .dark ? 10 : 14,
                        x: 0,
                        y: 6
                    )
            )
    }
}

struct TT42ScreenBackground: View {
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        LinearGradient(
            colors: gradientColors,
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()
    }

    private var gradientColors: [Color] {
        if colorScheme == .dark {
            return [
                TT42Palette.appBackgroundDark,
                TT42Palette.darkTrack.opacity(0.85),
                TT42Palette.appBackgroundDark
            ]
        }
        return [
            TT42Palette.appBackgroundLight,
            Color.white,
            TT42Palette.appBackgroundLight
        ]
    }
}

struct TT42SectionHeader: View {
    let title: String
    let subtitle: String?

    init(_ title: String, subtitle: String? = nil) {
        self.title = title
        self.subtitle = subtitle
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.system(.title3, design: .rounded, weight: .semibold))
            if let subtitle, !subtitle.isEmpty {
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

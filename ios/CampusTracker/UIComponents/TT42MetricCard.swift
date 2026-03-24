import SwiftUI

struct TT42MetricCard: View {
    let title: String
    let value: String
    let subtitle: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: TT42Spacing.small) {
            Text(title)
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Text(value)
                .font(.system(.title2, design: .rounded, weight: .bold))
                .foregroundStyle(.primary)

            Text(subtitle)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(TT42Spacing.medium)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(tint.opacity(0.12))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(tint.opacity(0.22), lineWidth: 1)
        )
    }
}

#Preview {
    TT42MetricCard(
        title: "Month",
        value: "42.5 h",
        subtitle: "47.5 h left",
        tint: TT42Palette.magenta
    )
    .padding()
}

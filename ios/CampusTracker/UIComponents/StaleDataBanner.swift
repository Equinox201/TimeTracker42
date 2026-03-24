import SwiftUI

struct StaleDataBanner: View {
    let isStale: Bool
    let message: String

    var body: some View {
        let staleColor: Color = .orange
        let freshColor: Color = TT42Palette.mint

        HStack {
            Image(systemName: isStale ? "exclamationmark.triangle.fill" : "checkmark.seal.fill")
                .foregroundStyle(isStale ? staleColor : freshColor)
            Text(message)
                .font(.subheadline)
            Spacer()
        }
        .padding(12)
        .background((isStale ? staleColor : freshColor).opacity(0.15))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke((isStale ? staleColor : freshColor).opacity(0.25), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

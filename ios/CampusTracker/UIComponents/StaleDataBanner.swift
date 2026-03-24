import SwiftUI

struct StaleDataBanner: View {
    let isStale: Bool
    let message: String

    var body: some View {
        HStack {
            Image(systemName: isStale ? "exclamationmark.triangle.fill" : "checkmark.seal.fill")
                .foregroundStyle(isStale ? TT42Palette.magenta : TT42Palette.mint)
            Text(message)
                .font(.subheadline)
            Spacer()
        }
        .padding(12)
        .background((isStale ? TT42Palette.magenta : TT42Palette.mint).opacity(0.15))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke((isStale ? TT42Palette.magenta : TT42Palette.mint).opacity(0.25), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

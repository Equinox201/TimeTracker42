import SwiftUI

struct StaleDataBanner: View {
    let isStale: Bool
    let message: String

    var body: some View {
        HStack {
            Image(systemName: isStale ? "exclamationmark.triangle.fill" : "checkmark.seal.fill")
                .foregroundStyle(isStale ? .orange : .green)
            Text(message)
                .font(.subheadline)
            Spacer()
        }
        .padding(10)
        .background((isStale ? Color.orange : Color.green).opacity(0.15))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

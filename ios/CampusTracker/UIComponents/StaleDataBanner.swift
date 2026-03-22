import SwiftUI

struct StaleDataBanner: View {
    let message: String

    var body: some View {
        HStack {
            Text(message)
                .font(.subheadline)
            Spacer()
        }
        .padding(10)
        .background(Color.yellow.opacity(0.2))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

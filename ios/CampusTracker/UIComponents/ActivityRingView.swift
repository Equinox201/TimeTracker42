import SwiftUI

struct ActivityRingView: View {
    let title: String
    let progress: Double
    let tint: Color

    var body: some View {
        VStack(spacing: 8) {
            ZStack {
                Circle()
                    .stroke(tint.opacity(0.2), lineWidth: 12)

                Circle()
                    .trim(from: 0, to: min(max(progress, 0), 1))
                    .stroke(tint, style: StrokeStyle(lineWidth: 12, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            }
            .frame(width: 96, height: 96)

            Text(title)
                .font(.headline)
        }
    }
}

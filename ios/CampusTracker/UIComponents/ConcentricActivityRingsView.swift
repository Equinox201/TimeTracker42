import SwiftUI

struct RingMetric: Identifiable {
    let id = UUID()
    let title: String
    let valueHours: Double
    let goalHours: Double
    let tint: Color

    var progress: Double {
        guard goalHours > 0 else { return 0 }
        return max(valueHours / goalHours, 0)
    }
}

struct ConcentricActivityRingsView: View {
    let metrics: [RingMetric] // order: outer -> inner

    var body: some View {
        VStack(spacing: TT42Spacing.medium) {
            ZStack {
                ForEach(Array(metrics.enumerated()), id: \.element.id) { index, metric in
                    let diameter = max(110, 260 - (CGFloat(index) * 44))
                    RingLayer(progress: metric.progress, tint: metric.tint, diameter: diameter)
                }

                Circle()
                    .fill(.black)
                    .frame(width: 80, height: 80)

                Text("42")
                    .font(.system(size: 34, weight: .black, design: .rounded))
                    .foregroundStyle(.white)
            }
            .frame(height: 280)

            VStack(spacing: TT42Spacing.small) {
                ForEach(metrics) { metric in
                    HStack {
                        Circle()
                            .fill(metric.tint)
                            .frame(width: 10, height: 10)
                        Text(metric.title)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text("\(formatHours(metric.valueHours)) / \(formatHours(metric.goalHours)) h")
                            .font(.subheadline.weight(.semibold))
                        Text(percentLabel(progress: metric.progress))
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(metric.tint)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(metric.tint.opacity(0.16))
                            .clipShape(Capsule())
                    }
                }
            }
        }
        .tt42CardStyle()
    }

    private func formatHours(_ hours: Double) -> String {
        String(format: "%.1f", hours)
    }

    private func percentLabel(progress: Double) -> String {
        "\(Int((progress * 100).rounded()))%"
    }
}

private struct RingLayer: View {
    let progress: Double
    let tint: Color
    let diameter: CGFloat

    private var normalizedProgress: Double {
        min(progress, 1)
    }

    private var overflowProgress: Double {
        min(max(progress - 1, 0), 1)
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(TT42Palette.darkTrack.opacity(0.35), lineWidth: 22)

            Circle()
                .trim(from: 0, to: normalizedProgress)
                .stroke(
                    AngularGradient(
                        gradient: Gradient(colors: [tint.opacity(0.7), tint, tint.opacity(0.9)]),
                        center: .center
                    ),
                    style: StrokeStyle(lineWidth: 22, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))

            if overflowProgress > 0 {
                Circle()
                    .trim(from: 0, to: overflowProgress)
                    .stroke(
                        tint.opacity(0.35),
                        style: StrokeStyle(lineWidth: 10, lineCap: .round, dash: [7, 5])
                    )
                    .rotationEffect(.degrees(-90))
            }
        }
        .frame(width: diameter, height: diameter)
    }
}

#Preview {
    ZStack {
        TT42ScreenBackground()
        ConcentricActivityRingsView(
            metrics: [
                RingMetric(title: "Month", valueHours: 95, goalHours: 90, tint: TT42Palette.magenta),
                RingMetric(title: "Week", valueHours: 19, goalHours: 22.5, tint: TT42Palette.mint),
                RingMetric(title: "Day", valueHours: 6.5, goalHours: 4, tint: TT42Palette.teal),
            ]
        )
        .padding()
    }
}

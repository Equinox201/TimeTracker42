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
                    let diameter = max(118, 288 - (CGFloat(index) * 64))
                    RingLayer(progress: metric.progress, tint: metric.tint, diameter: diameter)
                }

                Circle()
                    .fill(.black)
                    .frame(width: 82, height: 82)

                Text("42")
                    .font(.system(size: 34, weight: .black, design: .rounded))
                    .foregroundStyle(.white)
            }
            .frame(height: 308)
            .animation(.spring(response: 0.45, dampingFraction: 0.82), value: metrics.map(\.progress))

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
                        Text("\(TimeFormatters.hoursToReadable(metric.valueHours)) / \(TimeFormatters.hoursToReadable(metric.goalHours))")
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

    private func percentLabel(progress: Double) -> String {
        "\(Int((progress * 100).rounded()))%"
    }
}

private struct RingLayer: View {
    let progress: Double
    let tint: Color
    let diameter: CGFloat

    private let ringWidth: CGFloat = 20
    private let overflowScale: CGFloat = 1.0

    private var lap1: Double {
        min(progress, 1)
    }

    private var lap2: Double {
        min(max(progress - 1, 0), 1)
    }

    var body: some View {
        let overflowLineWidth = ringWidth

        ZStack {
            Circle()
                .stroke(TT42Palette.darkTrack.opacity(0.44), lineWidth: ringWidth)

            ringStroke(progress: lap1, color: tint, scale: 1.0, lineWidth: ringWidth, punchy: false)

            if lap2 > 0 {
                // Overflow lap sits on top of lap 1 with a slightly larger radius.
                ringStroke(
                    progress: lap2,
                    color: tint,
                    scale: overflowScale,
                    lineWidth: overflowLineWidth,
                    punchy: true
                )

                RingHead(
                    progress: lap2,
                    diameter: diameter,
                    strokeWidth: overflowLineWidth,
                    scale: overflowScale,
                    tint: tint,
                    emphasized: true
                )
            } else if lap1 > 0.02 {
                RingHead(
                    progress: lap1,
                    diameter: diameter,
                    strokeWidth: ringWidth,
                    scale: 1.0,
                    tint: tint,
                    emphasized: false
                )
            }
        }
        .frame(width: diameter, height: diameter)
    }

    @ViewBuilder
    private func ringStroke(progress: Double, color: Color, scale: CGFloat, lineWidth: CGFloat, punchy: Bool) -> some View {
        Circle()
            .trim(from: 0, to: progress)
            .stroke(
                AngularGradient(
                    gradient: Gradient(
                        colors: punchy
                            ? [color.opacity(0.94), color, color.opacity(0.86)]
                            : [color.opacity(0.72), color, color.opacity(0.9)]
                    ),
                    center: .center
                ),
                style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
            )
            .scaleEffect(scale)
            .rotationEffect(.degrees(-90))
            .shadow(color: color.opacity(punchy ? 0.58 : 0.28), radius: punchy ? 10 : 4, x: 0, y: punchy ? 4 : 2)
    }
}

private struct RingHead: View {
    let progress: Double
    let diameter: CGFloat
    let strokeWidth: CGFloat
    let scale: CGFloat
    let tint: Color
    let emphasized: Bool

    var body: some View {
        GeometryReader { geo in
            let center = CGPoint(x: geo.size.width / 2, y: geo.size.height / 2)
            let radius = (diameter * scale) / 2
            let angle = angleForProgress(progress)
            let point = pointOnCircle(center: center, radius: radius, angle: angle)
            let headSize = emphasized ? strokeWidth + 6 : strokeWidth + 3

            ZStack {
                Circle()
                    .fill(tint)
                    .overlay(
                        Circle()
                            .stroke(Color.black.opacity(emphasized ? 0.3 : 0.18), lineWidth: emphasized ? 1.4 : 0.8)
                    )
                    .frame(width: headSize, height: headSize)
                    .shadow(color: .black.opacity(emphasized ? 0.42 : 0.2), radius: emphasized ? 9 : 3, x: 0, y: emphasized ? 5 : 2)

                Image(systemName: "arrow.right")
                    .font(.system(size: emphasized ? 12 : 9, weight: .black))
                    .foregroundStyle(.black.opacity(0.9))
                    .rotationEffect(.degrees(angle + 90))
            }
            .position(point)
        }
    }

    private func angleForProgress(_ progress: Double) -> Double {
        (-90 + (progress * 360)).truncatingRemainder(dividingBy: 360)
    }

    private func pointOnCircle(center: CGPoint, radius: CGFloat, angle: Double) -> CGPoint {
        let rad = CGFloat(angle * .pi / 180)
        return CGPoint(
            x: center.x + (radius * cos(rad)),
            y: center.y + (radius * sin(rad))
        )
    }
}

#Preview {
    ZStack {
        TT42ScreenBackground()
        ConcentricActivityRingsView(
            metrics: [
                RingMetric(title: "Month", valueHours: 125, goalHours: 90, tint: TT42Palette.magenta),
                RingMetric(title: "Week", valueHours: 19, goalHours: 22.5, tint: TT42Palette.mint),
                RingMetric(title: "Day", valueHours: 6.5, goalHours: 4, tint: TT42Palette.cyan),
            ]
        )
        .padding()
    }
}

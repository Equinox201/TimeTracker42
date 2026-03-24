import SwiftUI

struct AttendanceCalendarDay: Identifiable {
    let date: Date
    let hours: Double
    let hasRecord: Bool

    var id: Date { date }
}

struct AttendanceMonthCalendarView: View {
    let month: Date
    let dailyGoal: Double
    let weekGoalAchievements: Set<Date>
    let entriesByDate: [Date: AttendanceCalendarDay]
    var showLegend: Bool = true

    @Environment(\.calendar) private var calendar

    private let columns = Array(repeating: GridItem(.flexible(), spacing: TT42Spacing.xSmall), count: 7)

    var body: some View {
        VStack(alignment: .leading, spacing: TT42Spacing.small) {
            HStack {
                Text(monthTitle)
                    .font(.system(.headline, design: .rounded, weight: .semibold))
                Spacer()
            }

            LazyVGrid(columns: columns, spacing: TT42Spacing.xSmall) {
                ForEach(weekdaySymbols, id: \.self) { symbol in
                    Text(symbol)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                }

                ForEach(gridDates.indices, id: \.self) { index in
                    let date = gridDates[index]
                    if let date {
                        dayCell(for: date)
                    } else {
                        Color.clear
                            .frame(height: 38)
                    }
                }
            }

            if showLegend {
                legend
            }
        }
        .tt42CardStyle()
    }

    private var monthTitle: String {
        Self.monthFormatter.string(from: month)
    }

    private var weekdaySymbols: [String] {
        let symbols = calendar.veryShortStandaloneWeekdaySymbols
        let start = calendar.firstWeekday - 1
        return Array(symbols[start...]) + Array(symbols[..<start])
    }

    private var gridDates: [Date?] {
        guard let monthRange = calendar.dateInterval(of: .month, for: month) else {
            return []
        }

        let monthStart = monthRange.start
        let totalDays = calendar.range(of: .day, in: .month, for: monthStart)?.count ?? 0
        let firstDayWeekday = calendar.component(.weekday, from: monthStart)
        let leadingPadding = (firstDayWeekday - calendar.firstWeekday + 7) % 7

        var values: [Date?] = Array(repeating: nil, count: leadingPadding)
        values.append(
            contentsOf: (0..<totalDays).compactMap { offset in
                calendar.date(byAdding: .day, value: offset, to: monthStart)
            }
        )

        while values.count % 7 != 0 {
            values.append(nil)
        }
        return values
    }

    @ViewBuilder
    private func dayCell(for date: Date) -> some View {
        let startOfDay = calendar.startOfDay(for: date)
        let entry = entriesByDate[startOfDay]
        let status = status(for: startOfDay, entry: entry)
        let isToday = calendar.isDateInToday(startOfDay)
        let weekStart = weekStartDate(for: startOfDay)
        let weekAchieved = weekGoalAchievements.contains(weekStart)

        VStack(spacing: 2) {
            Text("\(calendar.component(.day, from: startOfDay))")
                .font(.caption.weight(.semibold))
            Text(entry.map { dayHoursLabel($0.hours) } ?? "0m")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, minHeight: 38)
        .padding(.vertical, 4)
        .background(dayBackground(for: status))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(weekAchieved ? TT42Palette.mint.opacity(0.7) : .clear, lineWidth: 1.5)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(isToday ? TT42Palette.teal : .clear, lineWidth: 1.5)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private func dayBackground(for status: DayStatus) -> some View {
        RoundedRectangle(cornerRadius: 10, style: .continuous)
            .fill(status.color.opacity(status.opacity))
    }

    private func status(for date: Date, entry: AttendanceCalendarDay?) -> DayStatus {
        let today = calendar.startOfDay(for: Date())
        if date > today {
            return .future
        }

        let hours = entry?.hours ?? 0
        if dailyGoal <= 0 {
            return hours > 0 ? .achieved : .missed
        }
        if hours > dailyGoal {
            return .exceeded
        }
        if hours >= dailyGoal {
            return .achieved
        }
        return .missed
    }

    private func weekStartDate(for date: Date) -> Date {
        calendar.dateInterval(of: .weekOfYear, for: date)?.start ?? date
    }

    private func dayHoursLabel(_ hours: Double) -> String {
        if hours <= 0 { return "0m" }
        return TimeFormatters.hoursToClock(hours)
    }

    private var legend: some View {
        VStack(alignment: .leading, spacing: 8) {
            legendRow(title: "Exceeded goal", color: TT42Palette.magenta, opacity: 0.34)
            legendRow(title: "Achieved goal", color: TT42Palette.mint, opacity: 0.28)
            legendRow(title: "Missed goal", color: TT42Palette.darkTrack, opacity: 0.22)
            legendRow(title: "Future day", color: .gray, opacity: 0.12)
            legendRow(title: "Week goal achieved", color: TT42Palette.mint, opacity: 0.08, showStroke: true)
        }
        .font(.caption)
        .foregroundStyle(.secondary)
        .padding(.top, 6)
    }

    private func legendRow(
        title: String,
        color: Color,
        opacity: Double,
        showStroke: Bool = false
    ) -> some View {
        HStack(spacing: 8) {
            RoundedRectangle(cornerRadius: 4, style: .continuous)
                .fill(color.opacity(opacity))
                .overlay(
                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                        .stroke(showStroke ? color.opacity(0.8) : .clear, lineWidth: 1)
                )
                .frame(width: 18, height: 12)
            Text(title)
            Spacer()
        }
    }

    private enum DayStatus {
        case future
        case missed
        case achieved
        case exceeded

        var color: Color {
            switch self {
            case .future:
                return .gray
            case .missed:
                return TT42Palette.darkTrack
            case .achieved:
                return TT42Palette.mint
            case .exceeded:
                return TT42Palette.magenta
            }
        }

        var opacity: Double {
            switch self {
            case .future:
                return 0.12
            case .missed:
                return 0.22
            case .achieved:
                return 0.28
            case .exceeded:
                return 0.34
            }
        }
    }

    private static let monthFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "LLLL yyyy"
        return formatter
    }()
}

#Preview {
    let calendar = Calendar.current
    let now = Date()
    let monthStart = calendar.date(from: calendar.dateComponents([.year, .month], from: now)) ?? now
    let mockDates = (0..<15).compactMap { calendar.date(byAdding: .day, value: $0, to: monthStart) }
    let entries = Dictionary(
        uniqueKeysWithValues: mockDates.map { date in
            let start = calendar.startOfDay(for: date)
            return (start, AttendanceCalendarDay(date: start, hours: Double.random(in: 0...9), hasRecord: true))
        }
    )

    ZStack {
        TT42ScreenBackground()
        AttendanceMonthCalendarView(
            month: now,
            dailyGoal: 6,
            weekGoalAchievements: [],
            entriesByDate: entries
        )
        .padding()
    }
}

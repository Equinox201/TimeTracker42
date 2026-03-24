import Charts
import SwiftUI

struct AttendanceHistoryView: View {
    @Environment(AppState.self) private var appState
    @State private var history: AttendanceHistoryResponse?
    @State private var selectedMonth: Date = Date()
    @State private var isLoading = false
    @State private var errorMessage: String?

    @AppStorage("ui_daily_goal_hours") private var localDailyGoalHours = 6.0
    @AppStorage("ui_weekly_goal_hours") private var localWeeklyGoalHours = 22.5

    var body: some View {
        NavigationStack {
            ZStack {
                TT42ScreenBackground()

                Group {
                    if isLoading && history == nil {
                        ProgressView("Loading attendance history...")
                    } else if let errorMessage, history == nil {
                        ContentUnavailableView(
                            "Unable to Load History",
                            systemImage: "wifi.exclamationmark",
                            description: Text(errorMessage)
                        )
                    } else if let history {
                        ScrollView {
                            VStack(spacing: TT42Spacing.large) {
                                TT42SectionHeader(
                                    "Historic Attendance",
                                    subtitle: "Track monthly trends and day-by-day consistency"
                                )

                                StaleDataBanner(
                                    isStale: history.isStale,
                                    message: staleMessage(for: history)
                                )

                                VStack(alignment: .leading, spacing: TT42Spacing.small) {
                                    TT42SectionHeader("Monthly Totals", subtitle: "Last 6 months")

                                    Chart(monthlyPoints(from: history.days)) { point in
                                        BarMark(
                                            x: .value("Month", point.month, unit: .month),
                                            y: .value("Hours", point.hours)
                                        )
                                        .foregroundStyle(
                                            LinearGradient(
                                                colors: [TT42Palette.teal, TT42Palette.magenta],
                                                startPoint: .bottom,
                                                endPoint: .top
                                            )
                                        )
                                        .cornerRadius(4)
                                    }
                                    .frame(height: 220)
                                }
                                .tt42CardStyle()

                                monthPicker(points: monthlyPoints(from: history.days))

                                AttendanceMonthCalendarView(
                                    month: selectedMonth,
                                    dailyGoal: localDailyGoalHours,
                                    weekGoalAchievements: achievedWeekStarts(
                                        from: history.days,
                                        month: selectedMonth,
                                        weeklyGoal: localWeeklyGoalHours
                                    ),
                                    entriesByDate: attendanceByDate(
                                        filterToMonth(history.days, month: selectedMonth)
                                    )
                                )

                                statsCard(for: history)
                            }
                            .padding(TT42Spacing.medium)
                        }
                    } else {
                        ContentUnavailableView("No history data", systemImage: "calendar")
                    }
                }
            }
            .navigationTitle("Historic")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await refreshHistory() }
                    } label: {
                        if isLoading {
                            ProgressView()
                        } else {
                            Image(systemName: "arrow.clockwise")
                        }
                    }
                    .disabled(isLoading)
                }
            }
            .task(id: appState.accessToken) {
                await refreshHistory()
            }
            .alert("History Error", isPresented: errorAlertBinding) {
                Button("OK") { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private var errorAlertBinding: Binding<Bool> {
        Binding(
            get: { errorMessage != nil },
            set: { newValue in
                if !newValue {
                    errorMessage = nil
                }
            }
        )
    }

    private func refreshHistory() async {
        isLoading = true
        defer { isLoading = false }

        let range = sixMonthRange()

        do {
            let accessToken = try await appState.validAccessToken()
            let loadedHistory = try await appState.apiClient.getAttendanceHistory(
                accessToken: accessToken,
                from: range.start,
                to: range.end
            )
            history = loadedHistory
            if selectedMonth > range.end || selectedMonth < range.start {
                selectedMonth = startOfMonth(for: Date())
            } else if history?.days.isEmpty == false {
                let available = monthlyPoints(from: loadedHistory.days)
                selectedMonth = available.last?.month ?? startOfMonth(for: Date())
            }
            appState.isDataStale = loadedHistory.isStale
            errorMessage = nil
        } catch {
            if let apiError = error as? APIError, case .unauthorized = apiError {
                await appState.signOut()
            }
            errorMessage = (error as? APIError)?.localizedDescription ?? error.localizedDescription
        }
    }

    private func staleMessage(for history: AttendanceHistoryResponse) -> String {
        if history.isStale {
            let age = history.staleAgeHours ?? 0
            return "Data may be stale. Last source update ~\(formatTenths(age))h ago."
        }
        return "History is up to date."
    }

    private func formatHours(_ value: Double) -> String {
        String(format: "%.2f", value)
    }

    private func formatTenths(_ value: Double) -> String {
        String(format: "%.1f", value)
    }

    private func statsCard(for history: AttendanceHistoryResponse) -> some View {
        VStack(alignment: .leading, spacing: TT42Spacing.small) {
            TT42SectionHeader("Range Summary")
            row("Range", "\(history.fromDate) to \(history.toDate)")
            row("Days in range", "\(history.totalDays)")
            row("Total hours", "\(formatHours(history.totalHours)) h")
            row("Recorded days", "\(history.days.filter(\.hasRecord).count)")
        }
        .tt42CardStyle()
    }

    private func monthPicker(points: [MonthlyAttendancePoint]) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(points) { point in
                    let selected = Calendar.current.isDate(point.month, equalTo: selectedMonth, toGranularity: .month)
                    Button {
                        selectedMonth = point.month
                    } label: {
                        Text(Self.monthLabelFormatter.string(from: point.month))
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(selected ? Color.white : Color.primary)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(selected ? TT42Palette.magenta : TT42Palette.darkTrack.opacity(0.12))
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .tt42CardStyle()
    }

    private func row(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.semibold)
        }
        .font(.subheadline)
    }

    private func monthlyPoints(from days: [AttendanceHistoryDay]) -> [MonthlyAttendancePoint] {
        var totals: [Date: Double] = [:]

        for day in days {
            guard let date = day.dayDate else { continue }
            let monthStart = startOfMonth(for: date)
            totals[monthStart, default: 0] += day.hours
        }

        return totals
            .map { MonthlyAttendancePoint(month: $0.key, hours: $0.value) }
            .sorted { $0.month < $1.month }
    }

    private func startOfMonth(for date: Date) -> Date {
        Calendar.current.date(from: Calendar.current.dateComponents([.year, .month], from: date)) ?? date
    }

    private func filterToMonth(_ days: [AttendanceHistoryDay], month: Date) -> [AttendanceHistoryDay] {
        let calendar = Calendar.current
        return days.filter { day in
            guard let date = day.dayDate else { return false }
            return calendar.isDate(date, equalTo: month, toGranularity: .month)
        }
    }

    private func attendanceByDate(_ days: [AttendanceHistoryDay]) -> [Date: AttendanceCalendarDay] {
        let calendar = Calendar.current
        var map: [Date: AttendanceCalendarDay] = [:]

        for day in days {
            guard let date = day.dayDate else { continue }
            let start = calendar.startOfDay(for: date)
            map[start] = AttendanceCalendarDay(date: start, hours: day.hours, hasRecord: day.hasRecord)
        }
        return map
    }

    private func achievedWeekStarts(
        from days: [AttendanceHistoryDay],
        month: Date,
        weeklyGoal: Double
    ) -> Set<Date> {
        guard weeklyGoal > 0 else { return [] }

        let filtered = filterToMonth(days, month: month)
        let calendar = Calendar.current
        var totals: [Date: Double] = [:]

        for day in filtered {
            guard let date = day.dayDate else { continue }
            let start = calendar.dateInterval(of: .weekOfYear, for: date)?.start ?? date
            totals[start, default: 0] += day.hours
        }

        return Set(totals.filter { $0.value >= weeklyGoal }.map(\.key))
    }

    private func sixMonthRange() -> (start: Date, end: Date) {
        let now = Date()
        let currentMonthStart = startOfMonth(for: now)
        let start = Calendar.current.date(byAdding: .month, value: -5, to: currentMonthStart) ?? currentMonthStart
        let end = Calendar.current.date(byAdding: DateComponents(month: 1, day: -1), to: currentMonthStart) ?? now
        return (start, end)
    }

    private struct MonthlyAttendancePoint: Identifiable {
        let month: Date
        let hours: Double
        var id: Date { month }
    }

    private static let monthLabelFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM"
        return formatter
    }()
}

#Preview {
    AttendanceHistoryView()
}

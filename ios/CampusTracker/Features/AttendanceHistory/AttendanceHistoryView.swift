import Charts
import SwiftUI

struct AttendanceHistoryView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.scenePhase) private var scenePhase

    @State private var history: AttendanceHistoryResponse?
    @State private var selectedMonth: Date = Date()
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var lastAutoRefreshAt: Date?

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
                            let points = monthlyPoints(from: history.days)
                            let selectedMonthDays = filterToMonth(history.days, month: selectedMonth)

                            VStack(spacing: TT42Spacing.large) {
                                TT42SectionHeader(
                                    "Historic Attendance",
                                    subtitle: "Track monthly trends and day-by-day consistency"
                                )

                                StaleDataBanner(
                                    isStale: history.isStale,
                                    message: staleMessage(for: history)
                                )

                                if history.todayIsLive {
                                    Text("Today’s calendar entry includes live campus time and may change until the session closes.")
                                        .font(.footnote)
                                        .foregroundStyle(.primary)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .padding(.horizontal, TT42Spacing.small)
                                        .padding(.vertical, TT42Spacing.small)
                                        .background(TT42Palette.cyan.opacity(0.12))
                                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                }

                                VStack(alignment: .leading, spacing: TT42Spacing.small) {
                                    TT42SectionHeader("Monthly Totals", subtitle: "Last 6 months")

                                    Chart(points) { point in
                                        BarMark(
                                            x: .value("Month", point.month, unit: .month),
                                            y: .value("Hours", point.hours)
                                        )
                                        .foregroundStyle(
                                            LinearGradient(
                                                colors: [TT42Palette.cyan, TT42Palette.mint],
                                                startPoint: .bottom,
                                                endPoint: .top
                                            )
                                        )
                                        .cornerRadius(4)
                                    }
                                    .frame(height: 220)
                                }
                                .tt42CardStyle()

                                rangeSummaryCard(points: points)

                                monthPicker(points: points)

                                AttendanceMonthCalendarView(
                                    month: selectedMonth,
                                    dailyGoal: currentDailyGoal,
                                    weekGoalAchievements: achievedWeekStarts(
                                        from: history.days,
                                        month: selectedMonth,
                                        weeklyGoal: currentWeeklyGoal
                                    ),
                                    entriesByDate: attendanceByDate(selectedMonthDays)
                                )

                                monthSummaryCard(days: selectedMonthDays)
                            }
                            .padding(TT42Spacing.medium)
                        }
                        .refreshable {
                            await refreshHistory(forceSync: true)
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
                        Task { await refreshHistory(forceSync: true) }
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
            .onChange(of: scenePhase) { _, newPhase in
                guard newPhase == .active, shouldAutoRefresh else { return }
                Task { await refreshHistory() }
            }
            .alert("History Error", isPresented: errorAlertBinding) {
                Button("OK") { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private var shouldAutoRefresh: Bool {
        guard appState.isAuthenticated, !isLoading else { return false }
        guard let lastAutoRefreshAt else { return true }
        return Date().timeIntervalSince(lastAutoRefreshAt) > 90
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

    private func refreshHistory(forceSync: Bool = false) async {
        isLoading = true
        defer { isLoading = false }

        let range = sixMonthRange()

        do {
            let accessToken = try await appState.validAccessToken()
            if forceSync {
                try? await appState.apiClient.triggerManualSync(accessToken: accessToken, force: true)
            }
            _ = try? await appState.refreshGoalSettings()

            let loadedHistory = try await appState.apiClient.getAttendanceHistory(
                accessToken: accessToken,
                from: range.start,
                to: range.end
            )

            history = loadedHistory
            let available = monthlyPoints(from: loadedHistory.days)
            let normalizedSelection = startOfMonth(for: selectedMonth)
            let availableMonths = Set(available.map(\.month))
            if availableMonths.contains(normalizedSelection) {
                selectedMonth = normalizedSelection
            } else if let last = available.last {
                selectedMonth = last.month
            } else {
                selectedMonth = startOfMonth(for: Date())
            }
            appState.isDataStale = loadedHistory.isStale
            lastAutoRefreshAt = Date()
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

    private func formatTenths(_ value: Double) -> String {
        String(format: "%.1f", value)
    }

    private func rangeSummaryCard(points: [MonthlyAttendancePoint]) -> some View {
        let totalHours = points.reduce(0) { $0 + $1.hours }
        let avgHours = points.isEmpty ? 0 : totalHours / Double(points.count)
        let best = points.max(by: { $0.hours < $1.hours })
        let firstMonth = points.first?.month
        let lastMonth = points.last?.month

        return VStack(alignment: .leading, spacing: TT42Spacing.small) {
            TT42SectionHeader("Range Summary")
            if points.isEmpty {
                row("Range", "No monthly data")
            } else {
                row(
                    "Range",
                    "\(formattedMonth(firstMonth)) - \(formattedMonth(lastMonth))"
                )
            }
            row("Total time", TimeFormatters.hoursToReadable(totalHours))
            row("Average / month", TimeFormatters.hoursToReadable(avgHours))
            if let best {
                row(
                    "Best month",
                    "\(formattedMonth(best.month)) • \(TimeFormatters.hoursToReadable(best.hours))"
                )
            }
        }
        .tt42CardStyle()
    }

    private func monthSummaryCard(days: [AttendanceHistoryDay]) -> some View {
        let totalHours = days.reduce(0) { $0 + $1.hours }
        let recordedDays = days.filter(\.hasRecord).count
        let achievedDays = days.filter { $0.hours >= currentDailyGoal && currentDailyGoal > 0 }.count
        let weekHits = achievedWeekStarts(from: days, month: selectedMonth, weeklyGoal: currentWeeklyGoal).count

        return VStack(alignment: .leading, spacing: TT42Spacing.small) {
            TT42SectionHeader("Month Summary")
            row("Month", formattedMonth(selectedMonth))
            row("Total time", TimeFormatters.hoursToReadable(totalHours))
            row("Recorded days", "\(recordedDays)")
            row("Goal-achieved days", "\(achievedDays)")
            row("Weekly goals hit", "\(weekHits)")
        }
        .tt42CardStyle()
    }

    private var currentDailyGoal: Double {
        appState.goalSettings?.dailyGoalHours ?? 0
    }

    private var currentWeeklyGoal: Double {
        appState.goalSettings?.weeklyGoalHours ?? 0
    }

    private func monthPicker(points: [MonthlyAttendancePoint]) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(points) { point in
                    let selected = Calendar.current.isDate(point.month, equalTo: selectedMonth, toGranularity: .month)
                    Button {
                        selectedMonth = point.month
                    } label: {
                        Text(Self.monthShortFormatter.string(from: point.month))
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(selected ? Color.white : Color.primary)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(selected ? TT42Palette.primaryTint : TT42Palette.darkTrack.opacity(0.12))
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

    private func formattedMonth(_ date: Date?) -> String {
        guard let date else { return "-" }
        return Self.monthLongFormatter.string(from: date)
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

    private static let monthShortFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM"
        return formatter
    }()

    private static let monthLongFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "LLLL yyyy"
        return formatter
    }()
}

#Preview {
    AttendanceHistoryView()
}

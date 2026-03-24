import SwiftUI

struct DashboardView: View {
    @Environment(AppState.self) private var appState
    @State private var summary: DashboardSummary?
    @State private var currentMonthHistory: AttendanceHistoryResponse?
    @State private var isLoading = false
    @State private var isSyncing = false
    @State private var errorMessage: String?

    @AppStorage("ui_daily_goal_hours") private var localDailyGoalHours = 6.0
    @AppStorage("ui_weekly_goal_hours") private var localWeeklyGoalHours = 22.5
    @AppStorage("ui_monthly_goal_hours") private var localMonthlyGoalHours = 90.0
    @AppStorage("ui_pace_weekdays_only") private var useWeekdaysOnlyPace = false
    @AppStorage("ui_days_attended_per_week") private var daysAttendedPerWeek = 5

    var body: some View {
        NavigationStack {
            ZStack {
                TT42ScreenBackground()

                Group {
                    if isLoading && summary == nil {
                        ProgressView("Loading dashboard...")
                    } else if let errorMessage, summary == nil {
                        ContentUnavailableView(
                            "Unable to Load Dashboard",
                            systemImage: "wifi.exclamationmark",
                            description: Text(errorMessage)
                        )
                    } else if let summary {
                        ScrollView {
                            VStack(spacing: TT42Spacing.large) {
                                TT42SectionHeader(
                                    "Activity",
                                    subtitle: "Outer ring month • middle week • inner day"
                                )

                                StaleDataBanner(
                                    isStale: summary.isStale,
                                    message: staleMessage(for: summary)
                                )

                                ConcentricActivityRingsView(
                                    metrics: [
                                        RingMetric(
                                            title: "Month",
                                            valueHours: summary.hoursMonth,
                                            goalHours: summary.monthlyGoalHours,
                                            tint: TT42Palette.magenta
                                        ),
                                        RingMetric(
                                            title: "Week",
                                            valueHours: summary.hoursWeek,
                                            goalHours: summary.weeklyGoalHours,
                                            tint: TT42Palette.mint
                                        ),
                                        RingMetric(
                                            title: "Day",
                                            valueHours: summary.hoursToday,
                                            goalHours: summary.dailyGoalHours,
                                            tint: TT42Palette.teal
                                        ),
                                    ]
                                )

                                metricGrid(summary: summary)

                                TT42SectionHeader(
                                    "Monthly Attendance Calendar",
                                    subtitle: "Daily goal achievement + weekly goal highlights"
                                )

                                if let currentMonthHistory {
                                    AttendanceMonthCalendarView(
                                        month: Date(),
                                        dailyGoal: summary.dailyGoalHours,
                                        weekGoalAchievements: achievedWeekStarts(
                                            in: currentMonthHistory,
                                            weeklyGoal: summary.weeklyGoalHours
                                        ),
                                        entriesByDate: attendanceByDate(from: currentMonthHistory.days)
                                    )
                                } else {
                                    ProgressView("Loading monthly calendar...")
                                        .frame(maxWidth: .infinity)
                                        .tt42CardStyle()
                                }

                                plannerPreviewCard(summary: summary)
                            }
                            .padding(TT42Spacing.medium)
                        }
                    } else {
                        ContentUnavailableView("No dashboard data", systemImage: "chart.xyaxis.line")
                    }
                }
            }
            .navigationTitle("Main")
            .toolbar {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button {
                        Task { await refresh() }
                    } label: {
                        if isLoading {
                            ProgressView()
                        } else {
                            Image(systemName: "arrow.clockwise")
                        }
                    }
                    .disabled(isLoading || isSyncing)

                    Button("Sync") {
                        Task { await manualSync() }
                    }
                    .disabled(isLoading || isSyncing)
                }
            }
            .task(id: appState.accessToken) {
                await refresh()
            }
            .alert("Dashboard Error", isPresented: errorAlertBinding) {
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

    private func refresh() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let accessToken = try await appState.validAccessToken()
            let loadedSummary = try await appState.apiClient.getDashboardSummary(
                accessToken: accessToken
            )
            summary = loadedSummary
            appState.isDataStale = loadedSummary.isStale

            let monthRange = currentMonthRange()
            currentMonthHistory = try? await appState.apiClient.getAttendanceHistory(
                accessToken: accessToken,
                from: monthRange.start,
                to: monthRange.end
            )
            errorMessage = nil
        } catch {
            if let apiError = error as? APIError, case .unauthorized = apiError {
                await appState.signOut()
            }
            errorMessage = (error as? APIError)?.localizedDescription ?? error.localizedDescription
        }
    }

    private func manualSync() async {
        isSyncing = true
        defer { isSyncing = false }

        do {
            let accessToken = try await appState.validAccessToken()
            try await appState.apiClient.triggerManualSync(accessToken: accessToken)
            await refresh()
        } catch {
            if let apiError = error as? APIError, case .unauthorized = apiError {
                await appState.signOut()
            }
            errorMessage = (error as? APIError)?.localizedDescription ?? error.localizedDescription
        }
    }

    private func staleMessage(for summary: DashboardSummary) -> String {
        if summary.isStale {
            let age = summary.staleAgeHours ?? 0
            return "Data may be stale. Last source update ~\(formatTenths(age))h ago."
        }
        return "Data is fresh."
    }

    private func formatHours(_ value: Double) -> String {
        String(format: "%.2f", value)
    }

    private func formatTenths(_ value: Double) -> String {
        String(format: "%.1f", value)
    }

    private func metricGrid(summary: DashboardSummary) -> some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: TT42Spacing.small) {
            TT42MetricCard(
                title: "Today",
                value: "\(formatHours(summary.hoursToday)) h",
                subtitle: "Goal \(formatHours(summary.dailyGoalHours)) h",
                tint: TT42Palette.teal
            )
            TT42MetricCard(
                title: "This Week",
                value: "\(formatHours(summary.hoursWeek)) h",
                subtitle: "Goal \(formatHours(summary.weeklyGoalHours)) h",
                tint: TT42Palette.mint
            )
            TT42MetricCard(
                title: "This Month",
                value: "\(formatHours(summary.hoursMonth)) h",
                subtitle: "\(formatHours(summary.hoursLeftToMonthlyGoal)) h left",
                tint: TT42Palette.magenta
            )
            TT42MetricCard(
                title: "Required Pace",
                value: "\(formatHours(summary.requiredHoursPerRemainingDay)) h/day",
                subtitle: "\(formatHours(summary.requiredHoursPerRemainingWeekday)) h/weekday",
                tint: TT42Palette.darkTrack
            )
            TT42MetricCard(
                title: "Week Delta",
                value: deltaHoursLabel(summary.weekVsPreviousWeekHours),
                subtitle: "vs previous week",
                tint: TT42Palette.teal
            )
            TT42MetricCard(
                title: "Month Delta",
                value: deltaHoursLabel(summary.monthVsPreviousMonthHours),
                subtitle: "vs previous month",
                tint: TT42Palette.mint
            )
        }
    }

    private func plannerPreviewCard(summary: DashboardSummary) -> some View {
        let monthDays = max(daysInCurrentMonth(), 1)
        let weekdayDays = max(weekdaysInCurrentMonth(), 1)
        let selectedDays = useWeekdaysOnlyPace ? weekdayDays : monthDays
        let recommendedDaily = localMonthlyGoalHours / Double(selectedDays)
        let recommendedWeekly = recommendedDaily * Double(max(daysAttendedPerWeek, 1))

        return VStack(alignment: .leading, spacing: TT42Spacing.small) {
            TT42SectionHeader(
                "Settings Impact Preview",
                subtitle: "How your local planning settings change pacing"
            )

            Text("Mode: \(useWeekdaysOnlyPace ? "Weekdays only" : "All days")")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text("Configured goals: \(formatHours(localDailyGoalHours)) / \(formatHours(localWeeklyGoalHours)) / \(formatHours(localMonthlyGoalHours)) h")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Divider()

            metricRow("Recommended day target", "\(formatHours(recommendedDaily)) h")
            metricRow("Recommended week target", "\(formatHours(recommendedWeekly)) h")
            metricRow("Current backend month progress", "\(formatHours(summary.hoursMonth)) h")
        }
        .tt42CardStyle()
    }

    private func metricRow(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.semibold)
        }
        .font(.subheadline)
    }

    private func deltaHoursLabel(_ hours: Double) -> String {
        let sign = hours >= 0 ? "+" : "-"
        return "\(sign)\(formatHours(abs(hours))) h"
    }

    private func attendanceByDate(from days: [AttendanceHistoryDay]) -> [Date: AttendanceCalendarDay] {
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
        in history: AttendanceHistoryResponse,
        weeklyGoal: Double
    ) -> Set<Date> {
        guard weeklyGoal > 0 else { return [] }

        let calendar = Calendar.current
        var totals: [Date: Double] = [:]

        for day in history.days {
            guard let date = day.dayDate else { continue }
            let weekStart = calendar.dateInterval(of: .weekOfYear, for: date)?.start ?? date
            totals[weekStart, default: 0] += day.hours
        }

        return Set(totals.filter { $0.value >= weeklyGoal }.map(\.key))
    }

    private func currentMonthRange() -> (start: Date, end: Date) {
        let calendar = Calendar.current
        let now = Date()
        let start = calendar.date(from: calendar.dateComponents([.year, .month], from: now)) ?? now
        let end = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: start) ?? now
        return (start, end)
    }

    private func daysInCurrentMonth() -> Int {
        let calendar = Calendar.current
        let now = Date()
        let start = calendar.date(from: calendar.dateComponents([.year, .month], from: now)) ?? now
        return calendar.range(of: .day, in: .month, for: start)?.count ?? 30
    }

    private func weekdaysInCurrentMonth() -> Int {
        let calendar = Calendar.current
        let range = currentMonthRange()
        var count = 0
        var day = range.start

        while day <= range.end {
            if !calendar.isDateInWeekend(day) {
                count += 1
            }
            guard let next = calendar.date(byAdding: .day, value: 1, to: day), next > day else {
                break
            }
            day = next
        }
        return max(count, 1)
    }
}

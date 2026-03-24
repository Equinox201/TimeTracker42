import SwiftUI

struct DashboardView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.scenePhase) private var scenePhase

    @State private var summary: DashboardSummary?
    @State private var currentMonthHistory: AttendanceHistoryResponse?
    @State private var isLoading = false
    @State private var isSyncing = false
    @State private var errorMessage: String?
    @State private var lastAutoRefreshAt: Date?
    @State private var refreshRequestID = 0

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
                                            goalHours: displayedMonthlyGoal(fallback: summary.monthlyGoalHours),
                                            tint: TT42Palette.magenta
                                        ),
                                        RingMetric(
                                            title: "Week",
                                            valueHours: summary.hoursWeek,
                                            goalHours: displayedWeeklyGoal(fallback: summary.weeklyGoalHours),
                                            tint: TT42Palette.mint
                                        ),
                                        RingMetric(
                                            title: "Day",
                                            valueHours: summary.hoursToday,
                                            goalHours: displayedDailyGoal(fallback: summary.dailyGoalHours),
                                            tint: TT42Palette.cyan
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
                                        dailyGoal: displayedDailyGoal(fallback: summary.dailyGoalHours),
                                        weekGoalAchievements: achievedWeekStarts(
                                            in: currentMonthHistory,
                                            weeklyGoal: displayedWeeklyGoal(fallback: summary.weeklyGoalHours)
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
                        .refreshable {
                            await performRefresh(trigger: .pullToRefresh, forceSync: true)
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
                        Task { await performRefresh(trigger: .toolbarRefresh, forceSync: true) }
                    } label: {
                        if isLoading {
                            ProgressView()
                        } else {
                            Image(systemName: "arrow.clockwise")
                        }
                    }
                    .disabled(isLoading || isSyncing)

                    Button("Sync") {
                        Task { await performRefresh(trigger: .syncButton, forceSync: true) }
                    }
                    .disabled(isLoading || isSyncing)
                }
            }
            .task(id: appState.accessToken) {
                await performRefresh(trigger: .initialLoad, forceSync: false)
            }
            .onChange(of: scenePhase) { _, newPhase in
                guard newPhase == .active, shouldAutoRefresh else { return }
                Task { await performRefresh(trigger: .foregroundAuto, forceSync: false) }
            }
            .alert("Dashboard Error", isPresented: errorAlertBinding) {
                Button("OK") { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private var shouldAutoRefresh: Bool {
        guard appState.isAuthenticated, !isLoading, !isSyncing else { return false }
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

    private func loadDashboardData(accessToken: String, requestID: Int) async throws {
        let loadedSummary = try await appState.apiClient.getDashboardSummary(accessToken: accessToken)
        guard isCurrentRequest(requestID) else { return }
        summary = loadedSummary
        appState.isDataStale = loadedSummary.isStale

        let monthRange = currentMonthRange()
        let loadedHistory = try? await appState.apiClient.getAttendanceHistory(
            accessToken: accessToken,
            from: monthRange.start,
            to: monthRange.end
        )
        guard isCurrentRequest(requestID) else { return }
        if let loadedHistory {
            currentMonthHistory = loadedHistory
        }
    }

    private func staleMessage(for summary: DashboardSummary) -> String {
        if summary.isStale {
            let age = summary.staleAgeHours ?? 0
            return "Data may be stale. Last source update ~\(formatTenths(age))h ago."
        }
        return "Data is fresh."
    }

    private func formatTenths(_ value: Double) -> String {
        String(format: "%.1f", value)
    }

    private func metricGrid(summary: DashboardSummary) -> some View {
        let dailyGoal = displayedDailyGoal(fallback: summary.dailyGoalHours)
        let weeklyGoal = displayedWeeklyGoal(fallback: summary.weeklyGoalHours)
        let monthlyGoal = displayedMonthlyGoal(fallback: summary.monthlyGoalHours)
        let remaining = remainingDaysInfo()
        let paceValue = useWeekdaysOnlyPace
            ? summary.requiredHoursPerRemainingWeekday
            : summary.requiredHoursPerRemainingDay

        return LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: TT42Spacing.small) {
            TT42MetricCard(
                title: "Today",
                value: TimeFormatters.hoursToReadable(summary.hoursToday),
                subtitle: "Goal \(TimeFormatters.hoursToReadable(dailyGoal))",
                tint: TT42Palette.cyan
            )
            TT42MetricCard(
                title: "This Week",
                value: TimeFormatters.hoursToReadable(summary.hoursWeek),
                subtitle: "Goal \(TimeFormatters.hoursToReadable(weeklyGoal))",
                tint: TT42Palette.mint
            )
            TT42MetricCard(
                title: "This Month",
                value: TimeFormatters.hoursToReadable(summary.hoursMonth),
                subtitle: "\(TimeFormatters.hoursToReadable(max(monthlyGoal - summary.hoursMonth, 0))) left",
                tint: TT42Palette.magenta
            )
            TT42MetricCard(
                title: "Required Pace",
                value: "\(TimeFormatters.hoursToReadable(paceValue))/day",
                subtitle: useWeekdaysOnlyPace ? "Using weekdays mode" : "Using all days mode",
                tint: TT42Palette.darkTrack
            )
            TT42MetricCard(
                title: "Days Left",
                value: "\(remaining.effective)",
                subtitle: "Calendar \(remaining.calendar) • Weekdays \(remaining.weekdays)",
                tint: TT42Palette.teal
            )
            TT42MetricCard(
                title: "Week Delta",
                value: TimeFormatters.deltaHoursReadable(summary.weekVsPreviousWeekHours),
                subtitle: "vs previous week",
                tint: TT42Palette.cyan
            )
            TT42MetricCard(
                title: "Month Delta",
                value: TimeFormatters.deltaHoursReadable(summary.monthVsPreviousMonthHours),
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
        let remaining = remainingDaysInfo()

        return VStack(alignment: .leading, spacing: TT42Spacing.small) {
            TT42SectionHeader(
                "Settings Impact Preview",
                subtitle: "Saved settings currently applied"
            )

            Text("Mode: \(useWeekdaysOnlyPace ? "Weekdays only" : "All days")")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text("Configured goals: \(TimeFormatters.hoursToReadable(localDailyGoalHours)) / \(TimeFormatters.hoursToReadable(localWeeklyGoalHours)) / \(TimeFormatters.hoursToReadable(localMonthlyGoalHours))")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Divider()

            metricRow("Remaining target days", "\(remaining.effective)")
            metricRow("Recommended day target", TimeFormatters.hoursToReadable(recommendedDaily))
            metricRow("Recommended week target", TimeFormatters.hoursToReadable(recommendedWeekly))
            metricRow("Current month progress", TimeFormatters.hoursToReadable(summary.hoursMonth))
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

    private func displayedDailyGoal(fallback: Double) -> Double {
        localDailyGoalHours > 0 ? localDailyGoalHours : fallback
    }

    private func displayedWeeklyGoal(fallback: Double) -> Double {
        localWeeklyGoalHours > 0 ? localWeeklyGoalHours : fallback
    }

    private func displayedMonthlyGoal(fallback: Double) -> Double {
        localMonthlyGoalHours > 0 ? localMonthlyGoalHours : fallback
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

    private func remainingDaysInfo() -> (calendar: Int, weekdays: Int, effective: Int) {
        let calendar = Calendar.current
        let range = currentMonthRange()
        let today = calendar.startOfDay(for: Date())
        let start = max(today, range.start)

        var calendarLeft = 0
        var weekdaysLeft = 0
        var day = start

        while day <= range.end {
            calendarLeft += 1
            if !calendar.isDateInWeekend(day) {
                weekdaysLeft += 1
            }
            guard let next = calendar.date(byAdding: .day, value: 1, to: day), next > day else {
                break
            }
            day = next
        }

        let effective = useWeekdaysOnlyPace ? weekdaysLeft : calendarLeft
        return (calendarLeft, weekdaysLeft, effective)
    }

    private enum RefreshTrigger {
        case initialLoad
        case pullToRefresh
        case toolbarRefresh
        case syncButton
        case foregroundAuto
    }

    private func performRefresh(trigger: RefreshTrigger, forceSync: Bool) async {
        guard !isLoading && !isSyncing else { return }

        let requestID = beginRefresh(trigger: trigger)
        defer { finishRefresh(trigger: trigger, requestID: requestID) }

        do {
            let accessToken = try await appState.validAccessToken()
            var syncError: Error?

            if forceSync {
                do {
                    try await appState.apiClient.triggerManualSync(accessToken: accessToken, force: true)
                } catch {
                    if isCancellation(error) { return }
                    syncError = error
                }
            }

            do {
                try await loadDashboardData(accessToken: accessToken, requestID: requestID)
                guard isCurrentRequest(requestID) else { return }
                lastAutoRefreshAt = Date()
                errorMessage = nil
            } catch {
                guard isCurrentRequest(requestID) else { return }
                if isCancellation(error) { return }
                if let apiError = error as? APIError, case .unauthorized = apiError {
                    await appState.signOut()
                }
                errorMessage = (error as? APIError)?.localizedDescription ?? error.localizedDescription
                return
            }

            if let syncError, summary == nil {
                guard isCurrentRequest(requestID) else { return }
                if isCancellation(syncError) { return }
                if let apiError = syncError as? APIError, case .unauthorized = apiError {
                    await appState.signOut()
                }
                errorMessage = (syncError as? APIError)?.localizedDescription ?? syncError.localizedDescription
            }
        } catch {
            guard isCurrentRequest(requestID) else { return }
            if isCancellation(error) { return }
            if let apiError = error as? APIError, case .unauthorized = apiError {
                await appState.signOut()
            }
            errorMessage = (error as? APIError)?.localizedDescription ?? error.localizedDescription
        }
    }

    private func isCancellation(_ error: Error) -> Bool {
        if error is CancellationError { return true }

        if let urlError = error as? URLError, urlError.code == .cancelled {
            return true
        }

        if let apiError = error as? APIError {
            if case .network(let underlying) = apiError {
                return isCancellation(underlying)
            }
            return false
        }

        let nsError = error as NSError
        return nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled
    }

    private func beginRefresh(trigger: RefreshTrigger) -> Int {
        refreshRequestID += 1
        let requestID = refreshRequestID
        errorMessage = nil

        if trigger == .syncButton {
            isSyncing = true
        } else {
            isLoading = true
        }
        return requestID
    }

    private func finishRefresh(trigger: RefreshTrigger, requestID: Int) {
        guard isCurrentRequest(requestID) else { return }
        if trigger == .syncButton {
            isSyncing = false
        } else {
            isLoading = false
        }
    }

    private func isCurrentRequest(_ requestID: Int) -> Bool {
        requestID == refreshRequestID
    }
}

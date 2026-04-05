import SwiftUI

struct SettingsView: View {
    @Environment(AppState.self) private var appState

    @AppStorage("ui_theme_mode") private var persistedThemeModeRaw = TT42ThemeMode.system.rawValue

    @State private var draftThemeMode: TT42ThemeMode = .system
    @State private var draftDailyGoalHours = 6.0
    @State private var draftWeeklyGoalHours = 22.5
    @State private var draftMonthlyGoalHours = 90.0
    @State private var draftUseWeekdaysOnly = false
    @State private var draftDaysAttendedPerWeek = 5
    @State private var goalInputMode: GoalInputMode = .monthly
    @State private var didLoadDrafts = false
    @State private var showSavedBadge = false
    @State private var isLoadingGoals = false
    @State private var isSavingGoals = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ZStack {
                TT42ScreenBackground()

                ScrollView {
                    VStack(spacing: TT42Spacing.large) {
                        TT42SectionHeader(
                            "Settings",
                            subtitle: "Adjust appearance and pacing strategy"
                        )

                        accountCard
                        appearanceCard
                        goalsCard
                        paceCard
                        impactCard

                        Button {
                            Task { await saveDrafts() }
                        } label: {
                            HStack {
                                Image(systemName: "checkmark.circle.fill")
                                Text(isSavingGoals ? "Saving..." : hasUnsavedChanges ? "Save Settings" : "Settings Saved")
                                    .fontWeight(.semibold)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(hasUnsavedChanges ? TT42Palette.primaryTint.opacity(0.22) : TT42Palette.darkTrack.opacity(0.14))
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .disabled(!hasUnsavedChanges || isSavingGoals || isLoadingGoals)

                        if showSavedBadge {
                            Text("Saved. Main and Historic pages now use these targets.")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }

                        if let errorMessage {
                            Text(errorMessage)
                                .font(.footnote)
                                .foregroundStyle(TT42Palette.magenta)
                        }

                        Button("Sign Out", role: .destructive) {
                            Task { await appState.signOut() }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(TT42Palette.magenta.opacity(0.14))
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .padding(TT42Spacing.medium)
                }
            }
            .navigationTitle("Settings")
        }
        .onAppear {
            if !didLoadDrafts {
                Task { await loadDraftsFromBackend() }
                didLoadDrafts = true
            }
        }
    }

    private var accountCard: some View {
        VStack(alignment: .leading, spacing: TT42Spacing.small) {
            TT42SectionHeader("User Data")
            row("Login", appState.userLogin.isEmpty ? "Unknown" : appState.userLogin)
            row("Backend", appState.backendBaseURL)
            row("Data status", appState.isDataStale ? "Stale (showing cached/fetched data)" : "Fresh")
        }
        .tt42CardStyle()
    }

    private var appearanceCard: some View {
        VStack(alignment: .leading, spacing: TT42Spacing.small) {
            TT42SectionHeader("Appearance")
            Picker("Theme", selection: $draftThemeMode) {
                ForEach(TT42ThemeMode.allCases) { mode in
                    Text(mode.title).tag(mode)
                }
            }
            .pickerStyle(.segmented)
        }
        .tt42CardStyle()
    }

    private var goalsCard: some View {
        VStack(alignment: .leading, spacing: TT42Spacing.small) {
            TT42SectionHeader("Goals")

            goalStepper(
                title: "Day Goal",
                value: Binding(
                    get: { draftDailyGoalHours },
                    set: { applyDerivedDraft(inputMode: .daily, inputGoalHours: $0) }
                ),
                range: 0...24,
                step: 0.5
            )

            goalStepper(
                title: "Week Goal",
                value: Binding(
                    get: { draftWeeklyGoalHours },
                    set: { applyDerivedDraft(inputMode: .weekly, inputGoalHours: $0) }
                ),
                range: 0...120,
                step: 0.5
            )

            goalStepper(
                title: "Month Goal",
                value: Binding(
                    get: { draftMonthlyGoalHours },
                    set: { applyDerivedDraft(inputMode: .monthly, inputGoalHours: $0) }
                ),
                range: 0...300,
                step: 1
            )
        }
        .tt42CardStyle()
    }

    private var paceCard: some View {
        VStack(alignment: .leading, spacing: TT42Spacing.small) {
            TT42SectionHeader("Pacing Rules")

            Toggle(
                "Use weekdays only for remaining pace",
                isOn: Binding(
                    get: { draftUseWeekdaysOnly },
                    set: { newValue in
                        applyDerivedDraft(
                            inputMode: goalInputMode,
                            inputGoalHours: currentGoalInputHours,
                            paceMode: newValue ? .weekdays : .calendarDays,
                            daysPerWeek: draftDaysAttendedPerWeek
                        )
                    }
                )
            )

            Stepper(
                value: Binding(
                    get: { draftDaysAttendedPerWeek },
                    set: { newValue in
                        applyDerivedDraft(
                            inputMode: goalInputMode,
                            inputGoalHours: currentGoalInputHours,
                            paceMode: currentPaceMode,
                            daysPerWeek: newValue
                        )
                    }
                ),
                in: 1...7
            ) {
                HStack {
                    Text("Days attended per week")
                    Spacer()
                    Text("\(draftDaysAttendedPerWeek)")
                        .fontWeight(.semibold)
                }
            }
        }
        .tt42CardStyle()
    }

    private var impactCard: some View {
        let selectedDays = GoalMath.activeDaysInMonth(for: Date(), paceMode: currentPaceMode)
        let recommendation = GoalMath.buildRecommendedPace(
            monthlyGoalHours: draftMonthlyGoalHours,
            monthlyHoursSoFar: 0,
            paceMode: currentPaceMode,
            daysPerWeek: draftDaysAttendedPerWeek,
            from: Date()
        )

        return VStack(alignment: .leading, spacing: TT42Spacing.small) {
            TT42SectionHeader("How Settings Recalculate Targets")

            Text("Mode uses \(selectedDays) day(s) in this month.")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            row("Remaining target", TimeFormatters.hoursToReadable(recommendation.remainingHours))
            row("Recommended daily pace", TimeFormatters.hoursToReadable(recommendation.dailyHours))
            row("Recommended weekly pace", TimeFormatters.hoursToReadable(recommendation.weeklyHours))
            row("Configured day goal", TimeFormatters.hoursToReadable(draftDailyGoalHours))
            row("Configured week goal", TimeFormatters.hoursToReadable(draftWeeklyGoalHours))
            row("Configured month goal", TimeFormatters.hoursToReadable(draftMonthlyGoalHours))
            row("Edited field", goalInputMode.rawValue.capitalized)
        }
        .tt42CardStyle()
    }

    private var hasUnsavedChanges: Bool {
        guard let saved = appState.goalSettings else {
            return false
        }

        return draftThemeMode.rawValue != persistedThemeModeRaw
            || abs(draftDailyGoalHours - saved.dailyGoalHours) > 0.0001
            || abs(draftWeeklyGoalHours - saved.weeklyGoalHours) > 0.0001
            || abs(draftMonthlyGoalHours - saved.monthlyGoalHours) > 0.0001
            || draftUseWeekdaysOnly != (saved.paceMode == .weekdays)
            || draftDaysAttendedPerWeek != saved.daysPerWeek
    }

    private func saveDrafts() async {
        persistedThemeModeRaw = draftThemeMode.rawValue
        isSavingGoals = true
        defer { isSavingGoals = false }

        do {
            let request = GoalSettingsUpdateRequest(
                inputMode: goalInputMode,
                inputGoalSeconds: max(Int(round(currentGoalInputHours * 3600)), 0),
                paceMode: currentPaceMode,
                daysPerWeek: draftDaysAttendedPerWeek,
                effectiveFrom: Self.dayFormatter.string(from: startOfCurrentMonth)
            )
            let saved = try await appState.saveGoalSettings(request: request)
            applyLoadedGoals(saved)
            errorMessage = nil
        } catch {
            if let apiError = error as? APIError, case .unauthorized = apiError {
                await appState.signOut()
            }
            errorMessage = (error as? APIError)?.localizedDescription ?? error.localizedDescription
            return
        }

        showSavedBadge = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            showSavedBadge = false
        }
    }

    private func loadDraftsFromPersisted() {
        draftThemeMode = TT42ThemeMode(rawValue: persistedThemeModeRaw) ?? .system
    }

    private func loadDraftsFromBackend() async {
        loadDraftsFromPersisted()
        isLoadingGoals = true
        defer { isLoadingGoals = false }

        do {
            let goals = if let existing = appState.goalSettings {
                existing
            } else {
                try await appState.refreshGoalSettings()
            }
            applyLoadedGoals(goals)
            errorMessage = nil
        } catch {
            if let apiError = error as? APIError, case .unauthorized = apiError {
                await appState.signOut()
            }
            errorMessage = (error as? APIError)?.localizedDescription ?? error.localizedDescription
        }
    }

    private func applyLoadedGoals(_ goals: GoalSettings) {
        draftDailyGoalHours = GoalMath.normalizeHours(goals.dailyGoalHours)
        draftWeeklyGoalHours = GoalMath.normalizeHours(goals.weeklyGoalHours)
        draftMonthlyGoalHours = GoalMath.normalizeHours(goals.monthlyGoalHours)
        draftUseWeekdaysOnly = goals.paceMode == .weekdays
        draftDaysAttendedPerWeek = goals.daysPerWeek
        goalInputMode = .monthly
    }

    private func applyDerivedDraft(
        inputMode: GoalInputMode,
        inputGoalHours: Double,
        paceMode: GoalPaceMode? = nil,
        daysPerWeek: Int? = nil
    ) {
        let draft = GoalMath.deriveDraft(
            inputMode: inputMode,
            inputGoalHours: inputGoalHours,
            paceMode: paceMode ?? currentPaceMode,
            daysPerWeek: daysPerWeek ?? draftDaysAttendedPerWeek,
            effectiveFrom: startOfCurrentMonth
        )

        goalInputMode = inputMode
        draftDailyGoalHours = draft.dailyGoalHours
        draftWeeklyGoalHours = draft.weeklyGoalHours
        draftMonthlyGoalHours = draft.monthlyGoalHours
        draftUseWeekdaysOnly = draft.paceMode == .weekdays
        draftDaysAttendedPerWeek = draft.daysPerWeek
    }

    private func goalStepper(
        title: String,
        value: Binding<Double>,
        range: ClosedRange<Double>,
        step: Double
    ) -> some View {
        Stepper(value: value, in: range, step: step) {
            HStack {
                Text(title)
                Spacer()
                Text(TimeFormatters.hoursToReadable(value.wrappedValue))
                    .fontWeight(.semibold)
            }
        }
    }

    private func row(_ title: String, _ value: String) -> some View {
        HStack(alignment: .top) {
            Text(title)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.semibold)
                .multilineTextAlignment(.trailing)
        }
        .font(.subheadline)
    }

    private var currentGoalInputHours: Double {
        switch goalInputMode {
        case .daily:
            return draftDailyGoalHours
        case .weekly:
            return draftWeeklyGoalHours
        case .monthly:
            return draftMonthlyGoalHours
        }
    }

    private var currentPaceMode: GoalPaceMode {
        draftUseWeekdaysOnly ? .weekdays : .calendarDays
    }

    private var startOfCurrentMonth: Date {
        let calendar = Calendar.current
        return calendar.date(from: calendar.dateComponents([.year, .month], from: Date())) ?? Date()
    }
}

private extension SettingsView {
    static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}

#Preview {
    SettingsView()
}

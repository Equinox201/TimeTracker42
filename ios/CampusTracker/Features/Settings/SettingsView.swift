import SwiftUI

struct SettingsView: View {
    @Environment(AppState.self) private var appState

    @AppStorage("ui_theme_mode") private var persistedThemeModeRaw = TT42ThemeMode.system.rawValue
    @AppStorage("ui_daily_goal_hours") private var persistedDailyGoalHours = 6.0
    @AppStorage("ui_weekly_goal_hours") private var persistedWeeklyGoalHours = 22.5
    @AppStorage("ui_monthly_goal_hours") private var persistedMonthlyGoalHours = 90.0
    @AppStorage("ui_pace_weekdays_only") private var persistedUseWeekdaysOnly = false
    @AppStorage("ui_days_attended_per_week") private var persistedDaysAttendedPerWeek = 5

    @State private var draftThemeMode: TT42ThemeMode = .system
    @State private var draftDailyGoalHours = 6.0
    @State private var draftWeeklyGoalHours = 22.5
    @State private var draftMonthlyGoalHours = 90.0
    @State private var draftUseWeekdaysOnly = false
    @State private var draftDaysAttendedPerWeek = 5
    @State private var didLoadDrafts = false
    @State private var showSavedBadge = false

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
                            saveDrafts()
                        } label: {
                            HStack {
                                Image(systemName: "checkmark.circle.fill")
                                Text(hasUnsavedChanges ? "Save Settings" : "Settings Saved")
                                    .fontWeight(.semibold)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(hasUnsavedChanges ? TT42Palette.primaryTint.opacity(0.22) : TT42Palette.darkTrack.opacity(0.14))
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .disabled(!hasUnsavedChanges)

                        if showSavedBadge {
                            Text("Saved. Main and Historic pages now use these targets.")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
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
                loadDraftsFromPersisted()
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
                value: $draftDailyGoalHours,
                range: 0...24,
                step: 0.5
            )

            goalStepper(
                title: "Week Goal",
                value: $draftWeeklyGoalHours,
                range: 0...120,
                step: 0.5
            )

            goalStepper(
                title: "Month Goal",
                value: $draftMonthlyGoalHours,
                range: 0...300,
                step: 1
            )
        }
        .tt42CardStyle()
    }

    private var paceCard: some View {
        VStack(alignment: .leading, spacing: TT42Spacing.small) {
            TT42SectionHeader("Pacing Rules")

            Toggle("Use weekdays only for remaining pace", isOn: $draftUseWeekdaysOnly)

            Stepper(value: $draftDaysAttendedPerWeek, in: 1...7) {
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
        let daysInMonth = max(totalDaysInCurrentMonth, 1)
        let weekdays = max(weekdaysInCurrentMonth, 1)
        let selectedDays = draftUseWeekdaysOnly ? weekdays : daysInMonth
        let recommendedDaily = draftMonthlyGoalHours / Double(selectedDays)
        let recommendedWeekly = recommendedDaily * Double(max(draftDaysAttendedPerWeek, 1))

        return VStack(alignment: .leading, spacing: TT42Spacing.small) {
            TT42SectionHeader("How Settings Recalculate Targets")

            Text("Mode uses \(selectedDays) day(s) in this month.")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            row("Recommended daily target", TimeFormatters.hoursToReadable(recommendedDaily))
            row("Recommended weekly target", TimeFormatters.hoursToReadable(recommendedWeekly))
            row("Configured day goal", TimeFormatters.hoursToReadable(draftDailyGoalHours))
            row("Configured week goal", TimeFormatters.hoursToReadable(draftWeeklyGoalHours))
            row("Configured month goal", TimeFormatters.hoursToReadable(draftMonthlyGoalHours))
        }
        .tt42CardStyle()
    }

    private var hasUnsavedChanges: Bool {
        draftThemeMode.rawValue != persistedThemeModeRaw
            || abs(draftDailyGoalHours - persistedDailyGoalHours) > 0.0001
            || abs(draftWeeklyGoalHours - persistedWeeklyGoalHours) > 0.0001
            || abs(draftMonthlyGoalHours - persistedMonthlyGoalHours) > 0.0001
            || draftUseWeekdaysOnly != persistedUseWeekdaysOnly
            || draftDaysAttendedPerWeek != persistedDaysAttendedPerWeek
    }

    private func saveDrafts() {
        persistedThemeModeRaw = draftThemeMode.rawValue
        persistedDailyGoalHours = draftDailyGoalHours
        persistedWeeklyGoalHours = draftWeeklyGoalHours
        persistedMonthlyGoalHours = draftMonthlyGoalHours
        persistedUseWeekdaysOnly = draftUseWeekdaysOnly
        persistedDaysAttendedPerWeek = draftDaysAttendedPerWeek

        showSavedBadge = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            showSavedBadge = false
        }
    }

    private func loadDraftsFromPersisted() {
        draftThemeMode = TT42ThemeMode(rawValue: persistedThemeModeRaw) ?? .system
        draftDailyGoalHours = persistedDailyGoalHours
        draftWeeklyGoalHours = persistedWeeklyGoalHours
        draftMonthlyGoalHours = persistedMonthlyGoalHours
        draftUseWeekdaysOnly = persistedUseWeekdaysOnly
        draftDaysAttendedPerWeek = persistedDaysAttendedPerWeek
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

    private var totalDaysInCurrentMonth: Int {
        let calendar = Calendar.current
        let start = calendar.date(from: calendar.dateComponents([.year, .month], from: Date())) ?? Date()
        return calendar.range(of: .day, in: .month, for: start)?.count ?? 30
    }

    private var weekdaysInCurrentMonth: Int {
        let calendar = Calendar.current
        let start = calendar.date(from: calendar.dateComponents([.year, .month], from: Date())) ?? Date()
        let end = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: start) ?? Date()

        var count = 0
        var day = start
        while day <= end {
            if !calendar.isDateInWeekend(day) {
                count += 1
            }
            guard let next = calendar.date(byAdding: .day, value: 1, to: day), next > day else { break }
            day = next
        }
        return count
    }
}

#Preview {
    SettingsView()
}

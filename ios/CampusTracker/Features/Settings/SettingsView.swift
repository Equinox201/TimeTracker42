import SwiftUI

struct SettingsView: View {
    @Environment(AppState.self) private var appState

    @AppStorage("ui_theme_mode") private var themeModeRaw = TT42ThemeMode.system.rawValue
    @AppStorage("ui_daily_goal_hours") private var dailyGoalHours = 6.0
    @AppStorage("ui_weekly_goal_hours") private var weeklyGoalHours = 22.5
    @AppStorage("ui_monthly_goal_hours") private var monthlyGoalHours = 90.0
    @AppStorage("ui_pace_weekdays_only") private var useWeekdaysOnly = false
    @AppStorage("ui_days_attended_per_week") private var daysAttendedPerWeek = 5

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

                        Button("Sign Out", role: .destructive) {
                            Task { await appState.signOut() }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(TT42Palette.magenta.opacity(0.16))
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .padding(TT42Spacing.medium)
                }
            }
            .navigationTitle("Settings")
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
            Picker("Theme", selection: themeBinding) {
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
                value: $dailyGoalHours,
                range: 0...24,
                step: 0.5
            )

            goalStepper(
                title: "Week Goal",
                value: $weeklyGoalHours,
                range: 0...120,
                step: 0.5
            )

            goalStepper(
                title: "Month Goal",
                value: $monthlyGoalHours,
                range: 0...300,
                step: 1
            )
        }
        .tt42CardStyle()
    }

    private var paceCard: some View {
        VStack(alignment: .leading, spacing: TT42Spacing.small) {
            TT42SectionHeader("Pacing Rules")

            Toggle("Use weekdays only for remaining pace", isOn: $useWeekdaysOnly)

            Stepper(value: $daysAttendedPerWeek, in: 1...7) {
                HStack {
                    Text("Days attended per week")
                    Spacer()
                    Text("\(daysAttendedPerWeek)")
                        .fontWeight(.semibold)
                }
            }
        }
        .tt42CardStyle()
    }

    private var impactCard: some View {
        let daysInMonth = max(totalDaysInCurrentMonth, 1)
        let weekdays = max(weekdaysInCurrentMonth, 1)
        let selectedDays = useWeekdaysOnly ? weekdays : daysInMonth
        let recommendedDaily = monthlyGoalHours / Double(selectedDays)
        let recommendedWeekly = recommendedDaily * Double(max(daysAttendedPerWeek, 1))

        return VStack(alignment: .leading, spacing: TT42Spacing.small) {
            TT42SectionHeader("How Settings Recalculate Targets")

            Text("Mode uses \(selectedDays) day(s) in this month.")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            row("Recommended daily target", "\(formatHours(recommendedDaily)) h")
            row("Recommended weekly target", "\(formatHours(recommendedWeekly)) h")
            row("Current configured day goal", "\(formatHours(dailyGoalHours)) h")
            row("Current configured week goal", "\(formatHours(weeklyGoalHours)) h")
        }
        .tt42CardStyle()
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
                Text("\(formatHours(value.wrappedValue)) h")
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

    private var themeBinding: Binding<TT42ThemeMode> {
        Binding(
            get: { TT42ThemeMode(rawValue: themeModeRaw) ?? .system },
            set: { themeModeRaw = $0.rawValue }
        )
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
            guard let next = calendar.date(byAdding: .day, value: 1, to: day) else { break }
            day = next
        }
        return count
    }

    private func formatHours(_ value: Double) -> String {
        String(format: "%.1f", value)
    }
}

#Preview {
    SettingsView()
}

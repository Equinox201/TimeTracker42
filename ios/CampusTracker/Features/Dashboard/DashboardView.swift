import SwiftUI

struct DashboardView: View {
    @Environment(AppState.self) private var appState
    @State private var summary: DashboardSummary?
    @State private var isLoading = false
    @State private var isSyncing = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
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
                        VStack(spacing: 16) {
                            StaleDataBanner(
                                isStale: summary.isStale,
                                message: staleMessage(for: summary)
                            )

                            HStack(spacing: 20) {
                                ActivityRingView(
                                    title: "Day",
                                    progress: progress(
                                        value: summary.hoursToday,
                                        goal: summary.dailyGoalHours
                                    ),
                                    tint: .mint
                                )
                                ActivityRingView(
                                    title: "Week",
                                    progress: progress(
                                        value: summary.hoursWeek,
                                        goal: summary.weeklyGoalHours
                                    ),
                                    tint: .blue
                                )
                                ActivityRingView(
                                    title: "Month",
                                    progress: progress(
                                        value: summary.hoursMonth,
                                        goal: summary.monthlyGoalHours
                                    ),
                                    tint: .green
                                )
                            }

                            VStack(alignment: .leading, spacing: 10) {
                                metricRow("Today", "\(formatHours(summary.hoursToday)) h")
                                metricRow("This week", "\(formatHours(summary.hoursWeek)) h")
                                metricRow("This month", "\(formatHours(summary.hoursMonth)) h")
                                metricRow(
                                    "Hours left this month",
                                    "\(formatHours(summary.hoursLeftToMonthlyGoal)) h"
                                )
                                metricRow(
                                    "Required / day",
                                    "\(formatHours(summary.requiredHoursPerRemainingDay)) h"
                                )
                                metricRow(
                                    "Required / weekday",
                                    "\(formatHours(summary.requiredHoursPerRemainingWeekday)) h"
                                )
                                metricRow(
                                    "Week vs previous",
                                    "\(formatHours(summary.weekVsPreviousWeekHours)) h"
                                )
                                metricRow(
                                    "Month vs previous",
                                    "\(formatHours(summary.monthVsPreviousMonthHours)) h"
                                )
                            }
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color(.secondarySystemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        .padding()
                    }
                } else {
                    ContentUnavailableView("No dashboard data", systemImage: "chart.xyaxis.line")
                }
            }
            .navigationTitle("Dashboard")
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

    private func progress(value: Double, goal: Double) -> Double {
        guard goal > 0 else { return 0 }
        return min(max(value / goal, 0), 1)
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

    private func metricRow(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.semibold)
        }
    }
}

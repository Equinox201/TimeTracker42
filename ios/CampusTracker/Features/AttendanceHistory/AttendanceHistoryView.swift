import Charts
import SwiftUI

struct AttendanceHistoryView: View {
    @Environment(AppState.self) private var appState
    @State private var history: AttendanceHistoryResponse?
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
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
                        VStack(spacing: 16) {
                            StaleDataBanner(
                                isStale: history.isStale,
                                message: staleMessage(for: history)
                            )

                            Chart(history.days) { day in
                                if let date = day.dayDate {
                                    BarMark(
                                        x: .value("Day", date),
                                        y: .value("Hours", day.hours)
                                    )
                                    .foregroundStyle(day.hasRecord ? Color.blue : Color.gray.opacity(0.4))
                                }
                            }
                            .frame(height: 240)

                            VStack(alignment: .leading, spacing: 10) {
                                row("Range", "\(history.fromDate) to \(history.toDate)")
                                row("Days in range", "\(history.totalDays)")
                                row("Total hours", "\(formatHours(history.totalHours)) h")
                                row("Recorded days", "\(history.days.filter(\.hasRecord).count)")
                            }
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color(.secondarySystemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        .padding()
                    }
                } else {
                    ContentUnavailableView("No history data", systemImage: "calendar")
                }
            }
            .navigationTitle("Attendance")
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

        let endDate = Date()
        let startDate = Calendar.current.date(byAdding: .day, value: -29, to: endDate) ?? endDate

        do {
            let accessToken = try await appState.validAccessToken()
            let loadedHistory = try await appState.apiClient.getAttendanceHistory(
                accessToken: accessToken,
                from: startDate,
                to: endDate
            )
            history = loadedHistory
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

    private func row(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.semibold)
        }
    }
}

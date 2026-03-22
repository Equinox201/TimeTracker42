import SwiftUI

struct DashboardView: View {
    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                ActivityRingView(title: "Month", progress: 0.32, tint: .green)
                StaleDataBanner(message: "Data is fresh")

                Text("Dashboard content will be connected in Milestone 1")
                    .foregroundStyle(.secondary)
            }
            .padding()
            .navigationTitle("Dashboard")
        }
    }
}

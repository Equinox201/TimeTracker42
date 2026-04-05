import Foundation

struct DashboardSummary: Codable {
    let hoursToday: Double
    let hoursTodayFinalized: Double
    let hoursTodayLive: Double
    let hoursWeek: Double
    let hoursMonth: Double
    let dailyGoalHours: Double
    let weeklyGoalHours: Double
    let monthlyGoalHours: Double
    let hoursLeftToMonthlyGoal: Double
    let requiredHoursPerRemainingDay: Double
    let requiredHoursPerRemainingWeekday: Double
    let weekVsPreviousWeekHours: Double
    let monthVsPreviousMonthHours: Double
    let paceMode: String
    let isStale: Bool
    let staleAgeHours: Double?
    let lastSyncedAt: String?
    let todayIsLive: Bool
    let liveCheckedAt: String?
}

import Foundation

struct DashboardSummary: Codable {
    let hoursToday: Double
    let hoursWeek: Double
    let hoursMonth: Double
    let monthlyGoalHours: Double
    let hoursLeftToMonthlyGoal: Double
    let requiredHoursPerRemainingDay: Double
    let requiredHoursPerRemainingWeekday: Double
    let isStale: Bool
}

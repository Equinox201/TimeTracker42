import Foundation

enum GoalInputMode: String, Codable, CaseIterable {
    case daily
    case weekly
    case monthly
}

enum GoalPaceMode: String, Codable {
    case calendarDays = "calendar_days"
    case weekdays
}

struct GoalSettings: Codable {
    let id: String?
    let dailyGoalSeconds: Int
    let weeklyGoalSeconds: Int
    let monthlyGoalSeconds: Int
    let paceMode: GoalPaceMode
    let daysPerWeek: Int
    let effectiveFrom: String
    let isActive: Bool

    var dailyGoalHours: Double { Double(dailyGoalSeconds) / 3600 }
    var weeklyGoalHours: Double { Double(weeklyGoalSeconds) / 3600 }
    var monthlyGoalHours: Double { Double(monthlyGoalSeconds) / 3600 }
}

struct GoalSettingsUpdateRequest: Encodable {
    let inputMode: GoalInputMode
    let inputGoalSeconds: Int
    let paceMode: GoalPaceMode
    let daysPerWeek: Int
    let effectiveFrom: String
}

import Foundation

struct GoalDraft {
    let dailyGoalHours: Double
    let weeklyGoalHours: Double
    let monthlyGoalHours: Double
    let paceMode: GoalPaceMode
    let daysPerWeek: Int
}

struct RecommendedPace {
    let remainingHours: Double
    let targetDays: Int
    let dailyHours: Double
    let weeklyHours: Double
}

enum GoalMath {
    static func deriveDraft(
        inputMode: GoalInputMode,
        inputGoalHours: Double,
        paceMode: GoalPaceMode,
        daysPerWeek: Int,
        effectiveFrom: Date
    ) -> GoalDraft {
        let normalizedDaysPerWeek = min(max(daysPerWeek, 1), 7)
        let activeDays = activeDaysInMonth(for: effectiveFrom, paceMode: paceMode)
        let inputGoalSeconds = max(Int(round(inputGoalHours * 3600)), 0)

        let dailyGoalSeconds: Int
        let weeklyGoalSeconds: Int
        let monthlyGoalSeconds: Int

        switch inputMode {
        case .monthly:
            monthlyGoalSeconds = inputGoalSeconds
            dailyGoalSeconds = Int(round(Double(monthlyGoalSeconds) / Double(activeDays)))
            weeklyGoalSeconds = Int(round(Double(dailyGoalSeconds * normalizedDaysPerWeek)))
        case .weekly:
            weeklyGoalSeconds = inputGoalSeconds
            dailyGoalSeconds = Int(round(Double(weeklyGoalSeconds) / Double(normalizedDaysPerWeek)))
            monthlyGoalSeconds = Int(round(Double(dailyGoalSeconds * activeDays)))
        case .daily:
            dailyGoalSeconds = inputGoalSeconds
            weeklyGoalSeconds = Int(round(Double(dailyGoalSeconds * normalizedDaysPerWeek)))
            monthlyGoalSeconds = Int(round(Double(dailyGoalSeconds * activeDays)))
        }

        return GoalDraft(
            dailyGoalHours: normalizeHours(Double(dailyGoalSeconds) / 3600),
            weeklyGoalHours: normalizeHours(Double(weeklyGoalSeconds) / 3600),
            monthlyGoalHours: normalizeHours(Double(monthlyGoalSeconds) / 3600),
            paceMode: paceMode,
            daysPerWeek: normalizedDaysPerWeek
        )
    }

    static func buildRecommendedPace(
        monthlyGoalHours: Double,
        monthlyHoursSoFar: Double,
        paceMode: GoalPaceMode,
        daysPerWeek: Int,
        from now: Date
    ) -> RecommendedPace {
        let targetDays = remainingTargetDays(from: now, paceMode: paceMode)
        let remainingHours = max(monthlyGoalHours - monthlyHoursSoFar, 0)
        let normalizedDaysPerWeek = min(max(daysPerWeek, 1), 7)
        let dailyHours = remainingHours / Double(targetDays)

        return RecommendedPace(
            remainingHours: normalizeHours(remainingHours),
            targetDays: targetDays,
            dailyHours: normalizeHours(dailyHours),
            weeklyHours: normalizeHours(dailyHours * Double(normalizedDaysPerWeek))
        )
    }

    static func activeDaysInMonth(for monthAnchor: Date, paceMode: GoalPaceMode) -> Int {
        let calendar = Calendar.current
        let monthStart = calendar.date(from: calendar.dateComponents([.year, .month], from: monthAnchor)) ?? monthAnchor
        let daysInMonth = calendar.range(of: .day, in: .month, for: monthStart)?.count ?? 30

        if paceMode == .calendarDays {
            return max(daysInMonth, 1)
        }

        var count = 0
        for offset in 0..<daysInMonth {
            guard let day = calendar.date(byAdding: .day, value: offset, to: monthStart) else { continue }
            if !calendar.isDateInWeekend(day) {
                count += 1
            }
        }

        return max(count, 1)
    }

    static func normalizeHours(_ value: Double) -> Double {
        guard value.isFinite, value >= 0 else { return 0 }
        return (value * 100).rounded() / 100
    }

    private static func remainingTargetDays(from now: Date, paceMode: GoalPaceMode) -> Int {
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: now)
        let monthStart = calendar.date(from: calendar.dateComponents([.year, .month], from: start)) ?? start
        let monthEnd = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: monthStart) ?? start

        var count = 0
        var cursor = start
        while cursor <= monthEnd {
            if paceMode == .calendarDays || !calendar.isDateInWeekend(cursor) {
                count += 1
            }
            guard let next = calendar.date(byAdding: .day, value: 1, to: cursor), next > cursor else {
                break
            }
            cursor = next
        }

        return max(count, 1)
    }
}

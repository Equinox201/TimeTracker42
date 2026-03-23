# iOS App Scaffold

This folder contains source structure for the SwiftUI iPhone app.

## Important
The Xcode project file is not generated automatically here.
Create `CampusTracker.xcodeproj` in Xcode, then add files from `ios/CampusTracker/` to your app target.

## Modules
- `App/` app entry and global state
- `Features/` screen-level UI
- `Data/` API client, cache, and models
- `UIComponents/` reusable visual components

## Milestone 5 Runtime Notes
- Login now uses `ASWebAuthenticationSession` with backend OAuth start endpoint.
- On successful callback (`timetracker42://auth/callback?otc=...`), the app exchanges OTC through backend and stores session tokens in Keychain.
- Once signed in, the app calls:
  - `GET /api/v1/dashboard/summary`
  - `GET /api/v1/attendance/history?from=...&to=...`
  - `POST /api/v1/sync/manual` (dashboard sync button)
- Access token refresh is automatic when token is near expiry.

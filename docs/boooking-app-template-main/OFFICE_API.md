# dblue-office Proxy Routes — API Reference

These routes are mounted in the booking-app backend and proxy requests to dblue-office. All four routes require an active session (valid `httpOnly` JWT cookie). In development with `IS_AUTHENTICATED=true`, they return mocked data from `backend/data/`.

Base path: `/api/v1/office`

---

## GET /api/v1/office/users/list

Returns all active employees from dblue-office. Used to populate the teammate picker and any people-facing UI.

**Auth:** Session cookie required (`isLoggedIn` middleware)

**dblue-office upstream:** `GET /users/listbooking/:requestingUserId`

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "_id": "64a1f2e3b4c5d6e7f8a9b0c1",
      "name": "Mario Rossi",
      "email": "mario.rossi@dblue.it",
      "role": "employee",
      "employment_type": "full_time",
      "job_title": "Software Engineer",
      "image_url": "https://...",
      "login_method": "google",
      "status": true
    }
  ]
}
```

**Notes:**
- `_id` here is the dblue-office user ID. When storing as a teammate reference in dblue-app, store this value in the `dblueOfficeId` field.
- Returns all users regardless of whether they have a local dblue-app record — use this for the full teammate picker.
- `status: false` indicates a deactivated user.

---

## GET /api/v1/office/users/space-access/:uid

Returns the room categories and specific rooms a given user is permitted to book.

**Auth:** Session cookie required (`isLoggedIn` middleware)

**Params:**
- `uid` — the dblue-office user ID (`dblueOfficeId` field in dblue-app's User model, NOT the local MongoDB `_id`)

**dblue-office upstream:** `GET /fetch/user/space/access/:uid`

**Response:**
```json
{
  "success": true,
  "spaceAccess": [
    { "label": "Open Space", "value": "64b2a3c4d5e6f7a8b9c0d1e2" },
    { "label": "Lab A",      "value": "64b2a3c4d5e6f7a8b9c0d1e3" }
  ],
  "roomlist": [
    {
      "id": "64c3b4d5e6f7a8b9c0d1e2f3",
      "name": "Desk 1",
      "space": "64b2a3c4d5e6f7a8b9c0d1e2",
      "color": "#3B82F6"
    }
  ]
}
```

**Notes:**
- `spaceAccess` — the room categories (spaces) the user can access. Each `value` is a room category ID.
- `roomlist` — the individual rooms within those categories. `space` is the parent category ID.
- **Use this endpoint to derive total office capacity for the user:** sum the `capacity` of all rooms in `roomlist`. This replaces the hardcoded `23` fallback in App.tsx.
- **Use the room IDs from `roomlist`** when recording which room a user booked for a given day.
- Call this with `uid = session.dblueOfficeId` at session start to initialise the user's room access.

---

## GET /api/v1/office/rooms/list

Returns all rooms in the office regardless of user permissions. Use for admin views or when full room inventory is needed.

**Auth:** Session cookie required (`isLoggedIn` middleware)

**dblue-office upstream:** `GET /rooms/list`

**Response:**
```json
{
  "success": true,
  "rooms": [
    {
      "_id": "64c3b4d5e6f7a8b9c0d1e2f3",
      "name": "Desk 1",
      "category": "64b2a3c4d5e6f7a8b9c0d1e2",
      "capacity": 1,
      "features": ["monitor", "standing_desk"],
      "status": "active",
      "color": "#3B82F6"
    }
  ]
}
```

**Notes:**
- For user-facing room selection, prefer `/users/space-access/:uid` over this endpoint — it filters to what the user is actually permitted to book.
- `category` maps to the `value` field in `spaceAccess` from the space-access endpoint.

---

## GET /api/v1/office/closures/list

Returns all scheduled office closures (national holidays, planned closures, etc.).

**Auth:** Session cookie required (`isLoggedIn` middleware)

**dblue-office upstream:** `GET /closures/list`

**Response:**
```json
{
  "success": true,
  "closures": [
    {
      "_id": "64d4c5e6f7a8b9c0d1e2f3a4",
      "motivation": "Ferragosto",
      "start": "2026-08-15",
      "end": "2026-08-15",
      "range": ["2026-08-15"]
    },
    {
      "_id": "64d4c5e6f7a8b9c0d1e2f3a5",
      "motivation": "Christmas Break",
      "start": "2026-12-24",
      "end": "2026-12-31",
      "range": ["2026-12-24", "2026-12-25", "2026-12-26", "2026-12-27", "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31"]
    }
  ]
}
```

**Notes:**
- `range` contains all individual dates within the closure period (pre-expanded by dblue-office).
- Use `range` to build a fast lookup set: `const closedDates = new Set(closures.flatMap(c => c.range))`.
- **Replaces the hardcoded `IS_CLOSED_DAYS` array** in `frontend/src/components/DailyDetail.tsx` line 316.
- Also used as input to the adjusted mandatory presence days formula:
  ```
  workingDays = count of Mon–Fri in the month that do NOT appear in closedDates
  effectiveWorkingDays = workingDays − confirmed leave days − confirmed sick days − confirmed parental_leave days
  adjustedTarget = Math.round(mandatory_presence_days × effectiveWorkingDays / workingDays)
  // mandatory_presence_days = 0 if null or undefined
  ```
  This formula implements the Deep Blue hybrid work policy: *"In months where the total number of effective working days is reduced due to approved vacation, sick leave, national holidays, or office closures, the in-presence quota is adjusted accordingly on a proportional basis."*

---

## Development mock data

When `IS_AUTHENTICATED=true` in development, the proxy routes return data from local mock files instead of calling dblue-office:

| Route | Mock file |
|---|---|
| `/users/list` | `backend/data/mockedUsers.ts` |
| `/users/space-access/:uid` | `backend/data/mockedUsers.ts` + `mockedRooms.ts` + `mockedRoomCategories.ts` |
| `/rooms/list` | `backend/data/mockedRooms.ts` |
| `/closures/list` | `backend/data/mockedClosures.ts` |

Populate these files with realistic data that matches the response shapes above.

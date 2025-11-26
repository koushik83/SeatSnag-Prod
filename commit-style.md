# Commit Message Style Guide for SeatSnag

## Format Requirements

All commit messages MUST follow this format:

```
[One-line summary - Present tense, what was accomplished]

Changes:
- [Specific feature added or bug fixed]
- [Another feature or improvement]
- [Technical implementation detail]
- [UI/UX change if applicable]
- [Performance or security improvement if applicable]

Files modified:
- [filename] ([X lines added, Y lines removed])
- [filename] ([X lines added, Y lines removed])
- [Add more files as needed]

Testing:
- [What was tested to verify changes work]
- [Edge cases considered]

[Optional: Breaking changes, migration notes, or important context]
```

## Rules:

1. **Minimum 5-6 bullet points** in the Changes section
2. **Be specific** - "Added user authentication" not just "updated auth"
3. **Include line counts** for files with significant changes
4. **Present tense** - "Add feature" not "Added feature"
5. **Group related changes** - Don't list every tiny detail
6. **Mention why** when it's not obvious - "Fix booking overlap to prevent double-bookings"

## Good Examples:

### Example 1: Feature Addition
```
Add comprehensive analytics dashboard to admin panel

Changes:
- Implement time period selector (7/30/90/365 days) with visual active state
- Create SVG line chart showing daily utilization trends across all locations
- Build location performance cards with progress bars and sorting by utilization
- Add weekly heatmap (Mon-Fri) with color-coded utilization levels
- Implement role-based data access (super admin sees all, company admin sees only their locations)
- Add interactive tooltips on chart hover showing exact booking details

Files modified:
- public/admin.html (120 lines added)
- css/admin.css (370 lines added)
- js/admin.js (525 lines added)
- firestore.indexes.json (17 lines added)

Testing:
- Verified chart renders correctly with real booking data
- Tested period switching updates all visualizations
- Confirmed role-based filtering works for company admins
- Validated tooltips show accurate booking counts
```

### Example 2: Bug Fix
```
Fix booking overlap validation to prevent double-bookings

Changes:
- Add server-side validation in booking.js to check existing bookings before creating new ones
- Implement real-time capacity checking that accounts for concurrent booking attempts
- Display clear error message when location is at full capacity
- Add loading state during validation to prevent multiple submissions
- Update booking modal to show current capacity in real-time

Files modified:
- js/booking.js (85 lines added, 12 lines removed)
- css/booking.css (23 lines added)
- public/booking.html (8 lines modified)

Testing:
- Simulated concurrent bookings - correctly rejects second booking
- Tested full capacity scenario - shows appropriate error
- Verified loading state prevents double-clicks
- Confirmed real-time capacity updates work across multiple tabs
```

### Example 3: Refactoring
```
Refactor Firebase initialization to eliminate duplicate API keys

Changes:
- Create centralized firebase-init.js module for Firebase configuration
- Remove hardcoded API keys from admin.js, booking.js, and signup.js
- Import Firebase instance from centralized module across all pages
- Add error handling for Firebase initialization failures
- Update all Firestore queries to use shared db instance

Files modified:
- js/firebase-init.js (45 lines added - new file)
- js/admin.js (78 lines removed, 12 lines added)
- js/booking.js (65 lines removed, 10 lines added)
- js/signup.js (52 lines removed, 8 lines added)
- js/landing.js (15 lines modified)

Testing:
- Verified all pages load Firebase correctly
- Tested authentication flow across all pages
- Confirmed Firestore queries work with shared instance
- Checked console for initialization errors
```

## Bad Examples (Don't Do This):

❌ `git commit -m "fixed stuff"`
❌ `git commit -m "update"`
❌ `git commit -m "working on analytics"`
❌ `git commit -m "changes"`
❌ `git commit -m "bug fix"`

## Notes:

- **First line** should be 50-72 characters max
- **Body** should wrap at 72 characters per line
- Use **bullet points** for readability
- **Separate concerns** - one commit per logical change
- **Link issues** if using GitHub Issues: "Fixes #123"

---

This style guide ensures that:
1. Future you knows what changed and why
2. Other developers can understand the history
3. Rollbacks are easier (you know what each commit does)
4. Project documentation is built into git history

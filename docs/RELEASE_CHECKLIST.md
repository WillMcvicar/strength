# Release checklist (manual device checks)

Run on at least one physical iPhone and one physical Android phone, using TestFlight or the Play closed-test build (DESIGN §9.1).

- [ ] **Airplane mode:** onboarding, starting a plan, logging a full session, the summary, reviews and export all work (AC-9)
- [ ] **Rest timer:** the notification fires on time with the app in the background, on iOS and Android (§2.6)
- [ ] **Workout reminder:** the reminder fires at the chosen time
- [ ] **Session recovery:** force-quit mid-session, reopen, and the session resumes (AC-7)
- [ ] **First launch:** a fresh install opens past the database gate, which proves the migrations ran and foreign keys are on inside transactions (D-35, with `SQLITE_DEFAULT_FOREIGN_KEYS` as a backstop)
- [ ] **OS backup:** back up, reinstall, restore, and the data returns (iCloud device backup; Android Auto Backup)
- [ ] **JSON backup:** export, then import into a fresh install (AC-69)
- [ ] **Text size:** the largest system text size (about 200%) leaves no truncated numbers
- [ ] **Screen readers:** VoiceOver and TalkBack can complete a set and finish a workout
- [ ] **Themes:** light and dark themes both look correct
- [ ] **Keep awake:** the screen stays on during a session when the setting is enabled
- [ ] **Performance:** cold start to Today takes under 2 seconds on a mid-range Android phone (NFR-5)

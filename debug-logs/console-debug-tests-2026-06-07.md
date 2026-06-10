# Console Debug Test Log - 2026-06-07

## Scope
- Recreate startup hang locally.
- Capture simulator console output for startup and crash signatures.
- Add automated user-flow pass/fail tests.

## Reproduction Runs

### Run 1: Full iOS local run
- Command: `npx expo run:ios --no-build-cache`
- Output log: `debug-logs/repro-2026-06-07-run-ios.log`
- Result: Build/launch activity observed; no definitive local crash signature captured in this run.

### Run 2: Direct simulator launch
- Command: `xcrun simctl launch 420F078D-A25D-493A-A42C-F175C7CA24BA com.firstdivisioncaptain.KbpsLive`
- Result: Launch succeeded (`PID 9196`).

### Run 3: Focused simulator console capture (5m)
- Command: `xcrun simctl spawn ... log show --last 5m --predicate 'process == "KbpsLive" OR ... LaunchFlow OR expo-updates'`
- Output log: `debug-logs/repro-2026-06-07-sim-console.log`
- Result: Minimal lifecycle line only; no crash/abort marker.

### Run 4: Wider simulator console capture (30m)
- Command: `xcrun simctl spawn ... log show --last 30m --predicate 'process == "KbpsLive" OR ... RNSTabBarController OR abort OR EXC_'`
- Output log: `debug-logs/repro-2026-06-07-sim-console-30m.log`
- Result: No `RNSTabBarController` abort in simulator. Repeated CoreAudio pause/resume and CFNetwork local dev-server reconnect traffic.

## Console Clues Found
- `CFNetwork`/`network` logs show socket reconnect/cancel behavior to local Metro endpoint `:8081`.
- Frequent `CoreAudio` pause/resume transitions while app remains alive.
- No simulator evidence of the native tab controller abort seen in TestFlight crash traces.

## Interpretation
- Local simulator does not reproduce the production/TestFlight crash path.
- Current local evidence points to runtime environment differences (release/TestFlight/native lifecycle) rather than a deterministic simulator failure.

## Automated User-Flow Test Suite Added
- Test command: `npm run test:use-cases`
- Test file: `__tests__/user-flows.test.tsx`
- Output artifact: `debug-logs/user-flow-test-output-2026-06-07.log`
- Result: 7 passed / 0 failed

### Covered flows
1. First-launch welcome routing.
2. Returning-user what's-new routing when update ID changes.
3. Home play/pause interaction.
4. Explore external link open.
5. Recent song favorite toggle.
6. Settings appearance change.
7. Settings app-guide route.

## Pass/Fail Summary
- Local simulator crash reproduction: FAIL (not reproduced).
- Startup console clue capture: PASS (logs captured and archived).
- Automated user-flow suite: PASS (all current tests passing).

## Notes
- No EAS build or TestFlight submission was executed during this debug/testing pass.

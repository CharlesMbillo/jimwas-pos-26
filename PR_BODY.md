# PR: Improve Void Modal Accessibility

This branch implements a set of accessibility and usability improvements for the Void Transaction modal, replaces the inline focus-trap implementation with a tested library, and adds unit/accessibility tests.

What I changed

- Replaced inline focus-trap logic with focus-trap-react (a tested focus trap library).
- Added ESC-to-close keyboard handling (Escape key closes the modal).
- Added auto-focus delay and smooth scrollIntoView for the reason textarea to improve mobile behavior.
- Added an ARIA live region that announces when the modal opens and when submissions start/succeed/fail.
- Added unit + accessibility tests (Vitest + @testing-library + axe-core) that:
  - verify textarea auto-focus
  - verify Escape closes modal
  - run a basic axe accessibility check

How to run locally

1. Install new dependencies:

pnpm install

2. Run the dev server and open the app:

pnpm run dev

3. Run unit/accessibility tests:

pnpm run test:unit

Notes

- The tests run in JSDOM via Vitest. They do not launch the full app but render the modal component in isolation.
- Screenshot placeholders: I could not automatically generate screenshots. Please attach screenshots of the modal on desktop and a narrow mobile viewport in the PR description using the following filenames inside the PR body as references:
  - screenshots/void-modal-desktop.png
  - screenshots/void-modal-mobile.png

Test checklist (to include in PR description)

- [ ] Reason textarea auto-focused on modal open
- [ ] Tab/Shift+Tab focus is trapped inside the modal
- [ ] ESC closes the modal and returns focus to the opener
- [ ] Header and footer remain visible while content scrolls
- [ ] ARIA live announcements are present when modal opens and on submission
- [ ] Automated tests pass (pnpm run test:unit)

Screenshots

Please add the screenshots to the PR description or upload them to the branch under `screenshots/` so they appear in the PR review.

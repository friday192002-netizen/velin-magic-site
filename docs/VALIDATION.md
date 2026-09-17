# Validation — 17 September 2026

- HTML audit: exactly one H1; unique IDs; all local assets and fragment links resolve; every image has alt text and width/height.
- JavaScript syntax: checked with Node.
- Browser: 320×568, 375×667, 390×844, 768×1024, 1024×768, 1366×768, 1440×900 and 1920×1080 tested for horizontal overflow; none observed. Compact mobile hero adjusted and rechecked visually at 320×568 and 375×667.
- Desktop hero and mobile hero visually reviewed; source photos inspected before selection.
- Mobile menu opens and closes after selection.
- Selecting Close-up Magic carries the choice into the form.
- Empty form is blocked; valid test input generates a message locally.
- Editing input hides the stale generated message.
- Gallery dialog opens; Escape closes it and returns focus.
- Film dialog opens; close removes its iframe and restores scrolling. Full third-party playback is not guaranteed by these tests; external YouTube fallback is provided.
- No JavaScript errors captured during browser interaction checks.
- No messages sent, no production deployment, no writes to Untitled project.

The form intentionally does not create a booking or send data: customers copy their message to LINE. Small-screen layouts prioritize legible controls; landscape windows may scroll vertically.

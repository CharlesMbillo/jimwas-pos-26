# Releases

The release workflow runs on `main` or manual dispatch after validation. It calculates a conventional-commit-aware version bump, creates an annotated tag, publishes a GitHub Release, and attaches the frontend build output.

Use `feat:` for a minor release, `fix:` for a patch release, and `BREAKING CHANGE:` for a major release. Review the generated changelog before production deployment.

# Security policy

This project is in **pre-release preparation**. Do not deploy it publicly or use real client data until its release gates pass.

If you find a security vulnerability, do **not** post proof-of-concept exploits, access tokens, customer information, or private data in public issues. Use GitHub's private vulnerability reporting if enabled by the maintainers, or contact maintainers privately through an approved channel.

## Release security priorities
- Cross-company and homeowner/contractor authorization checks
- Secure sessions, CSRF protection, and permissions for private image/PDF endpoints
- SQLite storage and backup integrity
- Validation of uploaded files, sizes, parsing, and media types
- Dependency vulnerability audits and browser testing
- No paid third-party AI services or customer-photo processing enabled by default

Never upload customer databases, API keys, configuration secrets or real homeowner photos as test fixtures.

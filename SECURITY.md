# Security Policy

## Supported Releases

Axiom follows a rolling support model for the current mainline release.

| Release Line | Status |
| --- | --- |
| Current `main` release | Supported |
| Previous minor release | Security fixes only (30 days) |
| Older releases | Not supported |

## Reporting a Vulnerability

Report vulnerabilities privately. Do not open public issues for security defects.

1. Send details to: `security@axiomprocure.com`
2. Include:
- Affected endpoint/module
- Reproduction steps
- Expected impact
- Suggested mitigation (if available)
3. Optional encrypted report: include your PGP key in the email and request encrypted follow-up.

## Response SLA

- Initial acknowledgement: within 24 hours
- Triage result: within 3 business days
- Critical fix target: within 72 hours
- High severity target: within 7 days

## Scope

In scope:
- Authentication/authorization bypass
- Data exposure and multi-tenant boundary violations
- Injection vulnerabilities
- Secrets leakage
- RCE, SSRF, and file upload abuse

Out of scope:
- Social engineering/phishing without product vulnerability
- Denial-of-service requiring extreme infrastructure scale
- Issues in unsupported releases

## Coordinated Disclosure

Please allow us time to remediate before public disclosure. We will credit responsible researchers after a fix is deployed unless anonymity is requested.

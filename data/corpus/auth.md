# Authentication and Authorization Service

## Purpose

The Authentication and Authorization Service (Auth Service) is the security gateway for all Wealthsimple systems. It manages customer and staff authentication, issues and validates JWT access and refresh tokens, enforces multi-factor authentication (MFA), manages role-based access control (RBAC), and provides API key management for third-party integrations.

Every API call to Wealthsimple's platform — whether from a customer mobile app, web browser, or internal service — is validated by the Auth Service before the request reaches any downstream system.

## Key Capabilities

### Authentication

- **Credential-Based Login:** Customers authenticate with email + password. Passwords are hashed using Argon2id with per-user salt. The service enforces a minimum password strength policy (12+ characters, complexity requirements) and breached-password detection via HIBP (Have I Been Pwned) API integration.
- **Social Login:** OAuth 2.0 / OIDC integration with Google and Apple identity providers. Social accounts are linked to a Wealthsimple identity record and subjected to the same MFA and KYC requirements.
- **MFA Enforcement:** All accounts must enrol in at least one MFA factor. Supported factors: TOTP (authenticator app), SMS OTP, hardware security key (FIDO2/WebAuthn). High-value actions (withdrawals >$10,000, adding a new bank account, changing contact information) require MFA re-verification regardless of session age.
- **Brute Force Protection:** After 5 failed login attempts within 15 minutes, the account is locked for 30 minutes. Persistent failures trigger a permanent lock requiring identity re-verification through the KYC Service.

### Session Management

- **Access Tokens:** Short-lived JWT tokens (15-minute expiry) signed with RS256. Contain: sub (customer_id), scope (permissions), account_ids (accessible accounts), kyc_status, and iat/exp claims.
- **Refresh Tokens:** Long-lived opaque tokens (30-day expiry) stored in HttpOnly secure cookies. Each refresh rotates the token. Concurrent use detection (token reuse) immediately revokes the entire token family for the affected customer (session kill).
- **Token Revocation:** All active sessions can be enumerated and revoked from the customer's security settings. Service-level token revocation is available for compliance incidents.
- **Device Fingerprinting:** Session tokens are bound to a device fingerprint (user agent, screen resolution, timezone, IP subnet). Significant fingerprint changes trigger an MFA challenge.

### Role-Based Access Control (RBAC)

- **Customer Roles:** `customer` (standard), `joint-account-holder`, `authorized-trader` (can trade but not withdraw), `read-only` (view-only access).
- **Staff Roles:** `customer-support` (read-only account view), `compliance-officer` (compliance dashboard + STR review), `finance` (settlement and reconciliation), `engineering` (internal tooling access), `admin` (super-admin, requires 2-person authorization for sensitive operations).
- Role assignments are audited. Every role grant and revocation creates an immutable AuditLog entry.
- Permissions are enforced at the API gateway layer: each downstream service validates the `scope` claim in the JWT.

### API Key Management

- **Third-Party Integrations:** External partners (e.g., tax aggregation services) can be issued API keys with specific scopes and IP allowlists. Keys are hashed (SHA-256) before storage.
- **Key Lifecycle:** Keys can be rotated, scoped, and revoked. Every API key usage is logged with timestamp, IP, endpoint, and response status.
- **Key Expiry:** API keys expire after 1 year by default. Expiring keys generate automated renewal reminders 30 days in advance.

### Fraud and Anomaly Detection

- Logins from new geographies, IP reputation checks (VPN/proxy/TOR), and impossible travel detection generate risk signals. High-risk logins require MFA re-verification.
- Unusual API access patterns (high frequency, unusual scopes) trigger automated alerts to the security team.

## Data Handled

- Customer credentials (email, Argon2id password hash, MFA secret — encrypted at rest)
- OAuth tokens from social identity providers (encrypted at rest, not persisted after exchange)
- JWT signing keys (RSA key pairs, rotated quarterly, managed in AWS KMS)
- Refresh token records (hashed token, customer_id, device fingerprint, expiry, revocation status)
- Session audit log (login, logout, MFA events, suspicious activity flags)
- RBAC role assignments and permission grants
- API key records (hashed key, scope, IP allowlist, expiry, usage statistics)

## Regulatory Touchpoints

### OSFI B-13 Guideline (Technology and Cyber Risk Management)

- **Access Control:** B-13 Section 4.2 requires robust access controls, including MFA for all user access to sensitive systems. The Auth Service's mandatory MFA enforcement and RBAC implementation directly satisfies this requirement.
- **Identity and Access Management (IAM):** B-13 requires a formal IAM program with role-based access, privileged access management, and regular access reviews. The Auth Service's RBAC system and audit logs support these requirements.
- **Privileged Access:** All staff roles with elevated access (compliance-officer, admin) require hardware security key MFA. Admin operations requiring super-admin access use a 2-person authorization workflow.
- **Session Management:** B-13 requires secure session management controls. The Auth Service's JWT rotation, device binding, and concurrent-use detection address these requirements.
- **Incident Response:** Token revocation capabilities support the B-13 requirement for rapid containment of compromised credentials.

### Privacy Requirements (PIPEDA / Quebec Law 25)

- **Data Minimization:** Access tokens contain only the minimum necessary claims. Personal information is not stored in tokens.
- **Consent Management:** Customers can review and revoke all active sessions. API key grants require explicit customer consent.
- **Breach Notification:** Credential compromise detection (HIBP integration) enables proactive customer notification as required by breach notification obligations.
- **Data Residency:** All authentication data is stored in Canadian data centres (AWS ca-central-1) as required for personally identifiable information under PIPEDA.

### FINTRAC / AML

- The Auth Service's anomaly detection and impossible travel alerts feed into the Compliance Reporting Service's STR detection engine as risk signals.

## API Endpoints

- `POST /api/v1/auth/login` — Authenticate with email/password, returns access + refresh tokens
- `POST /api/v1/auth/refresh` — Exchange refresh token for new access token (rotation)
- `POST /api/v1/auth/logout` — Revoke current session
- `POST /api/v1/auth/mfa/enrol` — Enrol a new MFA factor
- `POST /api/v1/auth/mfa/verify` — Verify an MFA factor (TOTP, SMS, WebAuthn)
- `GET /api/v1/auth/sessions` — List all active sessions for the authenticated customer
- `DELETE /api/v1/auth/sessions/{session_id}` — Revoke a specific session
- `POST /api/v1/auth/api-keys` — Create an API key (staff/partner use)
- `DELETE /api/v1/auth/api-keys/{key_id}` — Revoke an API key

## Integration Points

- **KYC Service:** Checks KYC status when issuing production-tier tokens. Brute-force locked accounts are escalated to KYC for re-verification.
- **All downstream services:** JWT validation middleware on every service validates token signature, expiry, and scope against the Auth Service's public key endpoint.
- **Compliance Reporting Service:** Anomaly detection signals feed the STR detection engine.
- **Notifications Service:** Sends login alerts, MFA codes (SMS OTP), new device alerts, and suspicious activity notifications.

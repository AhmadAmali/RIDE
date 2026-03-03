# Notifications Service

## Purpose

The Notifications Service is the unified communication platform for Wealthsimple. It handles delivery of all customer-facing and internal communications across email, push notification (iOS/Android), and SMS channels. The service owns regulatory notice templates, enforces communication compliance rules, and maintains an immutable audit trail of all sent communications to satisfy regulatory record-keeping obligations.

## Key Capabilities

### Multi-Channel Delivery

- **Email:** Transactional emails delivered via SES (Amazon Simple Email Service). Templated emails for regulatory notices, account statements, trade confirmations, tax document availability, and general account communications. HTML and plain-text versions for each template (plain text required for accessibility compliance).
- **Push Notifications:** Mobile push via APNs (Apple Push Notification Service) and FCM (Firebase Cloud Messaging). Used for real-time alerts: trade fill confirmations, price alerts, account funding confirmations, security events (new login, suspicious activity).
- **SMS:** Transactional SMS via Twilio for time-sensitive alerts and MFA one-time passwords (OTPs). SMS delivery is rate-limited to prevent abuse. Two-way SMS handling for OTP verification.

### Regulatory Notice Templates

- **Regulated Communication Templates:** A library of pre-approved, legally reviewed templates for all client communications that constitute regulated disclosure. Templates are version-controlled. Any template change requires compliance approval before deployment to production.
- **Templates include:** Trade confirmation notices, account statement delivery notices, margin calls, product suitability notices, annual fee disclosure, tax document availability, TFSA/RRSP contribution receipt delivery, account closure notices, and material change notices.
- **Template Variables:** Templates use a strict allow-listed variable substitution system to prevent injection of unreviewed content into regulated notices.

### Preference Management

- Customers can configure notification preferences (opt-in/opt-out) for non-mandatory communications via the preferences API. Mandatory regulatory notices (trade confirmations, account statements, material changes) cannot be opted out.
- Opt-out preferences are respected for all marketing and promotional communications.
- Unsubscribe handling complies with Canada's Anti-Spam Legislation (CASL): one-click unsubscribe for commercial electronic messages, with a 10-business-day processing window.

### Delivery Audit Trail

- Every notification delivery attempt generates an immutable audit record: timestamp, channel, recipient, template_id, template_version, delivery_status, provider_message_id, and the resolved message body hash.
- Delivery status is tracked through provider webhooks: `SENT` → `DELIVERED` → `READ` (email open, push tap) or `BOUNCED` / `FAILED`.
- The audit trail is the system of record for regulatory disputes about whether required disclosures were delivered to clients.

### Regulatory Disclosure Scheduling

- Annual obligations (account statements, fee disclosures, regulatory notifications) are managed via a scheduling engine. The scheduler triggers notification dispatch for all affected customers within the required delivery window.
- Delivery failures are retried with exponential backoff (3 attempts) and escalated to a fallback channel if the primary channel fails (e.g., email falls back to paper statement for customers without confirmed email addresses).

### Bulk Communication

- Compliance-triggered bulk communications (e.g., product discontinuation notices, regulatory change disclosures affecting all customers) are managed via a bulk send job with per-customer personalisation and rate limiting to avoid provider throttling.

## Data Handled

- Notification templates (HTML, plain-text, SMS) and template versions
- Customer notification preferences (channel, category, opt-in/opt-out status)
- Delivery records (recipient, template, channel, timestamp, status, provider IDs)
- Resolved message body hashes (content fingerprint for audit purposes — full body not persisted)
- Scheduling jobs (periodic disclosure, bulk send jobs)
- Bounce and complaint records (used to suppress invalid addresses and protect sender reputation)

## Regulatory Touchpoints

### Client Communication Requirements (CIRO/NI 31-103)

- **Trade Confirmations:** NI 31-103 Section 14.12 requires delivery of a trade confirmation to the client promptly after execution. The Notifications Service ensures trade confirmations are delivered within the regulatory timeframe.
- **Account Statements:** NI 31-103 Section 14.14 requires periodic account statements (quarterly for active accounts, semi-annual for inactive). The scheduling engine enforces these delivery obligations.
- **Fee Disclosure:** CRM2 requirements mandate annual fee and performance reporting delivered to each client. The Notifications Service manages annual CRM2 report delivery.

### Disclosure Obligations

- **Material Change Notices:** Registered firms must provide advance notice of material changes to their services or relationship with clients. The bulk communication system is used for these disclosures.
- **Risk Disclosure:** Certain products require risk disclosure acknowledgement before purchase. The Notifications Service delivers pre-trade risk disclosure notices and tracks acknowledgement via return receipt confirmation.

### CASL (Canada's Anti-Spam Legislation)

- **Consent Requirements:** All commercial electronic messages (CEMs) require prior express or implied consent. The Notifications Service enforces CASL consent classification at send time: messages to customers without valid consent are blocked.
- **Unsubscribe Mechanism:** Every CEM must include a functional unsubscribe mechanism. The service embeds unsubscribe links and processes opt-outs within 10 business days as required by CASL.
- **Sender Identification:** Every email must identify Wealthsimple as the sender with contact information. Templates enforce this requirement.

### Privacy Requirements (PIPEDA)

- Customer contact information (email addresses, phone numbers) is treated as personal information. Access is restricted to the Notifications Service's internal API; no other service stores contact details.
- Delivery audit records do not retain full message bodies — only content hashes — to minimise personal data retention while preserving audit capability.

### Record Retention

- Delivery audit records must be retained for a minimum of 7 years to satisfy regulatory dispute resolution requirements (trade confirmation disputes, disclosure delivery disputes).

## API Endpoints

- `POST /api/v1/notifications/send` — Send a notification to a customer (single recipient)
- `POST /api/v1/notifications/bulk` — Queue a bulk send job for a notification campaign
- `GET /api/v1/notifications/history/{customer_id}` — Retrieve delivery history for a customer
- `GET /api/v1/notifications/preferences/{customer_id}` — Retrieve notification preferences
- `PUT /api/v1/notifications/preferences/{customer_id}` — Update notification preferences
- `GET /api/v1/notifications/templates` — List available notification templates
- `GET /api/v1/notifications/audit/{notification_id}` — Retrieve delivery audit record for a specific notification

## Integration Points

- **Trading Engine:** Receives trade fill events to trigger trade confirmation delivery.
- **Tax Reporting Service:** Receives tax document generation events to trigger T-slip availability notices.
- **Auth Service:** Receives login and security events to deliver security alerts; delivers MFA OTP codes.
- **KYC Service:** Receives KYC status changes to deliver verification result notices and EDD request notifications.
- **Compliance Reporting Service:** Receives compliance officer internal alerts (STR deadlines, LCTR due) via internal channel only — never customer-facing compliance alerts.

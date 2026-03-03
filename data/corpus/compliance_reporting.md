# Compliance Reporting Service

## Purpose

The Compliance Reporting Service is the regulatory filing and monitoring hub for Wealthsimple. It aggregates risk signals from across the platform, generates FINTRAC Suspicious Transaction Reports (STRs) and Large Cash Transaction Reports (LCTRs), manages CSA regulatory filings, and provides the compliance team with a real-time dashboard for monitoring regulatory obligations.

This service is the final control point before regulatory submissions leave Wealthsimple's systems. All external filings are validated, archived, and tracked for deadline compliance.

## Key Capabilities

### Suspicious Transaction Reporting (STR)

- **Automated Detection:** The service consumes transaction events, account events, and KYC risk signals to compute a real-time risk score for each customer. Transactions exhibiting patterns associated with money laundering, structuring, or terrorist financing automatically generate an STR workflow.
- **Pattern Library:** The detection engine uses a configurable pattern library including: rapid cash cycling, structuring (breaking up deposits below LCTR threshold), sudden unexplained wealth, high-value transactions inconsistent with customer profile, transactions involving high-risk jurisdictions.
- **STR Workflow:** STR candidates are routed to the compliance team's review queue. A compliance officer must review and either approve (file with FINTRAC) or dismiss (document reasoning). Approved STRs are transmitted to FINTRAC via the secure FINTRAC eServices portal within the legally required timeframe.
- **Record Retention:** All STR records (filed and dismissed) are retained for 5 years with the full evidence package.

### Large Cash Transaction Reporting (LCTR)

- Cash transactions (deposits or withdrawals) of CAD $10,000 or more within a 24-hour period must be reported to FINTRAC. The service automatically detects and files LCTRs.
- The LCTR includes customer identification information, account details, transaction details, and the purpose of the transaction (collected at time of transaction via customer attestation).
- Filing occurs within the 15-business-day window prescribed by PCMLTFA regulations.

### Electronic Funds Transfer Reporting (EFTR)

- International electronic funds transfers of CAD $10,000 or more must be reported. The service detects qualifying transfers and files EFTRs with FINTRAC.

### CSA (Canadian Securities Administrators) Reporting

- **Trade Reporting:** Large trader position thresholds and short-selling obligations are monitored. The service files required reports to applicable CSA members (OSC, AMF, etc.).
- **NI 31-103 Compliance:** Annual compliance reports and registration filings are managed and submitted to CSA.
- **SEDAR+ Filings:** For investment fund products, required filings to SEDAR+ are tracked and scheduled.

### Compliance Dashboard

- Real-time monitoring of all pending regulatory obligations (STRs in review, LCTRs due, EFTR queue).
- Filing deadline tracker: displays days remaining to each regulatory deadline with amber/red alerts at 7 and 2 days.
- Compliance officer workqueue: prioritised list of transactions requiring manual review.
- Audit log viewer: searchable log of all compliance officer decisions with timestamps and reasoning notes.

### Regulatory Change Tracking

- The service maintains a regulatory obligation registry: a structured list of all active reporting obligations, their legal basis, filing frequency, deadline rules, and system dependencies.
- When regulatory requirements change (new FINTRAC guidance, revised PCMLTFA thresholds), the compliance team updates the obligation registry which propagates alerting threshold changes to the detection engine.

## Data Handled

- Transaction events from Trading Engine (all account transactions)
- KYC risk scores and PEP/sanctions flags from KYC Service
- Customer identification data (for STR/LCTR customer information fields)
- STR and LCTR records (in FINTRAC XML schema)
- Filing submission receipts and FINTRAC acknowledgements
- Compliance officer decision log (decisions, timestamps, reasoning)
- Regulatory obligation registry

## Regulatory Touchpoints

### FINTRAC (Financial Transactions and Reports Analysis Centre of Canada)

- **PCMLTFA Section 7 — STR Filing:** Wealthsimple must file an STR when there are reasonable grounds to suspect a transaction is related to money laundering or terrorist financing. The service enforces the legal obligation to file within strict timeframes (no specific statutory deadline, but the "reasonable grounds" test is ongoing).
- **PCMLTFA Section 12 — LCTR Filing:** Mandatory within 15 business days of a qualifying large cash transaction. The service's automated detection and scheduling guarantees this deadline is met.
- **PCMLTFA Section 9.5 — Record Retention:** All records supporting STRs and LCTRs must be retained for 5 years after the day the transaction occurred.
- **Tipping Off Prohibition (Section 8):** The STR workflow enforces a strict access control policy to prevent customer notification that an STR has been filed (tipping off is a criminal offence under PCMLTFA).

### CSA (Canadian Securities Administrators)

- **NI 23-101 — Trade Reporting:** Post-trade transparency obligations for applicable security types.
- **NI 31-103 — Registration Requirements and Exemptions:** Annual compliance reporting requirements for investment dealers and advisers.
- **NI 45-106 — Prospectus Exemptions:** Private placement reporting requirements for applicable offering types.

### OSFI (Office of the Superintendent of Financial Institutions)

- **B-8 Guideline — Deterring and Detecting Money Laundering:** OSFI expectations for AML program governance, including escalation procedures for STRs.

## API Endpoints

- `POST /api/v1/compliance/str/review` — Submit an STR candidate for compliance officer review
- `GET /api/v1/compliance/str/{str_id}` — Retrieve STR details and filing status
- `POST /api/v1/compliance/lctr/file` — Trigger LCTR filing for a qualifying transaction
- `GET /api/v1/compliance/dashboard` — Retrieve compliance officer dashboard state
- `GET /api/v1/compliance/obligations` — Retrieve regulatory obligation registry
- `GET /api/v1/compliance/filings` — Retrieve filing history and deadline status

## Integration Points

- **KYC Service:** Receives PEP, sanctions, and risk score updates to feed STR detection engine.
- **Trading Engine:** Consumes all transaction events for pattern detection and LCTR/EFTR threshold checks.
- **Notifications Service:** Alerts compliance officers of new STR candidates and approaching filing deadlines (internal notifications only — never customer-facing for STRs).
- **Auth Service:** Compliance dashboard access restricted to users with `compliance-officer` role.

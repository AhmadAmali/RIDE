# KYC (Know Your Customer) Service

## Purpose

The KYC Service is the authoritative identity verification platform for Wealthsimple. It owns the end-to-end customer onboarding lifecycle, including identity document collection, biometric verification, politically exposed persons (PEP) and sanctions screening, beneficial ownership determination, and ongoing monitoring for existing customers.

Every new account opening at Wealthsimple is gated by the KYC Service. No trading, withdrawal, or account funding is permitted until the KYC Service sets a customer's identity status to `VERIFIED`.

## Key Capabilities

### Identity Verification

- **Document Collection:** Accepts government-issued identity documents (passport, driver's licence, provincial ID card) via mobile SDK and web upload. Supports 190+ countries. Documents are validated for authenticity using optical character recognition (OCR) and document template matching.
- **Biometric Liveness Check:** Customers perform a selfie capture that is compared against the facial image on the submitted identity document using a third-party liveness detection provider. Spoof attempts (printed photos, digital screens) are rejected.
- **Address Verification:** Customers provide a proof-of-address document (utility bill, bank statement, government letter) dated within 90 days. Address is cross-referenced against credit bureau data.
- **SIN Validation:** Canadian Social Insurance Number is validated via ECAS (Employment and Social Development Canada) lookup for TFSA and RRSP account types.

### PEP and Sanctions Screening

- **Politically Exposed Persons (PEP):** All new customers are screened against domestic and foreign PEP lists at onboarding. PEP-flagged accounts require enhanced due diligence (EDD) review by the compliance team before activation.
- **Sanctions Lists:** Customer names and addresses are screened against OFAC SDN, UN Security Council Consolidated List, Canadian SEMA designations, and the OSFI consolidated list. Screening runs at onboarding and nightly batch refresh.
- **Adverse Media:** Automated adverse media screening checks for negative news associating the customer with financial crimes, terrorism, or fraud.

### Beneficial Ownership

- For corporate accounts, the KYC Service collects and stores information on all beneficial owners (individuals owning ≥25% of voting shares). Each beneficial owner undergoes the same individual KYC process. A corporate structure chart is persisted for audit purposes.

### Ongoing Monitoring

- Customer risk profiles are reassessed quarterly. Changes in transaction patterns, new PEP/sanctions list entries, or adverse media hits trigger an automated re-screening workflow that may escalate to manual compliance review.
- Customer data changes (address, name, SIN) require re-verification within 30 days.

## Data Handled

- Full legal name, date of birth, residential address, SIN
- Identity document images (encrypted at rest, AES-256)
- Biometric facial templates (deleted after verification, not persisted)
- PEP/sanctions screening results and audit trail
- Risk score and risk category (low, medium, high)
- Account type eligibility flags (TFSA, RRSP, taxable, crypto)

## Regulatory Touchpoints

### PCMLTFA (Proceeds of Crime (Money Laundering) and Terrorist Financing Act)

- **Section 9.1 — Customer Identification:** Wealthsimple is a money services business reporting entity under PCMLTFA. The KYC Service satisfies the mandatory customer identification obligation by verifying identity using approved methods (government-issued photo ID + biometric match) as specified in the PCMLTFA regulations.
- **Section 9.3 — Enhanced Due Diligence:** When a customer is identified as a PEP or as posing a higher risk of ML/TF, the KYC Service triggers an EDD workflow requiring additional documentation and compliance officer approval.
- **Section 9.6 — Beneficial Ownership:** For corporate customers, the KYC Service captures beneficial ownership information as required.

### FINTRAC Guidelines

- **Guideline 6G — Customer Due Diligence:** The KYC Service implements all FINTRAC-mandated CDD procedures, including the identification of customers using prescribed methods, verification within specified timeframes, and ongoing monitoring.
- **Guideline 7 — Reporting Suspicious Transactions:** KYC risk flags feed into the Compliance Reporting Service's STR workflow.
- **Record Retention:** All identity verification records are retained for 5 years following account closure, satisfying FINTRAC's record-keeping requirements.

### OSFI Guidance

- The KYC Service implements OSFI's guidance on managing model risk for identity verification models, including ongoing performance monitoring of the biometric provider.

## API Endpoints

- `POST /api/v1/kyc/identity-check` — Initiate identity verification for a new customer
- `GET /api/v1/kyc/status/{customer_id}` — Retrieve current KYC status and risk score
- `POST /api/v1/kyc/documents` — Upload identity or address verification document
- `POST /api/v1/kyc/beneficial-owners` — Submit beneficial ownership declaration for a corporate account
- `GET /api/v1/kyc/screening-results/{customer_id}` — Retrieve PEP/sanctions screening results
- `PUT /api/v1/kyc/risk-profile/{customer_id}` — Update customer risk profile after EDD review
- `POST /api/v1/kyc/re-verify` — Trigger re-verification for an existing customer

## Integration Points

- **Auth Service:** KYC status gates account creation flow; Auth Service checks KYC status before issuing production-tier JWT tokens.
- **Trading Engine:** Trading Engine validates KYC status before accepting any order. Orders from customers with non-VERIFIED KYC status are rejected at the entry point.
- **Compliance Reporting Service:** KYC risk flags and PEP designations are published to the Compliance Reporting Service for STR/LTR triggering logic.
- **Notifications Service:** Sends identity verification status updates, document rejection notices, and EDD request notifications to customers.

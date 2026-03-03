# Tax Reporting Service

## Purpose

The Tax Reporting Service generates and delivers all customer-facing and regulator-facing tax documentation for Wealthsimple. It is the authoritative system for adjusted cost base (ACB) tracking, T-slip generation, foreign income and withholding tax calculations, and registered account contribution room management.

Tax documents produced by this service are filed electronically with the Canada Revenue Agency (CRA) and delivered to customers annually, with interim updates available year-round via the customer portal.

## Key Capabilities

### Adjusted Cost Base (ACB) Tracking

- Every taxable account trade event emitted by the Trading Engine is consumed and used to update the running ACB for each security held in each taxable account.
- ACB calculations follow the CRA's identical properties averaging rule (all units of the same security in the same account pool at the average cost).
- Corporate actions (stock splits, reverse splits, mergers, spin-offs, return of capital distributions) are handled via a corporate actions processor that adjusts historical ACB records accordingly.
- The ACB engine reconstructs the full history if prior-period events are updated retroactively (e.g., late corporate action processing or trade correction).

### T-Slip Generation

- **T5 (Statement of Investment Income):** Generated for taxable accounts receiving dividends, interest income, or foreign income totaling ≥$50 in a calendar year.
- **T3 (Statement of Trust Income):** Generated for ETF and mutual fund distributions.
- **T5008 (Statement of Securities Transactions):** Generated for all dispositions in taxable accounts, reporting proceeds of disposition, ACB, and resulting gain/loss.
- **RRSP Contribution Receipt:** Generated for each RRSP contribution within the calendar year and first 60 days of the following year.
- **NR4 (Non-Resident Tax Withholding):** Generated for non-resident customers receiving Canadian-source income subject to withholding tax.

### Foreign Income and Withholding Tax

- Dividends from US-listed securities are subject to 15% US withholding tax under the Canada-US Tax Treaty (reduced to 0% in RRSP accounts per Article XXI(7)).
- The service tracks withholding tax deducted per security per account and reports the foreign tax paid on applicable T-slips to enable customers to claim the foreign tax credit.
- Currency conversion for foreign-currency transactions uses the Bank of Canada daily exchange rates sourced at the time of transaction.

### Registered Account Contribution Room

- **TFSA:** Real-time TFSA contribution room is tracked per customer. Contributions and withdrawals are monitored. The service prevents over-contributions by communicating available room to the Trading Engine before order acceptance.
- **RRSP:** RRSP contribution room is updated when CRA provides the Notice of Assessment. The service stores the authoritative contribution limit and tracks contributions made during the year.
- **FHSA (First Home Savings Account):** Annual $8,000 contribution limit and lifetime $40,000 limit are tracked. Unused room carries forward (max $16,000 per year with carryforward).

### CRA Electronic Filing

- All T-slip types are filed electronically with CRA via the CRA T-slip Internet File Transfer (IFT) portal. Filing occurs for the prior calendar year by the statutory deadline (last day of February).
- NR4 slips for non-resident withholding must be filed by March 31.
- The service maintains a filing status ledger tracking which slips have been filed, amended, or cancelled.

## Data Handled

- Trade records from Trading Engine (all dispositions, income events)
- ACB history per (account, security) pair
- Dividend, interest, and distribution records
- Foreign tax withheld per transaction
- TFSA/RRSP/FHSA contribution and withdrawal history
- CRA filing records, amendment history, and confirmation receipts
- T-slip XML data packages (CRA format)

## Regulatory Touchpoints

### CRA (Canada Revenue Agency) Requirements

- **T-slip Deadlines:** T5 slips due by the last day of February for the preceding calendar year. T5008 slips due by the last day of February. Failure to file or late filing attracts penalties under ITA Section 162.
- **ACB Reporting Accuracy:** CRA requires that T5008 slips accurately report ACB and proceeds of disposition. Incorrect ACB reporting creates customer audit risk. The service must correctly handle all corporate actions.
- **RRSP Over-Contribution:** Over-contributions to RRSPs incur a 1% per month penalty under ITA Section 204.2. The service must prevent over-contributions and report accurately to customers.
- **TFSA Over-Contribution:** Over-contributions to TFSAs incur a 1% per month penalty under ITA Section 207.02. Real-time room tracking is mandatory.

### Tax Treaty Obligations

- The Canada-US Tax Treaty (Article XXI) exempts RRSP-held US securities from US withholding tax. The service must correctly identify the account type when reporting and settling foreign withholding.
- Treaty-reduced withholding rates apply for customers in treaty jurisdictions (UK, France, Germany, etc.). The service applies the correct treaty rate based on customer tax residency.

### Privacy Requirements

- Tax documents contain highly sensitive personal information (SIN, full income details). All data is encrypted at rest (AES-256) and in transit (TLS 1.3). T-slip XML packages transmitted to CRA use CRA-mandated TLS configurations.

## API Endpoints

- `GET /api/v1/tax/slips/{customer_id}/{tax_year}` — Retrieve all T-slips for a customer and tax year
- `GET /api/v1/tax/acb/{account_id}/{security_id}` — Retrieve ACB history for a security
- `GET /api/v1/tax/contribution-room/{customer_id}` — Retrieve TFSA/RRSP/FHSA contribution room
- `POST /api/v1/tax/acb/recalculate` — Trigger ACB recalculation for corporate action processing
- `GET /api/v1/tax/filing-status/{tax_year}` — Retrieve CRA filing status for all slips in a tax year

## Integration Points

- **Trading Engine:** Consumes all trade fill and income events to update ACB and trigger T-slip generation.
- **Notifications Service:** Delivers T-slip availability notices, contribution limit alerts, and CRA filing confirmation to customers.
- **Auth Service:** Access to tax documents requires authenticated customer session with tax-read scope.

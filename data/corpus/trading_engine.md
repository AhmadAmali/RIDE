# Trading Engine Service

## Purpose

The Trading Engine is the core order execution platform for Wealthsimple. It handles equity, ETF, and cryptocurrency order management, routes orders to execution venues, manages portfolio state, enforces suitability constraints, and produces the canonical trade record that downstream systems (tax reporting, compliance reporting) consume.

The Trading Engine is the highest-throughput service in the Wealthsimple platform, processing hundreds of thousands of order events per day across all account types (TFSA, RRSP, FHSA, taxable, crypto).

## Key Capabilities

### Order Management

- **Order Types:** Market, limit, stop-loss, stop-limit orders for equities and ETFs. Market and limit orders for cryptocurrency. Fractional share orders are supported for all Canadian-listed securities.
- **Order Lifecycle States:** `PENDING` → `ACCEPTED` → `ROUTING` → `PARTIALLY_FILLED` → `FILLED` | `CANCELLED` | `REJECTED`.
- **Pre-Trade Checks:** Before accepting an order, the Trading Engine enforces: (1) account funding sufficiency check, (2) KYC status verification via KYC Service, (3) suitability check against investor risk profile and product suitability rules, (4) market hours and halt status validation, (5) account type eligibility (e.g., derivatives not permitted in registered accounts).
- **Post-Trade Processing:** Executed trades trigger position updates, cost-basis adjustments, and events published to Tax Reporting and Compliance Reporting services.

### Order Routing

- Orders are routed to execution venues via smart order routing (SOR) that minimises execution cost. Equity and ETF orders are routed to Canadian securities exchanges (TSX, TSXV) and US exchanges (NYSE, NASDAQ) via FIX protocol. Cryptocurrency orders are routed to internal liquidity pools and external exchange APIs.
- The SOR applies best-execution logic: price, speed, and likelihood of fill are weighted to select the venue offering the best effective spread for the order size.

### Portfolio Management

- Real-time portfolio positions are maintained per account. Position updates occur synchronously on trade fill confirmation.
- Portfolio valuations are computed using last-traded prices and FX rates refreshed every 60 seconds.
- The Trading Engine exposes portfolio state via internal gRPC API consumed by the frontend.

### Suitability Engine

- Each product (security or cryptocurrency) is categorised by risk level (1–5). Each customer account is associated with an investor risk profile determined during onboarding.
- Before every order is accepted, the suitability engine checks whether the product's risk level is within the account's permitted range. Orders outside suitability parameters are rejected with a specific suitability rejection code.
- Suitability rules are version-controlled and audited. Rule changes require compliance sign-off.

### Trade Settlement

- Equity and ETF trades settle T+1 (as of CIRO rule change effective May 2024). Cryptocurrency trades settle immediately.
- Settlement processing interfaces with the National Securities Clearing Corporation (NSCC) and The Canadian Depository for Securities (CDS) via DTCC/CDS connectivity layer.

## Data Handled

- Order records (order_id, account_id, security_id, quantity, price, order_type, status, timestamps)
- Fill records (fill_id, order_id, fill_quantity, fill_price, venue, execution_timestamp)
- Portfolio positions per account (position_id, account_id, security_id, quantity, avg_cost_basis)
- Transaction records (canonical trade events consumed by Tax Reporting and Compliance Reporting)
- Suitability check results and rejection logs

## Regulatory Touchpoints

### CIRO (Canadian Investment Regulatory Organization) Rules

- **Best Execution Obligation:** CIRO rules require Wealthsimple to seek best execution on behalf of clients. The SOR's best-execution logic directly implements this obligation. The Trading Engine maintains a best-execution policy and annual best-execution report.
- **Suitability Obligation:** CIRO rules require that each order accepted is suitable for the account type and customer risk profile. The suitability engine enforces these requirements at the pre-trade check stage.
- **Order Handling Rules:** CIRO Rule 3800 governs order handling, priority, and protection requirements. The Trading Engine's matching and routing logic complies with these rules.
- **T+1 Settlement:** CIRO and NSCC settlement cycle changes to T+1 (effective May 2024) are implemented in the settlement module.

### Trade Reporting

- All executed trades must be reported to applicable trade repositories within required timeframes. The Compliance Reporting Service consumes trade events from the Trading Engine to fulfil post-trade transparency obligations.
- IIROC (now CIRO) market integrity rules require reporting of short sale transactions and large trader position thresholds.

### Registered Account Rules (CRA)

- The Trading Engine enforces registered account contribution limits (TFSA, RRSP, FHSA) by communicating with the Tax Reporting Service. Orders that would cause an over-contribution are rejected with a specific error code.
- Prohibited investments in registered accounts (as defined by ITA section 207.01) are blocked by the suitability engine.

## API Endpoints

- `POST /api/v1/orders` — Submit a new order
- `GET /api/v1/orders/{order_id}` — Retrieve order status and fill details
- `DELETE /api/v1/orders/{order_id}` — Cancel a pending order
- `GET /api/v1/portfolio/{account_id}` — Retrieve current portfolio positions and values
- `GET /api/v1/portfolio/{account_id}/transactions` — Retrieve transaction history
- `POST /api/v1/suitability/check` — Run a pre-trade suitability check without submitting

## Integration Points

- **KYC Service:** Pre-trade KYC status check on every order submission.
- **Tax Reporting Service:** Receives trade fill events to update ACB and generate T-slip data.
- **Compliance Reporting Service:** Receives all trade events for post-trade reporting obligations.
- **Notifications Service:** Sends order confirmation, fill notifications, and suitability rejection messages to customers.

#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  PRIME ALPHA SECURITIES — DynamoDB Full Seed Script
#
#  Inserts realistic sample data across all 10 tables.
#  Run this on your EC2 instance (IAM role handles auth automatically),
#  or locally with a configured AWS profile.
#
#  USAGE:
#    export AWS_REGION=us-east-1        # match your Terraform deployment region
#    bash dynamodb-seed-examples.sh
#
#  Or copy-paste individual sections for a single table.
#
#  TABLES:
#    1.  investor            PK: investorId
#    2.  portfolios          PK: portfolioId
#    3.  documents           PK: docId
#    4.  workers             PK: workerId
#    5.  calendar            PK: eventId
#    6.  pe_companies        PK: dealId
#    7.  credit_application  PK: appId
#    8.  real_estate         PK: assetId
#    9.  articles            PK: articleId
#    10. enquiries           PK: enquiryId
# ═══════════════════════════════════════════════════════════════════════════

set -e
REGION="${AWS_REGION:-us-east-1}"
echo ""
echo "  Prime Alpha Securities — DynamoDB Seed"
echo "  Region: $REGION"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 1. INVESTOR
#    Each investor can log in to the Investor Portal.
#    password: plain text used for demo login only.
#    aum / pnl / cumulativePnl: stored as strings, the app formats them.
#    strategy: Multi-Strategy | Private Equity | Private Credit | Real Estate | Diversified
#    risk: Conservative | Moderate | Aggressive
# ─────────────────────────────────────────────────────────────────────────────
echo "--- 1. investor ---"

aws dynamodb put-item --region "$REGION" --table-name investor --item '{
  "investorId":    {"S": "c001"},
  "name":          {"S": "Meridian Endowment Fund"},
  "email":         {"S": "investor@meridianfund.com"},
  "password":      {"S": "demo1234"},
  "phone":         {"S": "+1 212 555 0101"},
  "joinDate":      {"S": "2021-03-15"},
  "term":          {"S": "10 years"},
  "aum":           {"S": "48500000"},
  "pnl":           {"S": "1240000"},
  "cumulativePnl": {"S": "8750000"},
  "strategy":      {"S": "Multi-Strategy"},
  "risk":          {"S": "Moderate"},
  "status":        {"S": "active"}
}'
echo "  c001 - Meridian Endowment Fund"

aws dynamodb put-item --region "$REGION" --table-name investor --item '{
  "investorId":    {"S": "c002"},
  "name":          {"S": "Vantage Family Office"},
  "email":         {"S": "family@vantagefamilyoffice.com"},
  "password":      {"S": "demo1234"},
  "phone":         {"S": "+1 646 555 0202"},
  "joinDate":      {"S": "2020-07-01"},
  "term":          {"S": "7 years"},
  "aum":           {"S": "31200000"},
  "pnl":           {"S": "870000"},
  "cumulativePnl": {"S": "5400000"},
  "strategy":      {"S": "Private Equity"},
  "risk":          {"S": "Aggressive"},
  "status":        {"S": "active"}
}'
echo "  c002 - Vantage Family Office"

aws dynamodb put-item --region "$REGION" --table-name investor --item '{
  "investorId":    {"S": "c003"},
  "name":          {"S": "Cypress Sovereign Trust"},
  "email":         {"S": "trust@cypresssovereign.com"},
  "password":      {"S": "demo1234"},
  "phone":         {"S": "+44 20 7946 0303"},
  "joinDate":      {"S": "2022-01-10"},
  "term":          {"S": "12 years"},
  "aum":           {"S": "72000000"},
  "pnl":           {"S": "2100000"},
  "cumulativePnl": {"S": "4300000"},
  "strategy":      {"S": "Diversified"},
  "risk":          {"S": "Conservative"},
  "status":        {"S": "active"}
}'
echo "  c003 - Cypress Sovereign Trust"

aws dynamodb put-item --region "$REGION" --table-name investor --item '{
  "investorId":    {"S": "c004"},
  "name":          {"S": "Harrington Capital Partners"},
  "email":         {"S": "contact@harringtoncap.com"},
  "password":      {"S": "demo1234"},
  "phone":         {"S": "+1 617 555 0404"},
  "joinDate":      {"S": "2023-04-20"},
  "term":          {"S": "5 years"},
  "aum":           {"S": "15800000"},
  "pnl":           {"S": "390000"},
  "cumulativePnl": {"S": "390000"},
  "strategy":      {"S": "Private Credit"},
  "risk":          {"S": "Moderate"},
  "status":        {"S": "active"}
}'
echo "  c004 - Harrington Capital Partners"

aws dynamodb put-item --region "$REGION" --table-name investor --item '{
  "investorId":    {"S": "c005"},
  "name":          {"S": "Nordic Institutional AB"},
  "email":         {"S": "allocations@nordicinstitutional.se"},
  "password":      {"S": "demo1234"},
  "phone":         {"S": "+46 8 555 0505"},
  "joinDate":      {"S": "2019-11-30"},
  "term":          {"S": "15 years"},
  "aum":           {"S": "120000000"},
  "pnl":           {"S": "4800000"},
  "cumulativePnl": {"S": "31500000"},
  "strategy":      {"S": "Real Estate"},
  "risk":          {"S": "Moderate"},
  "status":        {"S": "active"}
}'
echo "  c005 - Nordic Institutional AB"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 2. PORTFOLIOS
#    One portfolio per investor. investorId links back to the investor table.
#    allocations: JSON string array of { "name": string, "pct": number }.
#    The app parses this string to render the allocation bar chart.
# ─────────────────────────────────────────────────────────────────────────────
echo "--- 2. portfolios ---"

aws dynamodb put-item --region "$REGION" --table-name portfolios --item '{
  "portfolioId": {"S": "port_c001"},
  "investorId":  {"S": "c001"},
  "name":        {"S": "Meridian Multi-Strategy Portfolio"},
  "totalValue":  {"S": "48500000"},
  "asOf":        {"S": "2024-06-30"},
  "allocations": {"S": "[{\"name\":\"Private Equity\",\"pct\":35},{\"name\":\"Private Credit\",\"pct\":30},{\"name\":\"Real Estate\",\"pct\":25},{\"name\":\"Cash\",\"pct\":10}]"}
}'
echo "  port_c001 - Meridian (35 PE / 30 Credit / 25 RE / 10 Cash)"

aws dynamodb put-item --region "$REGION" --table-name portfolios --item '{
  "portfolioId": {"S": "port_c002"},
  "investorId":  {"S": "c002"},
  "name":        {"S": "Vantage Growth Portfolio"},
  "totalValue":  {"S": "31200000"},
  "asOf":        {"S": "2024-06-30"},
  "allocations": {"S": "[{\"name\":\"Private Equity\",\"pct\":65},{\"name\":\"Private Credit\",\"pct\":20},{\"name\":\"Cash\",\"pct\":15}]"}
}'
echo "  port_c002 - Vantage (65 PE / 20 Credit / 15 Cash)"

aws dynamodb put-item --region "$REGION" --table-name portfolios --item '{
  "portfolioId": {"S": "port_c003"},
  "investorId":  {"S": "c003"},
  "name":        {"S": "Cypress Sovereign Diversified"},
  "totalValue":  {"S": "72000000"},
  "asOf":        {"S": "2024-06-30"},
  "allocations": {"S": "[{\"name\":\"Real Estate\",\"pct\":40},{\"name\":\"Private Credit\",\"pct\":30},{\"name\":\"Private Equity\",\"pct\":20},{\"name\":\"Cash\",\"pct\":10}]"}
}'
echo "  port_c003 - Cypress (40 RE / 30 Credit / 20 PE / 10 Cash)"

aws dynamodb put-item --region "$REGION" --table-name portfolios --item '{
  "portfolioId": {"S": "port_c004"},
  "investorId":  {"S": "c004"},
  "name":        {"S": "Harrington Credit-Focused"},
  "totalValue":  {"S": "15800000"},
  "asOf":        {"S": "2024-06-30"},
  "allocations": {"S": "[{\"name\":\"Private Credit\",\"pct\":75},{\"name\":\"Cash\",\"pct\":25}]"}
}'
echo "  port_c004 - Harrington (75 Credit / 25 Cash)"

aws dynamodb put-item --region "$REGION" --table-name portfolios --item '{
  "portfolioId": {"S": "port_c005"},
  "investorId":  {"S": "c005"},
  "name":        {"S": "Nordic Real Estate and Credit"},
  "totalValue":  {"S": "120000000"},
  "asOf":        {"S": "2024-06-30"},
  "allocations": {"S": "[{\"name\":\"Real Estate\",\"pct\":55},{\"name\":\"Private Credit\",\"pct\":30},{\"name\":\"Private Equity\",\"pct\":10},{\"name\":\"Cash\",\"pct\":5}]"}
}'
echo "  port_c005 - Nordic (55 RE / 30 Credit / 10 PE / 5 Cash)"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 3. DOCUMENTS
#    Visible to investors in the Portal under Documents and R&D tabs.
#    type: Quarterly Report | Annual Report | Capital Call |
#          Distribution Notice | Tax Document | Research | Update
#    status: Final | Draft | Pending
# ─────────────────────────────────────────────────────────────────────────────
echo "--- 3. documents ---"

aws dynamodb put-item --region "$REGION" --table-name documents --item '{
  "docId":       {"S": "doc_001"},
  "investorId":  {"S": "c001"},
  "title":       {"S": "Q2 2024 Portfolio Report"},
  "type":        {"S": "Quarterly Report"},
  "date":        {"S": "2024-07-15"},
  "status":      {"S": "Final"},
  "description": {"S": "Full portfolio performance review for Q2 2024 including NAV, IRR, and deal updates across all asset classes."},
  "fileUrl":     {"S": ""},
  "tags":        {"S": "quarterly,report,2024"}
}'
echo "  doc_001 - Q2 2024 Portfolio Report (c001)"

aws dynamodb put-item --region "$REGION" --table-name documents --item '{
  "docId":       {"S": "doc_002"},
  "investorId":  {"S": "c001"},
  "title":       {"S": "Capital Call Notice - NovaTech Add-On"},
  "type":        {"S": "Capital Call"},
  "date":        {"S": "2024-05-20"},
  "status":      {"S": "Final"},
  "description": {"S": "Capital call for $1.2M to fund the NovaTech bolt-on acquisition. Due date: 15 June 2024."},
  "fileUrl":     {"S": ""},
  "tags":        {"S": "capital-call,novatech,pe"}
}'
echo "  doc_002 - Capital Call Notice (c001)"

aws dynamodb put-item --region "$REGION" --table-name documents --item '{
  "docId":       {"S": "doc_003"},
  "investorId":  {"S": "c002"},
  "title":       {"S": "2023 Annual Report and Audited Accounts"},
  "type":        {"S": "Annual Report"},
  "date":        {"S": "2024-03-31"},
  "status":      {"S": "Final"},
  "description": {"S": "Full-year 2023 performance review, audited financial statements, and 2024 strategic outlook."},
  "fileUrl":     {"S": ""},
  "tags":        {"S": "annual,report,audited,2023"}
}'
echo "  doc_003 - 2023 Annual Report (c002)"

aws dynamodb put-item --region "$REGION" --table-name documents --item '{
  "docId":       {"S": "doc_004"},
  "investorId":  {"S": "c003"},
  "title":       {"S": "Q1 2024 Distribution Notice"},
  "type":        {"S": "Distribution Notice"},
  "date":        {"S": "2024-04-10"},
  "status":      {"S": "Final"},
  "description": {"S": "Distribution of $840,000 from the partial realisation of the Greenleaf Logistics position."},
  "fileUrl":     {"S": ""},
  "tags":        {"S": "distribution,greenleaf,q1-2024"}
}'
echo "  doc_004 - Q1 Distribution Notice (c003)"

aws dynamodb put-item --region "$REGION" --table-name documents --item '{
  "docId":       {"S": "doc_005"},
  "investorId":  {"S": "c005"},
  "title":       {"S": "2023 K-1 Tax Document"},
  "type":        {"S": "Tax Document"},
  "date":        {"S": "2024-03-15"},
  "status":      {"S": "Final"},
  "description": {"S": "Schedule K-1 for tax year 2023. Please forward to your tax advisor promptly."},
  "fileUrl":     {"S": ""},
  "tags":        {"S": "tax,k1,2023"}
}'
echo "  doc_005 - K-1 Tax Document (c005)"

aws dynamodb put-item --region "$REGION" --table-name documents --item '{
  "docId":       {"S": "doc_006"},
  "investorId":  {"S": "c001"},
  "title":       {"S": "Real Estate Portfolio Update - H1 2024"},
  "type":        {"S": "Update"},
  "date":        {"S": "2024-07-01"},
  "status":      {"S": "Final"},
  "description": {"S": "Operational update covering occupancy rates, NOI performance, and capex plans across all three real estate assets."},
  "fileUrl":     {"S": ""},
  "tags":        {"S": "real-estate,update,h1-2024"}
}'
echo "  doc_006 - RE Portfolio Update (c001)"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 4. WORKERS
#    Team members who log in to the Worker Portal.
#    password: plain text used for demo login only.
#    Workers seeded here appear in calendar assignment and email dropdowns.
#    role: Portfolio Manager | Credit Analyst | Associate | Analyst |
#          Vice President | Managing Director | Operations | Compliance
#    dept: Investments | Private Credit | Private Equity | Real Estate |
#          Operations | Technology | Compliance | Finance
# ─────────────────────────────────────────────────────────────────────────────
echo "--- 4. workers ---"

aws dynamodb put-item --region "$REGION" --table-name workers --item '{
  "workerId": {"S": "w001"},
  "name":     {"S": "Alexandra Renard"},
  "email":    {"S": "worker@primealphasecurities.com"},
  "password": {"S": "worker123"},
  "phone":    {"S": "+12125550101"},
  "role":     {"S": "Portfolio Manager"},
  "dept":     {"S": "Investments"},
  "joinedAt": {"S": "2019-06-01"}
}'
echo "  w001 - Alexandra Renard (Portfolio Manager)"

aws dynamodb put-item --region "$REGION" --table-name workers --item '{
  "workerId": {"S": "w002"},
  "name":     {"S": "James Okafor"},
  "email":    {"S": "james@primealphasecurities.com"},
  "password": {"S": "worker123"},
  "phone":    {"S": "+12125550202"},
  "role":     {"S": "Credit Analyst"},
  "dept":     {"S": "Private Credit"},
  "joinedAt": {"S": "2021-02-15"}
}'
echo "  w002 - James Okafor (Credit Analyst)"

aws dynamodb put-item --region "$REGION" --table-name workers --item '{
  "workerId": {"S": "w003"},
  "name":     {"S": "Sophie Martin"},
  "email":    {"S": "sophie@primealphasecurities.com"},
  "password": {"S": "worker123"},
  "phone":    {"S": "+442071234567"},
  "role":     {"S": "Vice President"},
  "dept":     {"S": "Private Equity"},
  "joinedAt": {"S": "2018-09-10"}
}'
echo "  w003 - Sophie Martin (VP, Private Equity)"

aws dynamodb put-item --region "$REGION" --table-name workers --item '{
  "workerId": {"S": "w004"},
  "name":     {"S": "Marcus Webb"},
  "email":    {"S": "marcus@primealphasecurities.com"},
  "password": {"S": "worker123"},
  "phone":    {"S": "+12025550404"},
  "role":     {"S": "Associate"},
  "dept":     {"S": "Real Estate"},
  "joinedAt": {"S": "2022-07-18"}
}'
echo "  w004 - Marcus Webb (Associate, Real Estate)"

aws dynamodb put-item --region "$REGION" --table-name workers --item '{
  "workerId": {"S": "w005"},
  "name":     {"S": "Yuki Tanaka"},
  "email":    {"S": "yuki@primealphasecurities.com"},
  "password": {"S": "worker123"},
  "phone":    {"S": "+81312345678"},
  "role":     {"S": "Managing Director"},
  "dept":     {"S": "Investments"},
  "joinedAt": {"S": "2015-03-01"}
}'
echo "  w005 - Yuki Tanaka (Managing Director)"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 5. CALENDAR
#    Team events shown in the Worker Portal Calendar tab.
#    members: JSON string array of workerIds from the workers table.
#    Workers in members receive an SES email notification when the
#    event is created through the app UI (not when seeded via CLI).
# ─────────────────────────────────────────────────────────────────────────────
echo "--- 5. calendar ---"

aws dynamodb put-item --region "$REGION" --table-name calendar --item '{
  "eventId": {"S": "ev001"},
  "date":    {"S": "2024-07-15"},
  "title":   {"S": "IC Meeting - NovaTech Q2 Review"},
  "members": {"S": "[\"w001\",\"w002\"]"}
}'
echo "  ev001 - IC Meeting NovaTech (w001, w002)"

aws dynamodb put-item --region "$REGION" --table-name calendar --item '{
  "eventId": {"S": "ev002"},
  "date":    {"S": "2024-07-22"},
  "title":   {"S": "Client Call - Meridian Endowment Fund"},
  "members": {"S": "[\"w001\",\"w005\"]"}
}'
echo "  ev002 - Client Call Meridian (w001, w005)"

aws dynamodb put-item --region "$REGION" --table-name calendar --item '{
  "eventId": {"S": "ev003"},
  "date":    {"S": "2024-07-30"},
  "title":   {"S": "Due Diligence Site Visit - Greenleaf Logistics"},
  "members": {"S": "[\"w002\",\"w004\"]"}
}'
echo "  ev003 - DD Site Visit Greenleaf (w002, w004)"

aws dynamodb put-item --region "$REGION" --table-name calendar --item '{
  "eventId": {"S": "ev004"},
  "date":    {"S": "2024-08-05"},
  "title":   {"S": "Quarterly LP Update - Board Presentation"},
  "members": {"S": "[\"w001\",\"w003\",\"w005\"]"}
}'
echo "  ev004 - LP Board Presentation (w001, w003, w005)"

aws dynamodb put-item --region "$REGION" --table-name calendar --item '{
  "eventId": {"S": "ev005"},
  "date":    {"S": "2024-08-12"},
  "title":   {"S": "Credit Committee - Horizon Manufacturing Review"},
  "members": {"S": "[\"w002\",\"w005\"]"}
}'
echo "  ev005 - Credit Committee Horizon (w002, w005)"

aws dynamodb put-item --region "$REGION" --table-name calendar --item '{
  "eventId": {"S": "ev006"},
  "date":    {"S": "2024-08-19"},
  "title":   {"S": "New Investor Onboarding - Nordic Institutional AB"},
  "members": {"S": "[\"w001\",\"w003\"]"}
}'
echo "  ev006 - Investor Onboarding Nordic (w001, w003)"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 6. PE_COMPANIES
#    Private equity deals tracked in the Worker Portal PE Pipeline tab.
#    stage: pipeline | dd | offer | owned | sold
#    sector: Technology | Healthcare | Industrials | Consumer |
#            Financial Services | Energy | Real Assets | Other
#    Leave irr, moic, entryDate blank for deals not yet closed.
# ─────────────────────────────────────────────────────────────────────────────
echo "--- 6. pe_companies ---"

aws dynamodb put-item --region "$REGION" --table-name pe_companies --item '{
  "dealId":       {"S": "pe_001"},
  "name":         {"S": "NovaTech Solutions"},
  "sector":       {"S": "Technology"},
  "stage":        {"S": "owned"},
  "invested":     {"S": "12000000"},
  "currentValue": {"S": "19400000"},
  "irr":          {"S": "24.3"},
  "moic":         {"S": "1.62"},
  "entryDate":    {"S": "2021-09-01"},
  "exitDate":     {"S": ""},
  "location":     {"S": "Austin, TX"},
  "description":  {"S": "B2B SaaS platform serving mid-market logistics and supply chain operators. ARR of $8.4M growing 38% YoY."},
  "assignedTo":   {"S": "w001"}
}'
echo "  pe_001 - NovaTech Solutions (owned, 1.62x)"

aws dynamodb put-item --region "$REGION" --table-name pe_companies --item '{
  "dealId":       {"S": "pe_002"},
  "name":         {"S": "Greenleaf Logistics Group"},
  "sector":       {"S": "Industrials"},
  "stage":        {"S": "dd"},
  "invested":     {"S": "0"},
  "currentValue": {"S": "0"},
  "irr":          {"S": ""},
  "moic":         {"S": ""},
  "entryDate":    {"S": ""},
  "exitDate":     {"S": ""},
  "location":     {"S": "Chicago, IL"},
  "description":  {"S": "Regional third-party logistics provider with 14 warehouses across the Midwest. EBITDA of $6.2M. Management seeking growth capital."},
  "assignedTo":   {"S": "w003"}
}'
echo "  pe_002 - Greenleaf Logistics (due diligence)"

aws dynamodb put-item --region "$REGION" --table-name pe_companies --item '{
  "dealId":       {"S": "pe_003"},
  "name":         {"S": "Apex Clinics Holdings"},
  "sector":       {"S": "Healthcare"},
  "stage":        {"S": "offer"},
  "invested":     {"S": "0"},
  "currentValue": {"S": "0"},
  "irr":          {"S": ""},
  "moic":         {"S": ""},
  "entryDate":    {"S": ""},
  "exitDate":     {"S": ""},
  "location":     {"S": "Dallas, TX"},
  "description":  {"S": "Multi-site specialist clinic operator in orthopaedics and physical therapy. 22 locations across Texas and Oklahoma. LOI submitted at 9.2x EBITDA."},
  "assignedTo":   {"S": "w001"}
}'
echo "  pe_003 - Apex Clinics (offer submitted)"

aws dynamodb put-item --region "$REGION" --table-name pe_companies --item '{
  "dealId":       {"S": "pe_004"},
  "name":         {"S": "Solaris Renewables Ltd"},
  "sector":       {"S": "Energy"},
  "stage":        {"S": "sold"},
  "invested":     {"S": "8500000"},
  "currentValue": {"S": "17900000"},
  "irr":          {"S": "31.7"},
  "moic":         {"S": "2.11"},
  "entryDate":    {"S": "2019-04-15"},
  "exitDate":     {"S": "2023-11-30"},
  "location":     {"S": "Phoenix, AZ"},
  "description":  {"S": "Utility-scale solar developer and operator. Exited via strategic sale to a European infrastructure fund at a 2.11x gross MOIC."},
  "assignedTo":   {"S": "w005"}
}'
echo "  pe_004 - Solaris Renewables (exited, 2.11x)"

aws dynamodb put-item --region "$REGION" --table-name pe_companies --item '{
  "dealId":       {"S": "pe_005"},
  "name":         {"S": "ClearPath Technologies"},
  "sector":       {"S": "Technology"},
  "stage":        {"S": "pipeline"},
  "invested":     {"S": "0"},
  "currentValue": {"S": "0"},
  "irr":          {"S": ""},
  "moic":         {"S": ""},
  "entryDate":    {"S": ""},
  "exitDate":     {"S": ""},
  "location":     {"S": "Boston, MA"},
  "description":  {"S": "Cybersecurity SaaS business focused on financial services compliance. Preliminary NDA signed. Model review in progress."},
  "assignedTo":   {"S": "w003"}
}'
echo "  pe_005 - ClearPath Technologies (pipeline)"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 7. CREDIT_APPLICATION
#    Loan applications submitted via the Public Site Private Credit page.
#    type: business | individual
#    loanType: secured | unsecured
#    status: pending | reviewing | approved | declined
# ─────────────────────────────────────────────────────────────────────────────
echo "--- 7. credit_application ---"

aws dynamodb put-item --region "$REGION" --table-name credit_application --item '{
  "appId":        {"S": "app_001"},
  "type":         {"S": "business"},
  "loanType":     {"S": "secured"},
  "name":         {"S": "Horizon Manufacturing Ltd"},
  "email":        {"S": "cfo@horizonmfg.com"},
  "phone":        {"S": "+1 312 555 0198"},
  "amount":       {"S": "5000000"},
  "purpose":      {"S": "Working capital facility to support a 3-year expansion into the Southeast US market, including two new production facilities."},
  "availability": {"S": "Weekdays 10am-4pm EST"},
  "submittedAt":  {"S": "2024-07-10T14:22:00Z"},
  "status":       {"S": "reviewing"}
}'
echo "  app_001 - Horizon Manufacturing $5M (reviewing)"

aws dynamodb put-item --region "$REGION" --table-name credit_application --item '{
  "appId":        {"S": "app_002"},
  "type":         {"S": "individual"},
  "loanType":     {"S": "secured"},
  "name":         {"S": "Richard Ashworth"},
  "email":        {"S": "r.ashworth@privatemail.com"},
  "phone":        {"S": "+44 7700 900123"},
  "amount":       {"S": "2500000"},
  "purpose":      {"S": "Bridge facility secured against a Grade II listed residential property in Knightsbridge, pending exchange of contracts on a commercial sale."},
  "availability": {"S": "Flexible, prefer morning calls GMT"},
  "submittedAt":  {"S": "2024-07-03T09:45:00Z"},
  "status":       {"S": "approved"}
}'
echo "  app_002 - Richard Ashworth 2.5M bridge (approved)"

aws dynamodb put-item --region "$REGION" --table-name credit_application --item '{
  "appId":        {"S": "app_003"},
  "type":         {"S": "business"},
  "loanType":     {"S": "unsecured"},
  "name":         {"S": "Kestrel Digital Agency"},
  "email":        {"S": "finance@kestreldigital.io"},
  "phone":        {"S": "+1 415 555 0311"},
  "amount":       {"S": "750000"},
  "purpose":      {"S": "Revenue-based financing to fund a product development sprint and US sales expansion. Recurring ARR of $2.1M growing 60% YoY."},
  "availability": {"S": "Any day after 2pm PT"},
  "submittedAt":  {"S": "2024-06-28T17:10:00Z"},
  "status":       {"S": "pending"}
}'
echo "  app_003 - Kestrel Digital $750K unsecured (pending)"

aws dynamodb put-item --region "$REGION" --table-name credit_application --item '{
  "appId":        {"S": "app_004"},
  "type":         {"S": "business"},
  "loanType":     {"S": "secured"},
  "name":         {"S": "Atlas Construction Group"},
  "email":        {"S": "treasury@atlasconstruction.com"},
  "phone":        {"S": "+1 404 555 0712"},
  "amount":       {"S": "18000000"},
  "purpose":      {"S": "Senior secured construction loan for a 220-unit mixed-use residential development in Atlanta, GA. Full planning permission granted. Pre-sales at 40%."},
  "availability": {"S": "Mon-Thu 9am-6pm EST"},
  "submittedAt":  {"S": "2024-07-12T11:30:00Z"},
  "status":       {"S": "reviewing"}
}'
echo "  app_004 - Atlas Construction $18M (reviewing)"

aws dynamodb put-item --region "$REGION" --table-name credit_application --item '{
  "appId":        {"S": "app_005"},
  "type":         {"S": "individual"},
  "loanType":     {"S": "secured"},
  "name":         {"S": "Priya Mehta"},
  "email":        {"S": "priya.mehta@outlook.com"},
  "phone":        {"S": "+65 9123 4567"},
  "amount":       {"S": "3200000"},
  "purpose":      {"S": "Margin facility secured against a diversified portfolio of listed equities and fixed income instruments held at a prime broker in Singapore."},
  "availability": {"S": "SGT business hours preferred"},
  "submittedAt":  {"S": "2024-07-01T06:20:00Z"},
  "status":       {"S": "declined"}
}'
echo "  app_005 - Priya Mehta $3.2M margin (declined)"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 8. REAL_ESTATE
#    Assets tracked in the Worker Portal Real Estate tab.
#    type: Logistics | Office | Multifamily | Retail | Mixed-Use |
#          Industrial | Hotel | Land
#    status: development | owned | sold
#    occupancy: percentage as string, e.g. "94" means 94%
# ─────────────────────────────────────────────────────────────────────────────
echo "--- 8. real_estate ---"

aws dynamodb put-item --region "$REGION" --table-name real_estate --item '{
  "assetId":       {"S": "re_001"},
  "name":          {"S": "Metropolitan Logistics Hub"},
  "type":          {"S": "Logistics"},
  "location":      {"S": "Newark, NJ"},
  "status":        {"S": "owned"},
  "purchasePrice": {"S": "28000000"},
  "currentValue":  {"S": "34200000"},
  "irr":           {"S": "14.2"},
  "occupancy":     {"S": "97"},
  "sqft":          {"S": "420000"},
  "purchaseDate":  {"S": "2020-11-01"},
  "description":   {"S": "Last-mile logistics facility with a 15-year triple-net lease to an investment-grade e-commerce tenant. Annual rent escalations of 2.5%."}
}'
echo "  re_001 - Metropolitan Logistics Hub 97% occ"

aws dynamodb put-item --region "$REGION" --table-name real_estate --item '{
  "assetId":       {"S": "re_002"},
  "name":          {"S": "Riverside Multifamily Phase I"},
  "type":          {"S": "Multifamily"},
  "location":      {"S": "Austin, TX"},
  "status":        {"S": "owned"},
  "purchasePrice": {"S": "42000000"},
  "currentValue":  {"S": "51800000"},
  "irr":           {"S": "16.8"},
  "occupancy":     {"S": "94"},
  "sqft":          {"S": "310000"},
  "purchaseDate":  {"S": "2021-06-15"},
  "description":   {"S": "280-unit Class A multifamily in East Austin. Strong rental demand driven by tech sector migration. Value-add programme completed on 85% of units."}
}'
echo "  re_002 - Riverside Multifamily Austin 94% occ"

aws dynamodb put-item --region "$REGION" --table-name real_estate --item '{
  "assetId":       {"S": "re_003"},
  "name":          {"S": "Canary Wharf Commercial Tower"},
  "type":          {"S": "Office"},
  "location":      {"S": "London, UK"},
  "status":        {"S": "owned"},
  "purchasePrice": {"S": "95000000"},
  "currentValue":  {"S": "102400000"},
  "irr":           {"S": "9.4"},
  "occupancy":     {"S": "88"},
  "sqft":          {"S": "185000"},
  "purchaseDate":  {"S": "2019-03-22"},
  "description":   {"S": "Grade A office building in Canary Wharf with a WAULT of 6.2 years. Anchor tenant is a Tier 1 investment bank. One floor currently under lease-up."}
}'
echo "  re_003 - Canary Wharf Office 88% occ"

aws dynamodb put-item --region "$REGION" --table-name real_estate --item '{
  "assetId":       {"S": "re_004"},
  "name":          {"S": "Sunbelt Industrial Park"},
  "type":          {"S": "Industrial"},
  "location":      {"S": "Phoenix, AZ"},
  "status":        {"S": "development"},
  "purchasePrice": {"S": "14500000"},
  "currentValue":  {"S": "18200000"},
  "irr":           {"S": ""},
  "occupancy":     {"S": "0"},
  "sqft":          {"S": "640000"},
  "purchaseDate":  {"S": "2023-10-01"},
  "description":   {"S": "640,000 sqft multi-tenant industrial park under development. Projected delivery Q3 2025. Pre-leasing underway with three LOIs signed for 60% of space."}
}'
echo "  re_004 - Sunbelt Industrial Park (development)"

aws dynamodb put-item --region "$REGION" --table-name real_estate --item '{
  "assetId":       {"S": "re_005"},
  "name":          {"S": "Collins Street Mixed-Use"},
  "type":          {"S": "Mixed-Use"},
  "location":      {"S": "Melbourne, Australia"},
  "status":        {"S": "sold"},
  "purchasePrice": {"S": "38000000"},
  "currentValue":  {"S": "54600000"},
  "irr":           {"S": "18.1"},
  "occupancy":     {"S": "100"},
  "sqft":          {"S": "92000"},
  "purchaseDate":  {"S": "2017-08-10"},
  "description":   {"S": "Retail and residential mixed-use on Collins Street. Sold off-market to a domestic REIT in March 2024 at an exit cap rate of 4.8%."}
}'
echo "  re_005 - Collins Street Melbourne (sold, 18.1% IRR)"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 9. ARTICLES
#    Shown on the public Research page and Investor R&D tab.
#    category: Private Credit | Private Equity | Real Estate |
#              Macro | Fixed Income | ESG | Technology
#    visibility: public (shown on public site) | investor (portal only)
# ─────────────────────────────────────────────────────────────────────────────
echo "--- 9. articles ---"

aws dynamodb put-item --region "$REGION" --table-name articles --item '{
  "articleId":  {"S": "a001"},
  "title":      {"S": "The Private Credit Opportunity in a Higher-Rate Environment"},
  "date":       {"S": "2024-06-01"},
  "author":     {"S": "James Okafor"},
  "category":   {"S": "Private Credit"},
  "excerpt":    {"S": "Rising base rates have materially improved the risk-adjusted returns available in direct lending, creating a compelling entry point for institutional allocators seeking yield with downside protection."},
  "content":    {"S": "Full article body text goes here."},
  "tags":       {"S": "credit,rates,direct-lending"},
  "visibility": {"S": "public"}
}'
echo "  a001 - Private Credit Opportunity (public)"

aws dynamodb put-item --region "$REGION" --table-name articles --item '{
  "articleId":  {"S": "a002"},
  "title":      {"S": "Control Buyouts in Healthcare: Structural Tailwinds and Underwriting Discipline"},
  "date":       {"S": "2024-05-10"},
  "author":     {"S": "Sophie Martin"},
  "category":   {"S": "Private Equity"},
  "excerpt":    {"S": "Demographic ageing, regulatory complexity, and fragmented ownership structures continue to generate attractive buyout opportunities in healthcare services, but disciplined underwriting remains essential in a higher-cost environment."},
  "content":    {"S": "Full article body text goes here."},
  "tags":       {"S": "private-equity,healthcare,buyout"},
  "visibility": {"S": "public"}
}'
echo "  a002 - Healthcare Buyouts (public)"

aws dynamodb put-item --region "$REGION" --table-name articles --item '{
  "articleId":  {"S": "a003"},
  "title":      {"S": "Macro Regime Shifts and Portfolio Construction"},
  "date":       {"S": "2024-04-15"},
  "author":     {"S": "Alexandra Renard"},
  "category":   {"S": "Macro"},
  "excerpt":    {"S": "Higher-for-longer interest rate environments fundamentally alter the correlation structure between asset classes, requiring institutional allocators to rethink traditional 60/40 frameworks in favour of alternatives with genuine diversification properties."},
  "content":    {"S": "Full article body text goes here."},
  "tags":       {"S": "macro,portfolio-construction,rates,alternatives"},
  "visibility": {"S": "public"}
}'
echo "  a003 - Macro Regime Shifts (public)"

aws dynamodb put-item --region "$REGION" --table-name articles --item '{
  "articleId":  {"S": "a004"},
  "title":      {"S": "Logistics Real Estate: The Long-Term Case Beyond E-Commerce"},
  "date":       {"S": "2024-03-20"},
  "author":     {"S": "Marcus Webb"},
  "category":   {"S": "Real Estate"},
  "excerpt":    {"S": "While the pandemic-era e-commerce surge has normalised, structural demand for modern logistics space driven by nearshoring, cold chain requirements, and last-mile delivery remains robust across primary and secondary US markets."},
  "content":    {"S": "Full article body text goes here."},
  "tags":       {"S": "real-estate,logistics,industrial"},
  "visibility": {"S": "public"}
}'
echo "  a004 - Logistics Real Estate (public)"

aws dynamodb put-item --region "$REGION" --table-name articles --item '{
  "articleId":  {"S": "a005"},
  "title":      {"S": "Q2 2024 Portfolio Review - Investor Briefing"},
  "date":       {"S": "2024-07-10"},
  "author":     {"S": "Yuki Tanaka"},
  "category":   {"S": "Private Equity"},
  "excerpt":    {"S": "Detailed performance review of the Prime Alpha portfolio for Q2 2024, including NAV movements, deal updates across all asset classes, and revised full-year return guidance for LPs."},
  "content":    {"S": "Full article body text goes here."},
  "tags":       {"S": "investor-update,q2-2024,performance"},
  "visibility": {"S": "investor"}
}'
echo "  a005 - Q2 Portfolio Review (investor only)"

aws dynamodb put-item --region "$REGION" --table-name articles --item '{
  "articleId":  {"S": "a006"},
  "title":      {"S": "ESG Integration in Private Markets: Beyond Box-Ticking"},
  "date":       {"S": "2024-02-28"},
  "author":     {"S": "Sophie Martin"},
  "category":   {"S": "ESG"},
  "excerpt":    {"S": "Sophisticated LP bases increasingly demand substantive ESG integration rather than surface-level disclosure. We outline how Prime Alpha embeds environmental, social, and governance criteria at every stage of the deal lifecycle."},
  "content":    {"S": "Full article body text goes here."},
  "tags":       {"S": "esg,responsible-investing,lp-relations"},
  "visibility": {"S": "public"}
}'
echo "  a006 - ESG Integration (public)"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 10. ENQUIRIES
#     Logs for contact form submissions AND emails sent from the Worker Portal.
#     type: contact | worker-email
#     subject values for contact type: IR | media | credit | careers | other
# ─────────────────────────────────────────────────────────────────────────────
echo "--- 10. enquiries ---"

aws dynamodb put-item --region "$REGION" --table-name enquiries --item '{
  "enquiryId":   {"S": "enq_001"},
  "type":        {"S": "contact"},
  "name":        {"S": "David Chen"},
  "email":       {"S": "d.chen@pacificpension.org"},
  "org":         {"S": "Pacific Pension Authority"},
  "subject":     {"S": "IR"},
  "message":     {"S": "We are a $2.4B public pension fund currently building out an alternatives allocation. We are exploring PE and private credit managers for a combined $150M mandate. Could we arrange an introductory call with your investor relations team?"},
  "submittedAt": {"S": "2024-07-08T09:15:00Z"}
}'
echo "  enq_001 - David Chen / Pacific Pension (IR)"

aws dynamodb put-item --region "$REGION" --table-name enquiries --item '{
  "enquiryId":   {"S": "enq_002"},
  "type":        {"S": "contact"},
  "name":        {"S": "Francesca Ricci"},
  "email":       {"S": "f.ricci@financialtimes.com"},
  "org":         {"S": "Financial Times"},
  "subject":     {"S": "media"},
  "message":     {"S": "I am writing a feature on private credit market dynamics for the FT. Would Prime Alpha be willing to provide a comment or participate in a brief interview on the direct lending outlook for H2 2024?"},
  "submittedAt": {"S": "2024-07-05T14:30:00Z"}
}'
echo "  enq_002 - Francesca Ricci / FT (media)"

aws dynamodb put-item --region "$REGION" --table-name enquiries --item '{
  "enquiryId":   {"S": "enq_003"},
  "type":        {"S": "contact"},
  "name":        {"S": "Tariq Al-Mansouri"},
  "email":       {"S": "t.almansouri@gccwealth.ae"},
  "org":         {"S": "GCC Wealth Management"},
  "subject":     {"S": "IR"},
  "message":     {"S": "On behalf of a GCC-based family office with approximately $600M in investable assets, we are seeking introductions to top-tier US and European alternative asset managers with a focus on real estate and private credit strategies."},
  "submittedAt": {"S": "2024-07-02T07:45:00Z"}
}'
echo "  enq_003 - Tariq Al-Mansouri / GCC Wealth (IR)"

aws dynamodb put-item --region "$REGION" --table-name enquiries --item '{
  "enquiryId":   {"S": "enq_004"},
  "type":        {"S": "contact"},
  "name":        {"S": "Laura Fischer"},
  "email":       {"S": "laura.fischer@hotmail.com"},
  "org":         {"S": ""},
  "subject":     {"S": "careers"},
  "message":     {"S": "I am a second-year MBA student at INSEAD with a background in leveraged finance at Deutsche Bank. I am very interested in a summer associate position on your private credit team."},
  "submittedAt": {"S": "2024-06-25T11:00:00Z"}
}'
echo "  enq_004 - Laura Fischer (careers)"

aws dynamodb put-item --region "$REGION" --table-name enquiries --item '{
  "enquiryId":   {"S": "enq_005"},
  "type":        {"S": "worker-email"},
  "to":          {"S": "investor@meridianfund.com"},
  "subject":     {"S": "Q2 2024 Portfolio Report - Now Available"},
  "body":        {"S": "Dear Meridian team, your Q2 2024 portfolio report is now available in the Documents tab of your investor portal. Key highlights: NAV up 4.8% QoQ, NovaTech EBITDA growth ahead of plan, Metropolitan Logistics Hub occupancy at 97%. Please do not hesitate to reach out with any questions. Best regards, Alexandra Renard"},
  "sentAt":      {"S": "2024-07-15T10:00:00Z"},
  "sentBy":      {"S": "Alexandra Renard"}
}'
echo "  enq_005 - Outbound email to Meridian (worker-email)"

aws dynamodb put-item --region "$REGION" --table-name enquiries --item '{
  "enquiryId":   {"S": "enq_006"},
  "type":        {"S": "contact"},
  "name":        {"S": "Michael Strand"},
  "email":       {"S": "m.strand@nordicpe.se"},
  "org":         {"S": "Nordic PE Advisors"},
  "subject":     {"S": "other"},
  "message":     {"S": "We are advising a Scandinavian industrial company exploring a partial secondary sale of a 15% stake. EBITDA of EUR 12M, precision engineering sector. Would Prime Alpha have interest in co-investing alongside the existing sponsor?"},
  "submittedAt": {"S": "2024-07-11T13:20:00Z"}
}'
echo "  enq_006 - Michael Strand / Nordic PE (co-invest)"
echo ""

echo "======================================================================="
echo "  Seed complete.  $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
echo "  USEFUL COMMANDS"
echo ""
echo "  Scan a full table:"
echo "    aws dynamodb scan --region $REGION --table-name workers"
echo ""
echo "  Get one item by primary key:"
echo "    aws dynamodb get-item --region $REGION --table-name investor \\"
echo "      --key '{\"investorId\":{\"S\":\"c001\"}}'"
echo ""
echo "  Count items in a table:"
echo "    aws dynamodb scan --region $REGION --table-name pe_companies \\"
echo "      --select COUNT --query 'Count'"
echo ""
echo "  Delete one item:"
echo "    aws dynamodb delete-item --region $REGION --table-name calendar \\"
echo "      --key '{\"eventId\":{\"S\":\"ev001\"}}'"
echo ""
echo "  Update a single field (e.g. approve a credit application):"
echo "    aws dynamodb update-item --region $REGION --table-name credit_application \\"
echo "      --key '{\"appId\":{\"S\":\"app_001\"}}' \\"
echo "      --update-expression 'SET #s = :v' \\"
echo "      --expression-attribute-names '{\"#s\":\"status\"}' \\"
echo "      --expression-attribute-values '{\":v\":{\"S\":\"approved\"}}'"
echo "======================================================================="

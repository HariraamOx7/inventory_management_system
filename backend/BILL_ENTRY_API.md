# Bill Entry API

Base path: `/api/bill-entries` (local default: `http://localhost:5000`).
Every endpoint requires `Authorization: Bearer <token>` from `POST /api/auth/login`.
Writes require an active `admin`, `manager`, or `operator` account.
Send JSON request bodies with `Content-Type: application/json`.

| Method | Path relative to base | Purpose |
| --- | --- | --- |
| GET | `/` | List bills with their details |
| GET | `/:voucherNo` | Fetch one bill with items and linked gate inwards; 404 if missing |
| GET | `/by-party?partyCode=SUP001` | List bills for a supplier |
| POST | `/` | Create a bill; returns 201 with the generated `VoucherNo` in `data` |
| PUT | `/:voucherNo` | Update a bill |
| DELETE | `/:voucherNo` | Delete a bill, subject to reference checks |
| GET | `/available-parties?includeCodes=true` | Suppliers with unbilled receipts |
| GET | `/available-grns?partyCode=SUP001` | Unbilled receipts for a supplier; optional `gateInwardNo` |
| GET | `/grn-details?grnNo=261001` | Receipt details to populate a new bill |
| GET | `/available-gate-inwards?partyCode=SUP001` | Available gate inwards (legacy helper) |
| GET | `/last-voucher-no` | Last voucher number; creation assigns the new number |
| GET | `/check-duplicate?partyCode=SUP001&partyBillNo=INV-001` | Check supplier invoice duplication |
| GET | `/print-data/:voucherNo` | Bill print data and tax breakdown |

Prefer `partyCode` to identify a supplier unambiguously. Party lookup helpers also
accept the legacy `partyName` query parameter.

## Create example

Replace these illustrative identifiers with a real unbilled GRN, its supplier,
and an item from that receipt. Use `/grn-details` to obtain the source items.

```http
POST /api/bill-entries
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "GRNNo": 261001,
  "PartyCode": "SUP001",
  "AccDate": "2026-11-17",
  "PartyBillNo": "INV-001",
  "BillDate": "2026-11-17",
  "Total": 1000,
  "BillAmount": 1000,
  "GrandTotal": 1000,
  "items": [
    { "ItemCode": "ITEM001", "Qty": 10, "UnitRate": 100, "TotalAmount": 1000 }
  ]
}
```

`GRNNo`, supplier identity, and a nonempty `items` array are required. Item
quantities must be positive and cannot exceed the received quantities. Include
`OrderNo` on items when needed to distinguish receipt lines for the same item.
The server derives `GateInwardNo` from the receipt when omitted. Optional fields
include `PurchaseType`, `TDS`, `Narration`, `Discount`, `GST`, `IGST`, `VAT_CST`,
`P_F`, `LorryFreight`, `RoundOff`, and `TaxRndOff`. Submit the intended financial
totals explicitly; the current controller stores them rather than calculating
the header totals from the items.

Successful reads return `{ "success": true, "data": ... }`. Errors return
`success: false` with a `message` and sometimes `error`. Invalid source data
returns 400, authentication failures return 401, and unauthorized writes return
403. Duplicate supplier invoice numbers return 409; already billed GRNs may
return 400 or 409 depending on which duplicate check detects them.

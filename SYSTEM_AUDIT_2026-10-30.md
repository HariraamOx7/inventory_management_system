# Stores audit - 30 October 2026

**Final result: all 10 suites passed. Changes are local and have not been deployed.**

## Reproduce

From `backend`, run `node scripts/run-system-audits.cjs`.

The runner checks actual exit codes and saves per-suite logs. Database writes use disposable schemas. The migration suite copies the configured local database into a separate temporary schema, excluding user accounts, and removes the copy afterward. CREATE/DROP DATABASE privileges are required. Existing business records are not changed.

Latest result: [full-system-audit-results.json](backend/scripts/full-system-audit-results.json).

## Final automated coverage

| Suite | Result | Coverage |
| --- | --- | --- |
| CRUD/routes | 173 checks passed | 28 model persistence scenarios, successful controller CRUD for 20 business modules, invalid/missing-record requests for all 83 mounted write routes |
| System/stock | 148 checks passed | 124 HTTP GET routes, including 50 report endpoints; rollback, batch aggregation, recovery, stock valuation, cascades, permissions, simultaneous inward submissions |
| HTTP edge cases | 409 checks passed | Eight text-key masters; slash, percent, punctuation, Unicode and leading-zero identities; malformed bodies/rows; numeric boundaries; pagination; dates; filter escaping; anonymous/viewer restrictions across every business write route; login/password change; linked-record deletion; concurrent receipts/bills; source-party consistency; billing limits; zero-stock and partial-issue boundaries |
| Full HTTP workflows | 74 checks passed | Actual create/edit/list-reload/delete requests for all 20 business modules; header/detail persistence; stock changes; five report-total reconciliations; CSV partial-success reporting; automatic codes and sequence gaps; operator/manager access |
| Receipt regression | 4 case groups passed | Create/reload, header-only recovery, empty-update rejection, failed-write rollback |
| Item identities | 3 tests passed | Exact legacy codes, leading zeros, unique name fallback, ambiguous-name rejection |
| Migration/stock copy | 10 tests passed | August historical controls; verified October 26 balances; current report agreement; recorded cost after PO price changes; reversal; rejection of unverified ledger changes |
| Rounding | Passed | Disabled rounding preserves paise; payable totals reconcile at boundary values |
| Frontend lint | Passed | Zero errors and zero warnings |
| Frontend build | Passed | Production build succeeds; bundle-size and outdated browser-data advisories remain |

Counts are named scenario executions, not exhaustive combinations or unique line coverage. The fresh synthetic schema intentionally lacks historical opening balances: the historical department report must return 422 there instead of inventing totals. Successful historical reporting is checked separately on the migration copy.

## Browser verification

22 business screens were opened using a disposable API/database. These were navigation/render checks; every control on every screen was not exercised.

Actual UI workflows checked:

- Item: edit a slash-containing code, reload to confirm persistence, then delete the disposable item.
- Receipt: choose supplier/PO, load products, save, verify the PO number in the list, reload and edit with products still present. A fractional rate saved an amount of 25.49 with zero round off.
- Supplier: edit a slash-containing PartyCode and create without a manually supplied code.
- GP Item Master: edit a slash-containing item code.
- Bill Entry: create, reload and edit two same-name products with different codes, quantities and rates. A database assertion verified both exact item codes and rates survived.
- Voucher export: download through Print, render and visually inspect. A discounted fixture preserved payable 79.49, displayed discount 0.51 separately, and showed balanced 80.00 totals.

Evidence: [ui-audit-results.json](backend/scripts/ui-audit-results.json), [receipt reload](backend/scripts/ui-receipt-reload-verified.png), [item deletion](backend/scripts/ui-item-delete-verified.png), [supplier creation](backend/scripts/ui-supplier-create-verified.png), [same-name bill products](backend/scripts/ui-bill-duplicate-names-verified.png).

## Confirmed defects fixed

1. Raw text identifiers in edit/delete URLs broke slash-containing codes. Eight text-key master APIs and UIs now use query identities. Item deletion no longer decodes percent escapes twice.
2. Supplier UI used `AccCode` while the API returns `PartyCode`. Edit/delete identities and list keys are corrected. Supplier creation now generates a collision-retried code when none is supplied.
3. Bill Entry discarded ItemCode while loading/saving. It now preserves exact codes; PO selection distinguishes duplicate names by code. Ambiguous name-only lookup rejects instead of choosing an arbitrary item.
4. Bill/PO/gate-pass saves could leave partial headers or lose old detail rows on failure. Header/detail writes and normal deletes are transactional.
5. Invalid quantities, field types, dates and pagination could be accepted or cause server/SQL errors. Shared validation rejects these cases; database conflicts use appropriate client status codes.
6. Item Issue edit/delete restored stock by name or the newly selected department. Restoration now follows the original item code, with stock row locks.
7. Inwards trusted browser pending quantities. The server checks actual PO membership and remaining balances under a PO lock, including repeated lines and concurrent saves. Same-PO invoice batches can be edited.
8. Simultaneous receipt/bill submissions could create duplicates. Creation now locks the owner and repeats duplicate checks within the transaction.
9. Referenced masters/upstream documents could be deleted, leaving dangling links. Regular deletion and partial cascade selections now protect retained dependants.
10. PO/bill cascades failed to reverse recorded stock value; bill deletion could lose the PO reference before cleanup. Reversal, reference capture and verification cleanup are transactional. Shared multi-PO inwards are protected from deleting another PO's goods.
11. Removing issued goods from an inward could make stock negative. Such changes reject and roll back. Inward edits apply net quantity/value changes once to preserve valuation after partial issue.
12. Receipt/bill edits could switch away from their source supplier. Bills could include unrelated products or excess receipt quantity. These combinations now reject before persistence.
13. Viewer accounts could modify business data. The API now permits their reads and rejects writes.
14. Zero Round Off still rounded payable amounts. PO/receipt/bill calculations preserve paise when rounding is disabled. PO saves preserve summary rounding, and voucher output uses saved amounts and displays discounts with reconciled totals.
15. GP item code generation used row count and could return an occupied code after gaps. It now finds an available suffix.
16. Frontend unused declarations and effect-dependency findings are resolved. Report filter requests use stable callbacks and cancellation to avoid obsolete responses replacing current options.

## Existing local data findings

Read-only queries of local `stores` found **GRN 261047** and its **Bill Voucher 1045** have no saved product rows. These records were not altered and still need data review/repair.

The specific queries found no missing model columns, orphan receipt rows, receipt/bill products missing their item master, negative stock quantities, duplicate billed GRNs, or inward rows lacking recorded cost. See [local-data-audit-results.json](backend/scripts/local-data-audit-results.json).

The screenshot's GRN 261070 / GI 1062 was absent from the configured local application database, so its deployed data was not verified. Passing disposable-fixture tests does not repair existing incomplete records.

## Limits and deployment

This does not certify every possible input, browser/device, prolonged load, or transaction interleaving. Browser checks used a desktop viewport. CSV checks used parsed upload payloads, not every possible CSV format. Production configuration/data, backup/restore rehearsal and mobile/cross-browser testing remain unverified.

Deploy frontend and backend together: changed UIs require the new query-identity routes, middleware and services. Restart the backend and refresh the frontend. Retain existing environment settings and unrelated worktree changes.

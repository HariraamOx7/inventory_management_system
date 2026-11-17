# CRUD audit

## Combined regression runner

Run `node scripts/run-system-audits.cjs` from `backend` for the combined HTTP, boundary, stock, migration-copy, receipt, item-code, rounding, lint and build checks. Database writes use disposable schemas. See [the dated coverage report](../../SYSTEM_AUDIT_2026-10-30.md) for exact coverage and limitations. The older runners below remain useful individually and have narrower scopes.

`node scripts/crud-audit.cjs --inventory` lists mounted POST, PUT, PATCH and DELETE routes and reports those without scenarios. Inventory does not connect to the database. Routes are discovered from the Express routers mounted directly in server.js; changes to mounting conventions or nested routers require updating discovery.

To execute the implemented scenarios, first provision a **disposable**, isolated MySQL database with the same schema and required reference data as the application. Set `DB_NAME` to a name matching `stores_rehearsal_<name>` and set the other `DB_*` variables for that database. From `backend`, run:

```powershell
$env:DB_NAME = 'stores_rehearsal_crud'
node scripts/crud-audit.cjs
```

The script verifies that the connected database name matches, then tests create, update, delete, persistence and missing-field rejection for departments, UOMs, states and purchase types. It removes its identifiable fixtures, but an interrupted run or controller side effects can leave changes: discard the test database afterwards. Never point it at a production database, including a production database with a matching name. No database is created automatically.

The audit intentionally exits nonzero while routes are untested or a scenario fails. It does not verify authentication, HTTP middleware, UI, concurrency, stock workflows, all validation paths, or every database mutation. Add route-specific scenarios and assertions for each untested workflow before treating the system as fully checked. Controller calls bypass HTTP middleware. Existing migration tests can supplement this audit but are not automatically included.

## Expanded execution audit

Run `node scripts/operation-audit.cjs` from backend. It uses the configured MySQL host/user, creates a new `stores_rehearsal_audit_<timestamp>` schema, synchronizes the models, and drops only that generated schema after the run. CREATE/DROP DATABASE privileges are required. It does not use existing business records.

It exercises insert/read/update/delete persistence for all 28 models; successful controller CRUD scenarios for the 20 business modules; and an invalid-input or missing-record request for every mounted write route (67 at implementation time). The store scenarios deliberately use the router's actual `id` parameter. Business create failure prevents dependent update/delete checks for that module. Failures may identify an application defect or a fixture/schema mismatch and require review. Results are saved to `operation-audit-results.json`; exit status is nonzero for failed checks.

This is not exhaustive business validation. Successful authentication/password changes, bulk upload, code generation and cascade-delete paths still require dedicated scenarios. HTTP authentication/middleware, browser/mobile UI, concurrency, migrated production schema differences, stock-value invariants, every validation boundary and failure rollback behavior are not certified by this run. The successful CRUD checks invoke controllers directly and verify header persistence; detail rows and stock side effects need additional assertions. Model persistence checks are separate from controller checks.

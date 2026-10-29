# 见车 UX contract

## Business context

Source of truth: the user's request to implement the preceding used-car merchandising recommendations as a local React example. This standalone project uses synthetic inventory and model illustration photographs. It has no server, dealer integration, payments or real booking side effects. Personal contact data must stay in component memory only. Only vehicle favorites may be stored in localStorage.

## Canonical UI Map

| Capability     | Canonical owner                                                           | Source of truth | Allowed variants                                   | Verification               |
| -------------- | ------------------------------------------------------------------------- | --------------- | -------------------------------------------------- | -------------------------- |
| Select/Listbox | Native select in Filters, NeedsProfile and catalog sort                   | This contract   | native OS popup                                    | keyboard and browser tests |
| Date           | AppointmentDialog radio date options                                      | This contract   | next seven days, localized in Asia/Hong_Kong       | booking E2E                |
| Form           | AppointmentDialog inline validation; NeedsProfile optional native selects | This contract   | demo appointment; apply-on-submit preference draft | validation and success E2E |
| Scrollbar      | src/styles/tokens.css and global stylesheet                               | DESIGN.md       | compare horizontal scroll                          | mobile and computed styles |
| Toast          | Toast in App with one live region                                         | This contract   | info, success, warning                             | favorite/compare E2E       |

## Catalog

The finite eight-car example renders all matching cars. Filters, sort, city, category, and committed query are encoded in URL parameters with replaceState. Local search handles IME without submitting a composing Enter. Clear is explicit and restores input focus. Empty states retain controls and offer reset. Browser back/forward restores URL filters. Favorites are validated against current inventory; unavailable storage falls back to session state with a visible message. Budget means car price, excluding the separately displayed fees.

Compare selection persists while filtering and is bounded to three cars. Compare requires at least two cars; an additional selection shows a localized explanation. Prices and known required fees are displayed separately and totaled using integer yuan. Insurance and transport have no invented totals.

## Dialogs and detail

All overlays use a native modal dialog through the shared Modal component. Accessible title, focus placement, native background inertness, Escape and focus restoration are mandatory. Closing detail preserves all catalog and scrolling state. Changing from detail/compare to appointment closes the previous overlay so only one modal is active. All sources and defects are fictional; detail distinguishes inspected from pending and states that no-record is not proof of no-incident.

## Personalized recommendations and visit plans

Source: the user's 2026-10-30 request for needs-based recommendations, performed and outstanding checks, targeted buyer tests, sales cooperation, and possible subsequent costs.

`NeedsProfile` owns an optional draft for purpose, known-cost budget cap, passengers including driver, daily distance, charging availability and priority. Applying the draft updates recommendation ordering within existing filters and switches sort to recommended; explicit price/mileage sorting remains respected afterward. Clearing needs preserves filters and selected visit tasks. Needs stay in memory, never URL, storage or analytics, and refresh clears them. The native details disclosure restores focus to its summary after apply/clear.

The personalized budget includes car price plus disclosed service and transfer fees. It is not an all-in purchase quote; insurance, inspection, repairs and other unknown costs remain excluded and disclosed. This differs explicitly from the catalog's car-price-only budget bands. Seat counts are fictional attributes: 3–5 passengers require at least five seats, 6+ requires at least six. Budget and seating failures cannot be offset by preferences; their reasons appear before softer cautions. Nonmatching cars remain labeled alternatives. Ordering weights are not shown as match percentages or safety scores. Unknown charging, range, ownership costs and practical fit remain questions to verify.

`src/data/inspections.ts` owns explicit per-item fictional records; `InspectionRecords` displays recorded, attention, pending and unverified states with date/source. The listing-level inspected flag means report availability only, never all checks passed. Missing records remain pending. Tires and brakes are separate so a tire finding cannot imply that braking was checked. No report original or real vehicle evidence is available in this demo.

`VehicleGuidance` owns a per-car selectable visit checklist from `buildVisitTasks`. Each task states why, what the user can experience or verify, what sales should coordinate, and what costs need confirmation. Task IDs remain stable across preference changes; selections persist for that car in memory only. Professional vehicle and high-voltage checks belong to qualified personnel, not self-service instructions. Selecting a task is a communication preference, not confirmation of a completed check, merchant commitment or paid-service authorization.

Sales cooperation covers preparation of report originals and quotes, accompanied practical experience, independent results and repair/recheck decisions, then itemized delivery terms. Additional cost amounts are null when unknown, displayed as pending quote and never counted as zero or included in the known purchase subtotal. Trigger, quote/payee party, included-service status and payer agreement are disclosed; this is not a real merchant price list.

## Appointment

The UI calls this a demo appointment and explicitly offers 13800000000 as a test number. A vehicle, visit date, visit slot, test phone and acknowledgment of demo mode are required; optional name is not needed. Date values are calendar dates, not UTC timestamps. Options refresh when opened, at Hong Kong midnight and on visibility restoration; submit independently validates against the current next-seven-day window. Errors are field-associated, retain values and focus the first invalid field. Pending state prevents duplicate submission. Success shows “预约示例已生成” with the selected car and visit date. Applied needs and selected visit tasks are shown before submission and snapshotted for the local confirmation. A return-to-detail action allows checklist editing. There is no network request, telephone contact or persistent PII. A closed form keeps its draft in memory; reloading clears it. Closing during the brief simulated pending state is blocked. No arbitrary service-response promise or fabricated confirmed dealer reservation is made.

## Accessibility and layout

Native semantic controls, explicit Chinese labels, keyboard focus and responsive visibility are required. Native selects use OS-owned popups intentionally. The UI supports 390px and wider phone viewports, 1440px desktop and reduced motion. The document scrolls naturally; dialogs have independent bounded body scrolling. Horizontal overflow is confined to the comparison table. Status and validation do not depend on color alone.

## Evidence

Domain tests: src/lib/*.test.ts. Interaction and accessibility tests: tests/catalog.e2e.spec.ts and tests/personalization.e2e.spec.ts. Production verification: npm run typecheck, npm test, npm run build, npm run test:e2e. Test presence is not execution evidence; record blocked browser runs explicitly. Static premium audit is supplementary to runtime checks.

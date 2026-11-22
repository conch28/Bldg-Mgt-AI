# Asset registry standard

## What goes in the registry
Every piece of equipment that needs maintenance, can fail, or costs more than ₱10,000 to replace: lifts, generator, transformers, panels, fire pumps, jockey pumps, fire alarm panels, sprinkler valves, water pumps and tanks, aircon, CCTV and access control, lighting groups, solar, internet backbone. Small identical fixtures (e.g. hallway downlights) may be registered per area.

## Tags and QR labels
- Format: `TYPE-PLACE-N`, e.g. `FP-JOCKEY-1`, `EV-A1-DRIVE`, `LT-B12-HALL-2`. Letters, numbers and dashes only. Never reuse a tag.
- Print labels from **Data Center → Assets & QR → Print QR labels** and stick them next to the nameplate.
- The QR opens the asset page after sign-in, so a label shows nothing to outsiders. Guards and staff can see history, manual, schedule and open jobs, and report a fault.

## Criticality
| Level | Means | Examples | Required |
|---|---|---|---|
| SAFETY | Failure can hurt people or stop life-safety systems | Lifts, fire pumps, fire alarm, generator, gas | Make, model, serial, verified specs, linked schedule from a verified source |
| HIGH | Building stops working without it | Booster pumps, transformer, main panel, CCTV recorder | Make, model, serial, verified specs |
| NORMAL | Everything else | Lights, split aircon | Name, location, install date |

## Required fields
Tag, name, category, location, criticality, install date, expected life. For SAFETY and HIGH also manufacturer, model, serial, spec source, replacement cost, responsible person.

## Verification
1. Photograph the nameplate (or use the manual or invoice).
2. Enter or import the specs, with the spec source.
3. A second person compares the record with the source and taps **Verify specs**.
4. Any later change to make, model, serial, criticality or life clears the verification.

## Never
- Invent specifications. Leave a field blank and let the check flag it.
- Treat AI-read nameplates (phase 3) as verified until a person checks them.

# Clark data plan: every meter in, on time, at low cost

**Decisions (Marc, 23 Nov 2026):**
- Meters send a reading every 15 minutes, and critical alerts arrive within 5 minutes.
- The data lives on our own stack: Supabase Postgres with time-series tables, plus an open LoRaWAN network server.
- Phase 1 is this plan plus a Data health panel on `/green/clark`. Real ingestion code comes once a pilot signs.

Costs are indicative 2026 Philippine prices. Confirm them with suppliers before quoting.

---

## 1. The idea in one paragraph

Every reading takes one path: meter → network → one ingest endpoint → automatic checks → database → dashboards and alerts. Each meter has an expected interval, so the system always knows what *should* have arrived. Anything late, missing or doubtful becomes a named task with an owner and a deadline. That follows the same rule as the rest of the app: every record has an owner, a deadline, a checker and an escalation path. The numbers on screen can then be trusted, and savings reports use only real readings.

## 2. Refresh rate by source

| Source | Interval | Typical delay | How it gets in |
|---|---|---|---|
| Modbus gateway (existing digital meters, BMS, chillers) | 15 min (1 min buffered locally) | under 1 min | Gateway pushes over 4G or fibre |
| Clamp-on CT meter | 15 min | under 1 min | LoRaWAN to zone gateways |
| Water pulse reader | 15 min | under 1 min | LoRaWAN |
| Camera reader on dial meters | 60 min | about 2 min | LoRaWAN or NB-IoT; AI reads the photo |
| Guard photo reads | daily | same day | App photo on rounds; AI reads the digits |
| Utility bills | monthly | on upload | PDF or photo; AI extracts kWh, kW, power factor, m³ |
| Utility interval data (if available) | 15 min | next day | File or API from the utility |

Critical alerts are evaluated as each reading lands: a leak at night, a demand spike heading over the month's peak, a meter going silent. Each one reaches the owner within 5 minutes by app, Viber or SMS.

Why 15 minutes: it is the interval utilities bill demand on. Batteries last 5 years or more. And 96 readings a day are enough to catch leaks, after-hours loads and peaks in time.

## 3. Architecture (our own stack)

1. **Meters and readers.** Each device has an ID, a building, a source type and an expected interval in a device register (the asset registry already holds QR-tagged assets).
2. **Network.** LoRaWAN gateways are spread across the zone, about 6 to 10 for Clark Freeport plus New Clark City. An open-source LoRaWAN network server runs on a small cloud server. NB-IoT SIMs cover isolated meters, and 4G or fibre connects the Modbus gateways.
3. **Ingest.** One authenticated webhook receives everything. It stamps Manila time, drops duplicates (same device, same timestamp) and accepts late or replayed readings. Gateways buffer up to 7 days if the internet drops.
4. **Checks**, run automatically on every reading:
   - The value is within the device's physical range, and cumulative meters never go backwards.
   - Spike test against the same hour on similar days.
   - Clock drift over 2 minutes is flagged.
   - Sub-meters must add up to the main meter within ±5%. Each month the metered total must match the utility bill within ±2%.
   - Photo and bill reads need AI confidence of 90% or more. Below that, a person checks the image.
5. **Store.** Supabase Postgres:
   - A `readings` table partitioned by month: 15-minute raw data kept for 2 years.
   - Hourly and daily roll-up tables kept indefinitely.
   - Compression on old partitions.
6. **Fill and flag.**
   - Gaps up to 2 hours are filled from similar days and marked *estimated*.
   - Longer gaps open a field ticket.
   - Estimated data is shown on dashboards but kept out of savings proof (M&V) unless it is under 2% of the period.
7. **Use.** The command center, AI alerts, monthly savings reports, and the 3D map overlays.

## 4. Completeness monitoring

| Check | Rule | Who acts | Deadline |
|---|---|---|---|
| Meter late | No reading for 2 intervals | Auto-ping; field tech if still missing after 4 hours | Same day |
| Meter offline | No reading for 24 hours | Field tech, then supervisor | 24 hours |
| Low battery | Forecast under 8 weeks | Swap on the next visit | 8 weeks |
| Weak signal | 3 or more readings lost in a day | Move the antenna or add a repeater | 1 week |
| Doubtful photo read | AI confidence under 90% | Guard re-takes, or supervisor confirms | 2 hours |
| Sub-meter gap | Sub-meters under 95% of the main meter | Find the unmetered load, add a clamp | 2 weeks |
| Bill mismatch | Metered total vs bill off by more than 2% | Data steward investigates | 5 days |
| Monthly completeness | Under 98% for a building | Reviewed in the monthly report | Monthly |

The **Data health** panel on `/green/clark` shows:
- meters on time
- readings received in the last 24 hours
- each problem with its fix
- how each source is checked
- the monthly running cost

## 5. Running cost per month (assumed)

| Item | Pilot, 33 buildings (~180 devices) | City, ~1,000 buildings (~6,000 devices) |
|---|---|---|
| Supabase database (time-series tables, backups) | ₱1,500 | ₱12,000 |
| LoRaWAN network server on a small cloud server | ₱1,000 | ₱3,000 |
| Internet for LoRaWAN gateways (fibre or 4G) | ₱6,000 | ₱45,000 |
| NB-IoT SIMs for isolated meters | ₱1,000 | ₱18,000 |
| AI reading of meter photos and bills | ₱1,500 | ₱15,000 |
| Alerts by SMS, Viber and email | ₱800 | ₱6,000 |
| **Total** | **≈ ₱11,800 (≈ ₱66 per device)** | **≈ ₱99,000 (≈ ₱17 per device)** |

Volume at city scale: about 6,000 devices × 96 readings a day ≈ 0.6 million readings a day, roughly 10 GB a year after compression. That's comfortably within one managed Postgres database.

Hardware is a one-time cost, covered in `plan.md`. The ongoing cost is small next to the savings: the sample pilot verifies about ₱16M a month.

## 6. Rollout

1. **Week 0 to 2:** set up the device register, the ingest webhook and a database schema with 15-minute and roll-up tables. Start bills and photo reads.
2. **Week 2 to 6:** put up gateways and connect clamp meters and pulse readers. The Data health panel goes live with real data.
3. **Week 6 onwards:** run the monthly bill reconciliation and completeness report, and bring field-tech tickets for gaps into the existing task system.

## 7. Before real data flows

- Data-sharing agreements with building owners and tenants. Meter data can reveal occupancy, so it falls under the Data Privacy Act.
- Device keys per meter, with the ingest endpoint accepting signed requests only.
- Agree the M&V baseline and the rule for estimated data with each client.

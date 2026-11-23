# Clark City water and power: monitor cheaply, cut fast

**Goal:** happier people in Clark (cooler rooms, steady water, lower bills and dues), with metered savings as the proof.
**Scope:** buildings and factories in New Clark City and Clark Freeport.
**Status:** plan plus a working demo at `/green/clark` (command center) that links to the 3D city map at `/green/map`. The figures in the demo are illustrative sample data. The costs below are indicative 2026 Philippine prices and should be confirmed with suppliers before quoting.

---

## 1. The short version

1. **Start with what's already on the wall.** Every building already has utility meters and 24 months of bills. Upload the bills, have guards photograph meters once a day (AI reads the digits), and ask the distribution utility and water provider for interval data on big accounts. Cost: about ₱0. Time: 2 weeks.
2. **Clip on, don't rewire.** Put clamp-on CT meters on the main incomers and pulse or camera readers on the existing water meters, only in the 20% of buildings that make up about 80% of the use (factories, malls, airport, hotels, data centres). No shutdown and no pipe cutting. LoRaWAN gateways cover the zone; NB-IoT SIMs fill the gaps. Cost: ₱25k to ₱250k per building. Time: weeks 2 to 6.
3. **Let AI watch it 24/7.** Night-flow leak detection, after-hours load, demand spikes, low power factor, chiller drift, compressed-air leaks and dead meters, each sent to a named owner with the fix and the pesos lost per day.
4. **Do the no-cost fixes first.** Setpoints and schedules, leak repairs, after-hours shutdowns and a compressed-air leak walk pay back in weeks and fund everything after.
5. **Then fast-payback retrofits, ranked by payback**, with an ESCO or solar developer paying the upfront cost where it is large.
6. **Prove every peso** against the metered baseline (IPMVP Option B or C), month by month, and show it on the command center.

For a 33-building pilot like the demo, the sample model gives about **₱190M a year live within 6 months** from no- and low-cost measures, and about **₱740M a year (about 15% of power and water spend) once the full pipeline is live**. About half of that needs no upfront money from the buildings.

---

## 2. Monitoring options, cheapest first

| Option | What it is | Indicative cost (₱) | Data | Best for |
|---|---|---|---|---|
| Bills + AI | Upload 24 months of power and water bills; AI extracts kWh, kW demand, power factor, m³, penalties | 0 | Monthly | Every building, day one |
| AI photo reads | Guard photographs each meter on rounds; AI reads the digits and flags odd jumps | 0 (guard's phone) | Daily | Small buildings, homes, sub-meters |
| Utility interval data | Ask the distribution utility for 15-minute AMI data on large accounts | 0 to small fee | 15 min | Big power accounts |
| Camera OCR reader | Battery camera clipped over a dial water meter, reads it hourly | 4,000 to 8,000 per meter | Hourly | Old dial meters, no pulse output |
| Pulse reader + LoRaWAN | Reader on the meter's pulse output or magnet, sends over LoRaWAN | 3,500 to 7,000 per meter | 15 min | Water meters with pulse output |
| CT clamp meter + LoRaWAN or Wi-Fi | Split-core clamps on the incoming cables, no shutdown needed | 8,000 to 15,000 per 3-phase panel, plus 2,000 to 5,000 install by a licensed electrician | 1 to 15 min | Main incomers, chillers, big feeders |
| Modbus gateway | Reads existing digital meters, BMS and chiller controllers | 15,000 to 30,000 per site | 1 min | Factories, malls, hotels with digital meters |
| LoRaWAN gateway | One gateway covers about 2 to 5 km in a built-up area | 25,000 to 60,000 each, about 6 to 10 for Clark | n/a | Shared across the whole zone |
| NB-IoT SIM | Cellular IoT where there is no gateway | 50 to 100 per device per month | n/a | Scattered or isolated meters |
| Platform | The command center, alerts and M&V | Per building per month, in the management fee | Live | All |

**Typical per-building monitoring cost:** small building or house block ₱5k to ₱30k; mid-size office, hotel or mall ₱40k to ₱120k; large factory ₱80k to ₱250k (more sub-meters on compressors, chillers and process lines).

**Pilot estimate for about 33 buildings:** ₱2.5M to ₱4M hardware and installation, plus about ₱0.4M for gateways. With the no-cost fixes alone at about ₱15M a month of savings in the sample, metering pays for itself within the first month or two of results.

Rules that keep it cheap and fast:
- Meter the main incomer and the top 3 loads first (usually chillers, compressors, pumps). Add sub-meters only where the alerts say the money is.
- Use non-invasive hardware so no shutdown, no hot work permit and no pipe cutting is needed.
- Use open protocols (LoRaWAN, Modbus, MQTT) so no vendor lock-in.
- Treat a dead meter as an alert too; AI estimates the gap meanwhile.

---

## 3. What AI watches for

| Alert | Signal | Typical fix |
|---|---|---|
| Water leak | Flow never drops near zero between 1 and 4 AM | Running toilets, stuck make-up valves, cracked lines |
| After-hours load | Power stays high when occupancy (badges, Wi-Fi counts) is low | Push schedules to BMS, lock overrides |
| Demand spike | 15-minute demand heading above the month's billed peak | Short pre-approved load shed (chilled water +1°C, pause non-critical pumps) |
| Low power factor | Below about 0.85 | Repair or add capacitor steps |
| Compressed air leak | Compressors running on non-production days | Ultrasonic leak walk, lower header pressure |
| Chiller drift | kW per ton rising vs last month | Tube cleaning, tower fill, sequencing |
| High pressure | Night pressure above about 4 bar | Set pressure reducing valve lower at night |
| Meter offline | No data for a few hours | Battery or signal fix |

Each alert carries the pesos lost per day, the named owner and the fix, so the command center works as a to-do list, not just a chart.

---

## 4. Ways to cut use, ranked by payback

Sample numbers from the demo pipeline (33 buildings). ₱10.5/kWh and ₱62/m³ assumed.

| # | Measure | Upfront (₱) | Saves a year (₱) | Payback | Who pays |
|---|---|---|---|---|---|
| 1 | Retail supply switch for 100 kW+ users (open access and green energy option) | 0 | ~180M (price, not use) | Day one | No capex |
| 2 | Rooftop solar on PPA, 15 MWp | 0 | ~52M | Day one | Solar developer |
| 3 | Aircon setpoints 24 to 25°C and real-hours schedules | 0.9M | ~89M | under 1 month | No capex |
| 4 | After-hours lights and plug loads off | 0.9M | ~25M | under 1 month | No capex |
| 5 | Compressed air leak hunt in factories | 3.5M | ~61M | about 1 month | Own capex |
| 6 | Fix leaks from night-flow alerts | 1.2M | ~16M | about 1 month | No capex |
| 7 | Low-flow aerators (₱150 to 400) and 6 L/min showerheads | 2.6M | ~11M | about 3 months | Own capex |
| 8 | AI chiller plant optimisation | 32M | ~95M | about 4 months | ESCO shared savings |
| 9 | Power factor correction | 6M | ~15M | about 5 months | Own capex |
| 10 | Cooling tower cycles and aircon condensate reuse | 3.2M | ~7M | about 5 months | Own capex |
| 11 | Rain-aware smart irrigation | 1.8M | ~4M | about 6 months | Own capex |
| 12 | Pressure reducing valves on water mains | 4.5M | ~9M | about 6 months | Own capex |
| 13 | LED retrofit with sensors (parking, corridors, high-bay) | 55M | ~68M | about 10 months | ESCO shared savings |
| 14 | Cool roof coating on warehouses and plants | 22M | ~27M | about 10 months | Own capex |
| 15 | Variable speed drives on pumps and air handlers | 48M | ~55M | about 11 months | ESCO shared savings |
| 16 | Batteries for evening peak shaving | 120M | ~22M | about 5 years | Own capex, later |

Notes:
- Setpoints: each 1°C warmer typically saves about 3 to 5% of cooling energy. The DOE recommends 24 to 25°C for offices. Comfort is checked with weekly occupant pulse surveys.
- Compressed air: leaks often waste 20 to 30% of compressed air in plants; fixes are cheap.
- Low-flow fixtures cut tap and shower flow by 30 to 50% with no change people notice.
- Pressure management cuts leak flow and pipe bursts; it also means fewer water interruptions for residents.
- Solar: commercial rooftop at about ₱35k to ₱45k per kWp installed if owned; under a PPA the developer pays and the building buys the power at a discount for 15 to 20 years.
- Supply switching saves on the generation charge, not consumption, so it is shown separately in the command center as "Tariff".

---

## 5. Financing so buildings pay little or nothing upfront

- **No-capex first:** setpoints, schedules, leak fixes and supply switching need almost no money.
- **ESCO shared savings:** a DOE-accredited energy service company (under the Energy Efficiency and Conservation Act, RA 11285) funds chillers, LED and VFDs and takes a share of verified savings (often 50 to 80% to the ESCO for 5 to 7 years). The building pays nothing upfront and keeps the rest of the savings from day one.
- **Solar PPA:** the developer builds, owns and maintains; the building buys cheaper power.
- **Our fee:** a monthly platform and management fee per building, plus an optional share of verified savings. Savings reports come from the meters, so everyone sees the same numbers.

---

## 6. Rollout timeline

| When | What | Cost | Result |
|---|---|---|---|
| Week 0 to 2 | Bills uploaded, AI photo reads by guards, interval data requested, walk-throughs | ~₱0 to ₱5k per building | Baseline and first quick-win list |
| Week 2 to 6 | Clip-on meters on the top 20% of buildings, LoRaWAN gateways across the zone | ₱25k to ₱250k per building | Live command center, first alerts |
| Week 2 to 8 | No- and low-cost fixes: setpoints, schedules, leaks, compressed air | about ₱6.5M across the 33 sample buildings | About 4% saving, visible in weeks |
| Month 2 to 6 | Fast-payback retrofits, ESCO contracts signed | ₱1M to ₱55M, much ESCO-funded | Another 5 to 6% |
| Month 4 to 12 | Solar PPAs, supply switching, batteries where justified | Zero capex mostly | Lower price and cleaner power |
| Ongoing | Monthly M&V report, new alerts, next measures | In the fee | Savings that stay saved |

---

## 7. How it shows up in the app

- **`/green/clark` command center:** live power and water by district and building, AI alerts with owner and fix, the ranked savings pipeline with stage tracking (Found, Approved, Installing, Live, Verified), savings to date vs target, metering coverage and the rollout plan. A wall-screen mode hides the app chrome and cycles through districts every 12 seconds; it also opens with `?wall=1`.
- **`/green/map` 3D city map** (built in a separate piece of work): every district and alert in the command center links into it with `?focus=<district>` and `?alert=<id>`.
- **Morning briefing:** written by AI from the day's data, with a plain fallback when no API key is set.

## 8. Other city KPIs we recommend for BCDA

Water and power stay the main objective. The same meters, sensors and pulse surveys can feed a wider city scorecard, which the command center shows under "City goals":

| KPI | Why it matters | Public anchor |
|---|---|---|
| Resident and worker happiness (weekly pulse) | The north star; proves savings did not cost comfort | n/a |
| Non-revenue water | Water lost before it reaches anyone; leaks and bad meters | n/a |
| Outage minutes per customer (SAIDI) | Brownouts hurt homes and factories most | n/a |
| Clean energy share and CO₂ per person | Climate goals in one number each | 37 ha solar farm allocated in NCC ([Wikipedia](https://en.wikipedia.org/wiki/New_Clark_City)) |
| Green and open space kept | BCDA keeps 60% of 9,450 ha green, no-cut policy for threatened trees | [BCDA, 2022](https://www.bcda.gov.ph/news/bcda-implement-uk-sustainability-plan-new-clark-city) |
| Flood readiness (retention lake, drains, pumps) | Central Park lake doubles as flood retention | [BCDA, 2022](https://www.bcda.gov.ph/news/bcda-implement-uk-sustainability-plan-new-clark-city) |
| Waste diverted from landfill | Planned 600 t/day, 12 MW waste-to-energy plant | [Wikipedia](https://en.wikipedia.org/wiki/New_Clark_City) |
| Trips by transit, walking or bike | Clark Loop BRT, driverless bus, commuter rail | [Wikipedia](https://en.wikipedia.org/wiki/New_Clark_City) |
| Investment built vs pledged, and jobs | ₱143.2B NCC pledges (₱15.9B built), 103,000 jobs expected; Clark Freeport ₱77B in 2024, 146,000+ jobs | [Philstar, Jul 2024](https://philstar.com/business/2024/07/15/2370174/new-clark-city-attracts-p143-billion-investment-pledges), [SunStar, Sep 2025](https://www.sunstar.com.ph/pampanga/clark-records-77b-investment-in-2024) |
| Green-rated floor area (BERDE, EDGE, LEED) | Ratings need 12 months of metered data, which we already collect | n/a |

Current values on the page are sample data except where a source is shown. BCDA's 2022 sustainability plan puts SDGs 3, 8, 9, 11 and 17 in its performance scorecard but publishes no numeric targets, so the targets on the page are our proposals.

## 9. Before going live with real data

- Agree data-sharing with each building owner and tenant (Data Privacy Act; meter data can reveal occupancy).
- Get the utility's consent and format for interval data.
- Confirm supplier quotes for meters, gateways and installation.
- Agree the M&V baseline method with each client before any savings-share contract.
- Replace the demo's sample data with a database model and meter ingestion (MQTT or LoRaWAN network server webhook).

*Sample figures are illustrative and not real usage of any Clark tenant.*

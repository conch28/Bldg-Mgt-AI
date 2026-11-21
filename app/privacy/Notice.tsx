import { DPO, NOTICE_VERSION } from "@/lib/privacy";

/** Plain-language privacy notice under the Data Privacy Act of 2012 (RA 10173). */
export default function Notice() {
  return (
    <div className="legal">
      <p className="hint">Version {NOTICE_VERSION}. Skyland Plaza Condominium Corporation (the building) uses {DPO.company} to run building management. The building is the personal information controller; {DPO.company} processes your data on its behalf under a data sharing and processing agreement.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Your name, email, mobile number and the unit you own or rent.</li>
        <li>Dues, bills and payments. Card and e-wallet details go straight to our payment provider (PayMongo); we never see or store them.</li>
        <li>Repair requests, messages to the helpdesk, visitor and delivery passes, amenity bookings, votes, pet and vehicle registrations, and ratings you give us.</li>
        <li>If you list your unit for rent or sale: the price, photos and details you approve.</li>
        <li>Sign-in records (time and method) for security.</li>
      </ul>
      <h2>Why we use it</h2>
      <ul>
        <li>To run the building: billing, repairs, security at the lobby, notices and emergencies. This is needed to perform the condominium's obligations to you (RA 10173, Sec. 12(b) and (c)) and the Condominium Act.</li>
        <li>To send you updates by text, email or Messenger. You choose the channels under Account.</li>
        <li>To ask how happy you are with the building, so we can fix what is not working. Answering is optional.</li>
        <li>Our AI assistant reads your request to draft replies and summaries. It runs on Anthropic&apos;s Claude service under a contract that does not let them train on your data. A person reviews anything sent to residents on the building&apos;s behalf.</li>
      </ul>
      <h2>Who sees it</h2>
      <ul>
        <li>Building staff see what they need for their job: guards see passes, not your bills. Board members see totals and reports, not your messages.</li>
        <li>Service providers who help us run the app: Vercel (hosting) and Supabase (database, in Singapore), Semaphore (texts), Resend (email), PayMongo (payments), Anthropic (AI), Sentry (error reports, without names or contact details), and Meta (only if you list a unit or link Messenger). Some are outside the Philippines; each is bound by contract to protect your data.</li>
        <li>We never sell your data.</li>
      </ul>
      <h2>How long we keep it</h2>
      <ul>
        <li>Billing and payment records: 10 years, as tax rules require.</li>
        <li>Visitor passes and lobby logs: 1 year. Sign-in codes: 7 days. Error reports: 90 days.</li>
        <li>Everything else: while you own or live in a unit, then 1 year. After that we delete it or remove anything that identifies you.</li>
      </ul>
      <h2>Your rights</h2>
      <p>You can ask to see your data, get a copy, correct it, object, or have it deleted, and you can complain to the National Privacy Commission (privacy.gov.ph). Use <b>Account → Your data</b> in the app, or email {DPO.name} at <a href={`mailto:${DPO.email}`}>{DPO.email}</a>. We reply within 15 days.</p>
      <h2>Keeping it safe</h2>
      <p>Data is encrypted in transit and at rest, access is limited by role, every change to money, tickets and accounts is logged, and backups are encrypted. If a breach puts you at risk, we will tell you and the National Privacy Commission within 72 hours.</p>
    </div>
  );
}

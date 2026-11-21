/**
 * Outbound messages. Sends SMS through Semaphore (a Philippine SMS gateway)
 * when SEMAPHORE_API_KEY is set; otherwise only records the message.
 */
export async function sendSms(to: string | null | undefined, message: string): Promise<{ delivered: boolean; info: string }> {
  const key = process.env.SEMAPHORE_API_KEY;
  if (!key) return { delivered: false, info: "Logged (SMS off)" };
  if (!to) return { delivered: false, info: "Logged (no mobile)" };
  const body = new URLSearchParams({ apikey: key, number: to.replace(/[^\d+]/g, ""), message, ...(process.env.SEMAPHORE_SENDER ? { sendername: process.env.SEMAPHORE_SENDER } : {}) });
  const r = await fetch("https://api.semaphore.co/api/v4/messages", { method: "POST", body });
  return r.ok ? { delivered: true, info: "Sent by SMS" } : { delivered: false, info: `SMS failed (${r.status})` };
}

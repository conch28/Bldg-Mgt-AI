/** Who answers privacy questions. Set these in Vercel once the company and its Data Protection Officer are registered with the NPC. */
export const DPO = {
  company: process.env.COMPANY_NAME || "Building Mgt AI",
  name: process.env.DPO_NAME || "Data Protection Officer",
  email: process.env.DPO_EMAIL || "privacy@buildingmgt.ai",
};
export const NOTICE_VERSION = "2026-11-21";

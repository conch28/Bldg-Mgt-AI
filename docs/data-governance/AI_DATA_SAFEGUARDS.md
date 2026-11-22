# AI data safeguards

## What AI does today
- Resident helpdesk (app, Messenger, Viber): reads the resident's own account and tickets, files tickets, books services after confirmation, and hands over to a person (`lib/ai.ts`). Every AI feature has a no-key fallback.
- Drafts routine resident updates for the manager to approve; urgent alerts come from fixed templates.
- Advisor ideas and price checks are labelled estimates with their assumptions.

## Rules
1. **Facts, estimates and recommendations are labelled apart.** Verified facts come from records a person verified. Estimates and predictions say so and show their assumptions.
2. **AI answers from approved information.** House rules and policies come from board-approved documents. If an answer can't be verified, the assistant escalates to the manager instead of guessing.
3. **Documents are data, not instructions.** Text inside an uploaded file, a chat message or a web page can never change system rules or authorize an action.
4. **Nothing uncertain or safety-critical is auto-approved.** AI-extracted fields (phase 3) start as unverified and need a person's approval, with the source page and a confidence score kept.
5. **Deterministic first.** Data quality checks are plain rules, not AI, because they are cheaper and more reliable.

## AI never independently
- Approves contractor payments or awards contracts.
- Changes legally binding lease terms.
- Authorizes access to restricted areas or controls building systems.
- Disables safety equipment or certifies engineering or regulatory compliance.
- Overrides qualified engineering personnel.
- Records contractor credentials, specs or comparables as verified facts.

## Privacy
- AI tools only see the signed-in resident's own data.
- Confidential tenant and financial data stays behind role checks (`requireRole` on every page and action, middleware as a second layer).
- The model provider receives only what the conversation needs. No key, no AI calls.

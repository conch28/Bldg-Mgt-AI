"use client";
import { useFormState, useFormStatus } from "react-dom";
import { importCsv, type ImportResult } from "./actions";

const pesos = (n: number) => "₱" + n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function Btn({ mode, label, pri }: { mode: string; label: string; pri?: boolean }) {
  const { pending } = useFormStatus();
  return <button className={"btn" + (pri ? " pri" : "")} name="mode" value={mode} disabled={pending}>{pending ? "Working…" : label}</button>;
}
export default function ImportForm() {
  const [r, action] = useFormState<ImportResult, FormData>(importCsv, {});
  const ready = r.checked && !r.problems?.length && !r.imported;
  return (
    <form action={action}>
      <div className="field"><label htmlFor="file">CSV file</label><input id="file" name="file" type="file" accept=".csv,text/csv" required /></div>
      <div className="inline-form"><Btn mode="check" label="1. Check the file" pri={!ready} />{ready && <Btn mode="import" label={`2. Import ${r.rows} units`} pri />}</div>
      {r.error && <div className="err" style={{ marginTop: 12 }} role="alert">{r.error}</div>}
      {r.problems && r.problems.length > 0 && <div className="err" style={{ marginTop: 12 }} role="alert"><b>Fix {r.problems.length} problem{r.problems.length > 1 ? "s" : ""} in the sheet, then check again. Nothing was saved.</b><ul className="importlog">{r.problems.slice(0, 100).map((p) => <li key={p}>{p}</li>)}</ul></div>}
      {r.units && !r.problems?.length && <div className={r.imported ? "okmsg" : "tip"} style={{ marginTop: 12 }}>
        <b>{r.imported ? "Imported." : "Looks good. Nothing saved yet."}</b>
        <ul style={{ margin: "6px 0 0" }}>
          <li>{r.units.create} new units, {r.units.update} existing units updated</li>
          <li>{r.owners!.create} new owner logins ({r.owners!.link} units linked to an owner email)</li>
          <li>{r.balances!.count} opening balances, {pesos(r.balances!.total)} in total</li>
        </ul>
        {ready && <p style={{ margin: "8px 0 0" }}>Choose the same file again if the browser cleared it, then press Import.</p>}
        {r.imported && <p style={{ margin: "8px 0 0" }}>Owners can now sign in with a code sent to their email or mobile. No passwords to hand out.</p>}
      </div>}
    </form>
  );
}

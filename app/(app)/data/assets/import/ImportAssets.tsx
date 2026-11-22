"use client";
import { useFormState, useFormStatus } from "react-dom";
import { importAssets, type AssetImport } from "./actions";

function Btn({ mode, label, pri }: { mode: string; label: string; pri?: boolean }) {
  const { pending } = useFormStatus();
  return <button className={"btn" + (pri ? " pri" : "")} name="mode" value={mode} disabled={pending} formNoValidate={mode === "undo"}>{pending ? "Working…" : label}</button>;
}
export default function ImportAssets() {
  const [r, action] = useFormState<AssetImport, FormData>(importAssets, {});
  const ready = r.checked && !r.problems?.length && !r.imported;
  return (
    <form action={action}>
      <div className="field"><label htmlFor="file">CSV file</label><input id="file" name="file" type="file" accept=".csv,text/csv" /></div>
      <div className="inline-form"><Btn mode="check" label="1. Check the file" pri={!ready} />{ready && <Btn mode="import" label={`2. Import ${r.rows} assets`} pri />}<Btn mode="undo" label="Undo last import" /></div>
      {r.error && <div className="err" style={{ marginTop: 12 }} role="alert">{r.error}</div>}
      {r.problems && r.problems.length > 0 && <div className="err" style={{ marginTop: 12 }} role="alert"><b>Fix {r.problems.length} problem{r.problems.length > 1 ? "s" : ""}, then check again. Nothing was saved.</b><ul className="importlog">{r.problems.slice(0, 100).map((p) => <li key={p}>{p}</li>)}</ul></div>}
      {r.undone && <div className="okmsg" style={{ marginTop: 12 }}>Undone: {r.create} new assets removed, {r.update} restored to how they were.</div>}
      {r.rows != null && !r.problems?.length && !r.undone && <div className={r.imported ? "okmsg" : "tip"} style={{ marginTop: 12 }}>
        <b>{r.imported ? "Imported." : "Looks good. Nothing saved yet."}</b>
        <ul style={{ margin: "6px 0 0" }}><li>{r.create} new assets, {r.update} existing assets updated</li>{!!r.reverify && <li>{r.reverify} verified assets have changed specs and will need verifying again</li>}</ul>
        {r.preview && !r.imported && <><p style={{ margin: "8px 0 2px" }}>First rows:</p><ul style={{ margin: 0 }}>{r.preview.map((p) => <li key={p}>{p}</li>)}</ul></>}
        {ready && <p style={{ margin: "8px 0 0" }}>Choose the same file again if the browser cleared it, then press Import.</p>}
      </div>}
    </form>
  );
}

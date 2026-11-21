import Notice from "./Notice";
export const metadata = { title: "Privacy notice · Skyland Plaza" };
export default function Privacy() {
  return <div className="login"><div className="box" style={{ maxWidth: 720 }}><h2 style={{ fontSize: 24, marginBottom: 6 }}>Privacy notice</h2><Notice /><p style={{ marginTop: 20 }}><a className="btn" href="/login">Back to sign in</a></p></div></div>;
}

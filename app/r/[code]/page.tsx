import Remote from "./Remote";

export const metadata = { title: "City map remote" };

export default function RemotePage({ params }: { params: { code: string } }) {
  return <Remote code={String(params.code).slice(0, 12)} />;
}

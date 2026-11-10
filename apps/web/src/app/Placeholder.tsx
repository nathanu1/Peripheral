/** M0 stand-in for routes that later milestones fill in. */
export function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <main className="grid h-full place-items-center p-6 text-center">
      <div>
        <h1 className="text-label">{title}</h1>
        <p className="text-fact text-ink-2 mt-2">{note}</p>
        <a className="text-fact touch mt-4 inline-grid place-items-center underline" href="/">
          Back to the camera
        </a>
      </div>
    </main>
  );
}

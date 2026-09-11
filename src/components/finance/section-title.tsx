export function SectionTitle({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return <div className="space-y-1"><p className="text-sm font-semibold text-blue-600">{eyebrow}</p><h1 className="text-3xl font-bold tracking-tight text-slate-950">{title}</h1>{description && <p className="text-sm text-slate-500">{description}</p>}</div>;
}

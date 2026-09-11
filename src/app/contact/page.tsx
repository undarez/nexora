import Link from "next/link";
import { Mail, ShieldCheck, MessageSquareText } from "lucide-react";
import { legalConfig } from "@/lib/legal/config";

export default function ContactPage() {
  const email = legalConfig.contactEmail;
  const isPlaceholder = email.startsWith("[");
  return <main className="min-h-[70vh] py-12 sm:py-20"><div className="app-section max-w-5xl"><p className="landing-eyebrow">Contact</p><h1 className="mt-2 text-4xl font-black tracking-tight sm:text-6xl">Nous contacter</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">Une question sur NEXORA, un problème technique, une demande commerciale ou une question concernant vos données ? Choisissez le bon point de contact.</p>
    <div className="mt-10 grid gap-4 md:grid-cols-3">
      <article className="rounded-3xl border bg-card p-6"><Mail className="h-6 w-6 text-primary"/><h2 className="mt-4 font-bold">Support & produit</h2><p className="mt-2 text-sm text-muted-foreground">Questions générales, utilisation et problèmes techniques.</p>{isPlaceholder ? <p className="mt-4 text-xs font-semibold text-amber-600">Email de support à configurer.</p> : <a className="mt-4 inline-block font-semibold text-primary hover:underline" href={`mailto:${email}`}>{email}</a>}</article>
      <article className="rounded-3xl border bg-card p-6"><ShieldCheck className="h-6 w-6 text-primary"/><h2 className="mt-4 font-bold">Données personnelles</h2><p className="mt-2 text-sm text-muted-foreground">Exercice des droits, confidentialité et demandes RGPD.</p><a className="mt-4 inline-block font-semibold text-primary hover:underline" href={legalConfig.privacyEmail.startsWith("[") ? "/rgpd" : `mailto:${legalConfig.privacyEmail}`}>{legalConfig.privacyEmail.startsWith("[") ? "Voir la procédure RGPD" : legalConfig.privacyEmail}</a></article>
      <article className="rounded-3xl border bg-card p-6"><MessageSquareText className="h-6 w-6 text-primary"/><h2 className="mt-4 font-bold">Questions fréquentes</h2><p className="mt-2 text-sm text-muted-foreground">La réponse est peut-être déjà disponible dans notre FAQ.</p><Link className="mt-4 inline-block font-semibold text-primary hover:underline" href="/faq">Consulter la FAQ →</Link></article>
    </div>
    <div className="mt-10 rounded-3xl border bg-muted/30 p-6 text-sm leading-7 text-muted-foreground"><strong className="text-foreground">À propos des formulaires :</strong> tant qu’aucun prestataire de messagerie transactionnelle n’est configuré, NEXORA n’enregistre pas un formulaire de contact dans une base dédiée. Cette version privilégie un contact explicite par email afin de limiter la collecte.</div>
  </div></main>;
}

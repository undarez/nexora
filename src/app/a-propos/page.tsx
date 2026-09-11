import Link from "next/link";
import { BrainCircuit, Landmark, ShieldCheck, Smartphone, Target, TrendingUp } from "lucide-react";

export default function AboutPage() {
  return <main className="min-h-[70vh] py-12 sm:py-20"><div className="app-section max-w-5xl">
    <p className="landing-eyebrow">À propos de NEXORA</p><h1 className="mt-2 text-4xl font-black tracking-tight sm:text-6xl">Une intelligence financière conçue pour vous aider à décider.</h1>
    <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">NEXORA est une application de pilotage financier personnel et professionnel. Elle rassemble les données financières utiles, aide à comprendre les dépenses, construit des projections et met une intelligence artificielle au service de vos décisions — avec un principe central : <strong>vous restez maître des décisions et des actions sensibles.</strong></p>
    <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[
      [Landmark,"Centraliser","Comptes, transactions, budgets et autres informations financières dans une vue cohérente."],
      [TrendingUp,"Anticiper","Prévisions et scénarios pour comprendre les conséquences possibles avant d’agir."],
      [BrainCircuit,"Comprendre","LIA relie les données et les signaux pour produire des réponses contextualisées."],
      [Target,"Piloter","Objectifs, enveloppes et indicateurs réunis autour de décisions concrètes."],
      [ShieldCheck,"Sécuriser","Contrôles, permissions et garde-fous pour les données et les actions sensibles."],
      [Smartphone,"Évoluer vers le mobile","NEXORA est conçu pour une expérience mobile complète. Une version mobile dédiée est prévue dans la feuille de route, en complément de l’expérience web responsive actuelle."],
    ].map(([Icon,title,text]) => { const I=Icon as typeof ShieldCheck; return <article key={title as string} className="rounded-3xl border bg-card p-6"><I className="h-6 w-6 text-primary"/><h2 className="mt-4 text-lg font-bold">{title as string}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{text as string}</p></article>;})}</div>
    <section className="mt-12 rounded-3xl border bg-muted/30 p-7"><h2 className="text-2xl font-bold">Ce que NEXORA n’est pas</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">NEXORA est un logiciel de pilotage et d’aide à la décision. Sauf mention légale contraire et autorisation réglementaire spécifique, l’application ne constitue ni une banque, ni un établissement de paiement, ni un conseiller en investissement, ni un service garantissant une performance financière. Les connexions bancaires sont réalisées via des partenaires spécialisés lorsque cette fonctionnalité est disponible.</p></section>
    <div className="mt-10 flex flex-wrap gap-3"><Link href="/faq" className="landing-primary-cta">Voir la FAQ</Link><Link href="/contact" className="landing-secondary-cta">Nous contacter</Link></div>
  </div></main>;
}

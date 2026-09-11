import Link from "next/link";
import {
  ArrowRight,
  Eye,
  Gauge,
  LineChart,
  MousePointerClick,
  BarChart3,
  BellRing,
  BrainCircuit,
  Check,
  CircleDollarSign,
  Landmark,
  LockKeyhole,
  PiggyBank,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  WalletCards,
} from "lucide-react";

const features = [
  {
    icon: ReceiptText,
    title: "Comprendre tes dépenses",
    text: "Centralise tes transactions, repère les récurrences et comprends où part réellement ton argent.",
  },
  {
    icon: PiggyBank,
    title: "Piloter ton budget",
    text: "Budgets, enveloppes, alertes et simulations pour décider avant que le mois ne dérape.",
  },
  {
    icon: TrendingUp,
    title: "Anticiper",
    text: "Prévisions, scénarios et patrimoine pour voir les conséquences de tes décisions dans le temps.",
  },
  {
    icon: BrainCircuit,
    title: "Être accompagné par LIA",
    text: "Une intelligence financière qui observe, analyse, vérifie et propose des actions dans un cadre sécurisé.",
  },
  {
    icon: BellRing,
    title: "Recevoir les bons signaux",
    text: "Alertes utiles sur les dépenses, les écarts de budget et les opportunités d'épargne, sans bruit inutile.",
  },
  {
    icon: BarChart3,
    title: "Faire le point",
    text: "Un pilotage simple pour clôturer le mois, mesurer les écarts et améliorer tes décisions au fil du temps.",
  },
];

const useCases = [
  {
    number: "01",
    title: "« Est-ce que je peux me permettre cet achat ? »",
    text: "Teste son impact sur ton budget et tes prévisions avant de sortir la carte bancaire.",
    icon: CircleDollarSign,
  },
  {
    number: "02",
    title: "« Pourquoi mon mois finit plus cher que prévu ? »",
    text: "Les transactions, enveloppes et alertes mettent en évidence les postes qui dérivent.",
    icon: Target,
  },
  {
    number: "03",
    title: "« Comment préparer les prochains mois ? »",
    text: "Compare tes hypothèses au réel et construis des scénarios plutôt que de subir les imprévus.",
    icon: TrendingUp,
  },
];

const workflow = [
  { icon: MousePointerClick, step: "01", title: "Vous donnez un objectif", text: "Un achat, un mois à préparer, une épargne à atteindre ou simplement une question." },
  { icon: Eye, step: "02", title: "Gérer Finance comprend", text: "Vos données, vos contraintes et vos hypothèses sont réunies avant de proposer une réponse." },
  { icon: LineChart, step: "03", title: "LIA analyse et vérifie", text: "Elle cherche les écarts, teste des scénarios et explicite ce qui est certain ou incertain." },
  { icon: Gauge, step: "04", title: "Vous gardez la décision", text: "Les actions sensibles restent sous votre contrôle. L'application vous accompagne, elle ne décide pas à votre place." },
];

export default function LandingPage() {
  return (
    <main className="landing-page overflow-hidden">
      <section className="landing-hero landing-hero-v2 relative">
        <div className="landing-hero-glow landing-hero-glow-one" />
        <div className="landing-hero-glow landing-hero-glow-two" />
        <div className="app-section relative">
          <div className="landing-hero-grid">
            <div className="landing-hero-copy">
              <div className="landing-brand-lockup">
                <picture className="landing-brand-lockup-image"><img className="landing-logo-light" src="/nexora-wordmark-dark.svg" alt="NEXORA — Votre intelligence financière" /><img className="landing-logo-dark" src="/nexora-wordmark-dark.svg" alt="" aria-hidden="true" /></picture>
              </div>
              <h1 className="mt-3 text-5xl font-black tracking-[-0.055em] sm:text-6xl lg:text-[5.35rem] lg:leading-[.95]">
                Anticipez. <span className="text-primary">Sécurisez.</span><br />Pilotez vos finances.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
                NEXORA transforme vos données financières en décisions claires. Budget, prévisions, objectifs et LIA réunis dans une seule intelligence financière.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/auth?mode=signup" className="landing-primary-cta">
                  Commencer maintenant <ArrowRight className="h-5 w-5" />
                </Link>
                <Link href="#fonctionnalites" className="landing-secondary-cta">
                  Découvrir NEXORA
                </Link>
              </div>
              <div className="landing-hero-benefits mt-9">
                <span><TrendingUp className="h-5 w-5" /> <strong>ANTICIPER</strong><small>l’avenir</small></span>
                <span><ShieldCheck className="h-5 w-5" /> <strong>SÉCURISER</strong><small>vos finances</small></span>
                <span><Target className="h-5 w-5" /> <strong>PILOTER</strong><small>vos objectifs</small></span>
                <span><Sparkles className="h-5 w-5" /> <strong>AUTOMATISER</strong><small>avec LIA</small></span>
              </div>
            </div>

            <div className="landing-hero-visual" aria-label="Aperçu de NEXORA et de son assistant financier LIA">
              <div className="landing-nexo-bubble">
                <span className="landing-nexo-dot" />
                <div><strong>Bonjour !</strong><p>Je suis Nexo, votre compagnon IA.</p></div>
              </div>
              <div className="landing-phone">
                <div className="landing-phone-notch" />
                <div className="landing-phone-screen">
                  <div className="flex items-center justify-between"><span className="text-xs font-bold">NEXORA</span><span className="landing-live-dot"><span /> LIA</span></div>
                  <p className="mt-8 text-xs text-muted-foreground">Vue globale</p>
                  <p className="mt-1 text-3xl font-black text-primary">+12,5 % ↗</p>
                  <div className="mt-7 h-24 rounded-2xl border bg-background/60 p-3">
                    <div className="flex h-full items-end gap-2">
                      {[42,56,48,70,64,82,76].map((h,i)=><div key={i} className="flex-1 rounded-t-md bg-primary/70" style={{height:`${h}%`}} />)}
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border p-3"><span className="text-[10px] text-muted-foreground">Budget</span><strong className="mt-1 block text-sm">72 %</strong></div>
                    <div className="rounded-xl border p-3"><span className="text-[10px] text-muted-foreground">Épargne</span><strong className="mt-1 block text-sm">420 €</strong></div>
                  </div>
                </div>
              </div>
              <div className="landing-hero-data-card">
                <div className="landing-live-dot"><span /> LIA active</div>
                <p className="mt-3 text-xs text-muted-foreground">Reste à vivre estimé</p>
                <p className="mt-1 text-2xl font-black">1 284,50 €</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full w-[72%] rounded-full bg-primary" /></div>
                <p className="mt-2 text-[11px] text-muted-foreground">Bonne trajectoire ce mois-ci</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="fonctionnalites" className="py-20 sm:py-28">
        <div className="app-section">
          <div className="max-w-2xl">
            <p className="landing-eyebrow">Tout au même endroit</p>
            <h2 className="landing-title">Une application pour <span>comprendre et piloter</span>.</h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">Pas seulement suivre un solde. Gérer Finance relie les données, les objectifs, les prévisions et l&apos;intelligence pour vous aider à prendre de meilleures décisions.</p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, text }) => (
              <article key={title} className="landing-feature-card">
                <div className="landing-icon"><Icon className="h-5 w-5" /></div>
                <h3 className="mt-5 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="cas-concrets" className="landing-usecases py-20 sm:py-28">
        <div className="app-section">
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
            <div><p className="landing-eyebrow">Dans la vraie vie</p><h2 className="landing-title">Des décisions concrètes, pas des graphiques pour faire joli.</h2></div>
            <p className="text-lg leading-8 text-muted-foreground">L&apos;objectif est simple : vous donner une réponse exploitable au moment où vous en avez besoin, avec les données et les hypothèses visibles.</p>
          </div>
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {useCases.map(({ number, title, text, icon: Icon }) => (
              <article key={number} className="landing-usecase-card">
                <div className="flex items-center justify-between"><span className="text-xs font-black tracking-[0.2em] text-primary">{number}</span><Icon className="h-6 w-6 text-muted-foreground" /></div>
                <h3 className="mt-8 text-xl font-bold leading-7">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="comment-ca-marche" className="landing-workflow py-20 sm:py-28">
        <div className="app-section">
          <div className="mx-auto max-w-3xl text-center">
            <p className="landing-eyebrow">Une autre façon de gérer son argent</p>
            <h2 className="landing-title">De la question à la décision, <span>en quelques étapes.</span></h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">Gérer Finance ne se contente pas d'afficher vos chiffres. L'application transforme vos données en contexte, puis en options compréhensibles.</p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {workflow.map(({ icon: Icon, step, title, text }) => (
              <article key={step} className="landing-workflow-card">
                <div className="flex items-center justify-between">
                  <span className="landing-step">{step}</span>
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-7 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="securite" className="py-20 sm:py-28">
        <div className="app-section">
          <div className="landing-security-card">
            <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
              <div><p className="landing-eyebrow">Conçu pour la finance</p><h2 className="landing-title">L&apos;IA aide. <span>Elle ne prend pas le contrôle.</span></h2><p className="mt-4 leading-7 text-muted-foreground">Les actions sensibles restent encadrées. LIA fonctionne avec des garde-fous, des vérifications et une logique d&apos;autonomie progressive. L&apos;application sépare observation, proposition et exécution.</p></div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[{icon:LockKeyhole,text:"Accès protégé"},{icon:ShieldCheck,text:"Actions sensibles encadrées"},{icon:Landmark,text:"Données financières isolées"},{icon:BrainCircuit,text:"IA locale compatible"}].map(({icon: Icon,text}) => <div key={text} className="landing-security-item"><Icon className="h-5 w-5 text-primary" /><span>{text}</span></div>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-24 pt-4 sm:pb-32">
        <div className="app-section">
          <div className="landing-final-cta">
            <WalletCards className="mx-auto h-9 w-9 text-primary" />
            <h2 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">Reprenez la main sur vos finances.</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">Commencez par votre budget. Puis laissez l&apos;application vous aider à comprendre, prévoir et progresser.</p>
            <Link href="/auth?mode=signup" className="landing-primary-cta mx-auto mt-7 w-fit">Créer mon espace <ArrowRight className="h-5 w-5" /></Link>
          </div>
        </div>
      </section>
    </main>
  );
}

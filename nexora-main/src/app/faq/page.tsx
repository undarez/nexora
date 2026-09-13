import { LegalPage, LegalSection } from "@/components/legal/legal-page";

const faqs = [
  ["À quoi sert NEXORA ?", "NEXORA rassemble les informations financières utiles pour suivre, comprendre, anticiper et piloter vos finances personnelles ou professionnelles."],
  ["NEXORA est-il une banque ?", "Non. NEXORA est un logiciel. Une connexion bancaire, lorsqu’elle est disponible, passe par un fournisseur spécialisé et ne transforme pas NEXORA en banque."],
  ["LIA prend-elle des décisions à ma place ?", "LIA peut analyser, expliquer, comparer et proposer. Les opérations sensibles restent encadrées et nécessitent les autorisations prévues par le produit."],
  ["Mes données bancaires sont-elles accessibles à NEXORA ?", "Les données nécessaires à l’agrégation peuvent être traitées lorsqu’une connexion bancaire est activée. Les modalités, finalités, fournisseurs et durées sont détaillés dans la politique de confidentialité."],
  ["Pourquoi dois-je reconnecter ma banque ?", "NEXORA applique une politique produit de reconnexion à 90 jours afin de renforcer le contrôle utilisateur. La durée réellement imposée par un fournisseur peut être différente selon le service et le cadre applicable."],
  ["Une version mobile est-elle prévue ?", "Oui. L’interface web est pensée pour les écrans mobiles et une application mobile dédiée fait partie de la feuille de route."],
  ["Comment exercer mes droits RGPD ?", "Vous pouvez contacter le point de contact indiqué dans la politique de confidentialité. Une demande doit permettre de vous identifier suffisamment pour être traitée sans divulguer vos données à un tiers."],
  ["Comment demander de l’aide ?", "Utilisez la page Contact pour les questions produit, techniques, commerciales ou relatives aux données personnelles."],
];

export default function FAQPage() { return <LegalPage title="FAQ" eyebrow="Aide & transparence" intro="Les réponses aux questions les plus fréquentes sur NEXORA, ses données et son fonctionnement." showPlaceholder={false}><div className="grid gap-4">{faqs.map(([q,a]) => <LegalSection key={q} title={q}><p>{a}</p></LegalSection>)}</div></LegalPage>; }

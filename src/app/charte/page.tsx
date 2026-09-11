import { LegalPage, LegalSection } from "@/components/legal/legal-page";

export default function CharterPage() { return <LegalPage title="Charte NEXORA" eyebrow="Principes de confiance" intro="Une charte produit qui formalise les engagements de conception de NEXORA envers ses utilisateurs.">
  <LegalSection title="1. Vous gardez la main"><p>NEXORA est conçu pour expliquer et accompagner. Les décisions financières importantes restent sous le contrôle de l’utilisateur.</p></LegalSection>
  <LegalSection title="2. Transparence"><p>Les données, hypothèses, limites et incertitudes utiles doivent être rendues compréhensibles. Une recommandation de l’IA ne doit pas être présentée comme une certitude lorsque les données ne permettent pas de l’établir.</p></LegalSection>
  <LegalSection title="3. Minimisation"><p>NEXORA cherche à limiter la collecte aux informations nécessaires aux finalités annoncées. Les données financières sont considérées comme particulièrement sensibles dans la conception du produit.</p></LegalSection>
  <LegalSection title="4. Sécurité par conception"><p>Les permissions, l’isolation des espaces, les secrets, les connexions bancaires et les actions sensibles doivent être protégés dès la conception et testés régulièrement.</p></LegalSection>
  <LegalSection title="5. IA responsable"><p>LIA peut se tromper. Les fonctionnalités doivent donc distinguer observation, estimation, recommandation et action, avec des garde-fous adaptés au niveau de risque.</p></LegalSection>
  <LegalSection title="6. Pas de pression commerciale trompeuse"><p>NEXORA ne doit pas utiliser les données financières pour pousser artificiellement l’utilisateur vers une décision ou un produit financier. Toute offre commerciale doit être présentée de manière identifiable et transparente.</p></LegalSection>
  <LegalSection title="7. Accessibilité et mobilité"><p>L’expérience doit rester utilisable sur ordinateur, tablette et téléphone. Une application mobile dédiée est prévue dans la feuille de route et devra reprendre les mêmes principes de sécurité et de confidentialité.</p></LegalSection>
</LegalPage>; }

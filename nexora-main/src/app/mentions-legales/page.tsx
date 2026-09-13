import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { legalConfig } from "@/lib/legal/config";

export default function LegalNoticePage() { return <LegalPage title="Mentions légales" eyebrow="Informations éditeur">
  <LegalSection title="Éditeur"><p><strong>{legalConfig.publisherName}</strong><br />{legalConfig.legalForm}<br />Capital : {legalConfig.capital}<br />Siège social : {legalConfig.address}<br />Immatriculation : {legalConfig.registration}<br />TVA : {legalConfig.vat}</p></LegalSection>
  <LegalSection title="Directeur de la publication"><p>{legalConfig.publicationDirector}</p></LegalSection>
  <LegalSection title="Hébergement"><p>{legalConfig.hostingName}<br />{legalConfig.hostingAddress}</p></LegalSection>
  <LegalSection title="Contact"><p>{legalConfig.contactEmail}</p></LegalSection>
  <LegalSection title="Propriété intellectuelle"><p>Les éléments de NEXORA — marque, identité visuelle, textes, interfaces, logiciels, bases de données et contenus — sont protégés par les droits applicables. Toute reproduction ou réutilisation non autorisée est interdite dans les limites prévues par la loi.</p></LegalSection>
</LegalPage>; }

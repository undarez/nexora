export const legalConfig = {
  productName: "NEXORA",
  publisherName: process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME || "[DÉNOMINATION SOCIALE À COMPLÉTER]",
  legalForm: process.env.NEXT_PUBLIC_LEGAL_ENTITY_FORM || "[FORME JURIDIQUE À COMPLÉTER]",
  capital: process.env.NEXT_PUBLIC_LEGAL_CAPITAL || "[CAPITAL SOCIAL À COMPLÉTER SI APPLICABLE]",
  address: process.env.NEXT_PUBLIC_LEGAL_ADDRESS || "[ADRESSE DU SIÈGE SOCIAL À COMPLÉTER]",
  registration: process.env.NEXT_PUBLIC_LEGAL_REGISTRATION || "[SIREN / SIRET / RCS À COMPLÉTER]",
  vat: process.env.NEXT_PUBLIC_LEGAL_VAT || "[N° TVA INTRACOMMUNAUTAIRE À COMPLÉTER SI APPLICABLE]",
  publicationDirector: process.env.NEXT_PUBLIC_LEGAL_PUBLICATION_DIRECTOR || "[DIRECTEUR / DIRECTRICE DE LA PUBLICATION À COMPLÉTER]",
  hostingName: process.env.NEXT_PUBLIC_HOSTING_NAME || "[HÉBERGEUR À COMPLÉTER]",
  hostingAddress: process.env.NEXT_PUBLIC_HOSTING_ADDRESS || "[ADRESSE DE L’HÉBERGEUR À COMPLÉTER]",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "[EMAIL DE CONTACT À COMPLÉTER]",
  privacyEmail: process.env.NEXT_PUBLIC_PRIVACY_EMAIL || "[EMAIL DONNÉES PERSONNELLES À COMPLÉTER]",
  dpoEmail: process.env.NEXT_PUBLIC_DPO_EMAIL || "[EMAIL DPO / POINT DE CONTACT RGPD À COMPLÉTER]",
  mediationName: process.env.NEXT_PUBLIC_MEDIATOR_NAME || "[MÉDIATEUR DE LA CONSOMMATION À DÉSIGNER AVANT COMMERCIALISATION]",
  mediationUrl: process.env.NEXT_PUBLIC_MEDIATOR_URL || "[URL DU MÉDIATEUR À COMPLÉTER]",
  lastUpdated: "14 septembre 2026",
};

export const legalPlaceholder = "Les informations d’identification de l’éditeur doivent provenir de la configuration juridique réelle avant une mise en production commerciale.";

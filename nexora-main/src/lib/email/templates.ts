import { emailLayout, escapeHtml } from "./brand";

export function confirmationEmail(url: string, name?: string) {
  const greeting = name ? `Bonjour ${escapeHtml(name)},` : "Bonjour,";
  return emailLayout("Confirmez votre adresse email", "Bienvenue chez NEXORA — confirmez votre adresse pour commencer.", `<p>${greeting}</p><p>Merci d’avoir créé votre compte NEXORA. Pour sécuriser votre compte et commencer votre configuration financière, confirmez votre adresse email.</p><p style="color:#6b7280;font-size:14px">Ce lien est personnel et doit rester confidentiel.</p>`, { label: "Confirmer mon adresse email", href: url });
}

export function passwordResetEmail(url: string) {
  return emailLayout("Réinitialiser votre mot de passe", "Une demande de réinitialisation de mot de passe NEXORA a été effectuée.", `<p>Vous avez demandé à réinitialiser votre mot de passe NEXORA.</p><p>Utilisez le bouton ci-dessous pour choisir un nouveau mot de passe. Si vous n’êtes pas à l’origine de cette demande, aucune action n’est nécessaire.</p>`, { label: "Réinitialiser mon mot de passe", href: url });
}

export function magicLinkEmail(url: string) {
  return emailLayout("Connexion à NEXORA", "Votre lien de connexion sécurisé NEXORA est prêt.", `<p>Voici votre lien de connexion. Il vous permet d’accéder à votre compte sans saisir votre mot de passe.</p><p style="color:#6b7280;font-size:14px">Pour votre sécurité, ne transférez pas cet email.</p>`, { label: "Me connecter à NEXORA", href: url });
}

export function enterpriseInviteEmail(url: string, companyName: string, inviterName?: string) {
  return emailLayout(`Invitation à ${companyName}`, "Vous avez été invité à rejoindre un espace Entreprise NEXORA.", `<p>Vous avez été invité${inviterName ? ` par ${escapeHtml(inviterName)}` : ""} à rejoindre l’espace Entreprise <strong>${escapeHtml(companyName)}</strong> sur NEXORA.</p><p>Vous pourrez consulter et gérer les informations auxquelles votre rôle vous donne accès.</p>`, { label: "Accepter l’invitation", href: url });
}

export function bankReconnectEmail(url: string, bankName: string, dueDate: string) {
  return emailLayout("Votre connexion bancaire arrive à échéance", `La connexion ${bankName} doit être renouvelée avant le ${dueDate}.`, `<p>La connexion à <strong>${escapeHtml(bankName)}</strong> doit être renouvelée avant le <strong>${escapeHtml(dueDate)}</strong>.</p><p>Cette étape permet à NEXORA de continuer à synchroniser vos données bancaires selon la politique de reconnexion de 90 jours.</p>`, { label: "Reconnecter ma banque", href: url });
}

export function securityAlertEmail(message: string) {
  return emailLayout("Alerte de sécurité NEXORA", "Une activité importante concernant votre compte NEXORA a été détectée.", `<p>${escapeHtml(message)}</p><p>Si cette activité ne vient pas de vous, connectez-vous à NEXORA et vérifiez immédiatement la sécurité de votre compte.</p>`);
}

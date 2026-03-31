export const TEMPLATES: Record<string, { label: string; content: string }[]> = {
  RCPH: [
    { label: "Réponse standard RCPH", content: "Bonjour,\n\nSuite à votre demande concernant la RCPH, voici notre analyse :\n\n[Votre analyse ici]\n\nN'hésitez pas à revenir vers nous pour toute question.\n\nCordialement,\nL'équipe Underwriting" },
    { label: "Demande de complément RCPH", content: "Bonjour,\n\nNous avons bien reçu votre demande RCPH. Afin de pouvoir vous répondre précisément, nous aurions besoin des éléments suivants :\n\n- \n- \n\nMerci d'avance.\n\nCordialement,\nL'équipe Underwriting" },
  ],
  RCPA: [
    { label: "Réponse standard RCPA", content: "Bonjour,\n\nSuite à votre demande concernant la RCPA, voici notre analyse :\n\n[Votre analyse ici]\n\nCordialement,\nL'équipe Underwriting" },
  ],
  MRPH: [
    { label: "Réponse standard MRPH", content: "Bonjour,\n\nSuite à votre demande MRP Habitation, voici notre retour :\n\n[Votre analyse ici]\n\nCordialement,\nL'équipe Underwriting" },
  ],
  MRPW: [
    { label: "Réponse standard MRPW", content: "Bonjour,\n\nSuite à votre demande MRP, voici notre retour :\n\n[Votre analyse ici]\n\nCordialement,\nL'équipe Underwriting" },
  ],
  default: [
    { label: "Réponse générique", content: "Bonjour,\n\nSuite à votre demande, voici notre analyse :\n\n[Votre analyse ici]\n\nCordialement,\nL'équipe Underwriting" },
    { label: "Demande de complément", content: "Bonjour,\n\nNous avons bien reçu votre demande. Afin de pouvoir vous répondre précisément, nous aurions besoin des éléments suivants :\n\n- \n- \n\nMerci d'avance.\n\nCordialement,\nL'équipe Underwriting" },
  ],
}

export function getTemplates(productType: string) {
  return [...(TEMPLATES[productType] ?? []), ...TEMPLATES.default]
}

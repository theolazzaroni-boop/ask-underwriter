import { PRODUCT_TYPES } from './types'

export function buildAskModal(channelId: string) {
  return {
    type: 'modal' as const,
    callback_id: 'ask_underwriter_submit',
    private_metadata: channelId,
    title: { type: 'plain_text' as const, text: 'Ask Underwriter' },
    submit: { type: 'plain_text' as const, text: 'Envoyer' },
    close: { type: 'plain_text' as const, text: 'Annuler' },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn' as const,
          text: "Décris la question que tu souhaites poser à l'équipe Underwriting.",
        },
      },
      {
        type: 'input',
        block_id: 'product',
        element: {
          type: 'static_select' as const,
          action_id: 'value',
          placeholder: { type: 'plain_text' as const, text: 'Sur quel produit porte ta question ?' },
          options: PRODUCT_TYPES.map((p) => ({
            text: { type: 'plain_text' as const, text: p },
            value: p,
          })),
        },
        label: { type: 'plain_text' as const, text: "Produit d'assurance" },
      },
      {
        type: 'input',
        block_id: 'priority',
        element: {
          type: 'radio_buttons' as const,
          action_id: 'value',
          options: [
            { text: { type: 'plain_text' as const, text: 'Normal' }, value: 'normal' },
            { text: { type: 'plain_text' as const, text: 'Haute priorité ⚠️' }, value: 'high' },
            { text: { type: 'plain_text' as const, text: 'Urgent 🔴' }, value: 'urgent' },
          ],
          initial_option: {
            text: { type: 'plain_text' as const, text: 'Normal' },
            value: 'normal',
          },
        },
        label: { type: 'plain_text' as const, text: 'Priorité' },
      },
      {
        type: 'input',
        block_id: 'description',
        element: {
          type: 'plain_text_input' as const,
          action_id: 'value',
          multiline: true,
          placeholder: {
            type: 'plain_text' as const,
            text: 'Décris ta question en détail, ajoute les liens utiles...',
          },
        },
        label: { type: 'plain_text' as const, text: 'Description détaillée' },
      },
      {
        type: 'input',
        block_id: 'bo_url',
        optional: true,
        element: {
          type: 'plain_text_input' as const,
          action_id: 'value',
          placeholder: { type: 'plain_text' as const, text: 'https://app.orus.eu/bo/...' },
        },
        label: { type: 'plain_text' as const, text: 'Lien Back-Office (facultatif)' },
      },
      {
        type: 'input',
        block_id: 'hubspot_url',
        optional: true,
        element: {
          type: 'plain_text_input' as const,
          action_id: 'value',
          placeholder: { type: 'plain_text' as const, text: 'https://app.hubspot.com/contacts/...' },
        },
        label: { type: 'plain_text' as const, text: 'Lien HubSpot (facultatif)' },
      },
      {
        type: 'input',
        block_id: 'attachments',
        optional: true,
        element: {
          type: 'file_input' as const,
          action_id: 'value',
          filetypes: ['pdf', 'png', 'jpg', 'jpeg', 'webp'],
          max_files: 5,
        },
        label: { type: 'plain_text' as const, text: 'Fichiers joints (facultatif)' },
      },
    ],
  }
}

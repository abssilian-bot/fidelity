const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)

export function loginEmail(link: string) {
  return {
    subject: 'Fidelity — ton lien de connexion',
    text: `Bonjour !\n\nTa prochaine bonne table t’attend. Pour retrouver tes cartes et tes récompenses, connecte-toi à Fidelity :\n${link}\n\nCe lien est valable 15 minutes, une seule utilisation.\n\nTu n'as rien demandé ? Ignore cet e-mail.\n\nÀ très vite,\nL’équipe Fidelity`,
    html: `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#fbf5ed;font-family:Arial,sans-serif;color:#2e1a0e;">
<table role="presentation" style="width:100%;max-width:520px;margin:auto;border-spacing:0;background:#fff;border:1px solid #ecdfcf;border-radius:20px;"><tr><td style="padding:32px;">
<p style="margin:0 0 24px;color:#c4410f;font-size:18px;letter-spacing:3px;">FIDELITY</p>
<h1 style="margin:0 0 18px;font-size:25px;line-height:1.3;">À table, tout simplement.</h1>
<p style="font-size:16px;line-height:1.7;">Bonjour ! Ta prochaine bonne table t’attend. Retrouve tes cartes de fidélité et tes récompenses en un clic.</p>
<p style="margin:28px 0;"><a href="${escapeHtml(link)}" style="display:inline-block;background:#c4410f;color:#fff;text-decoration:none;border-radius:28px;padding:16px 28px;font-size:16px;">Me connecter</a></p>
<p style="font-size:14px;line-height:1.7;color:#8f7261;">Ce lien est valable 15 minutes, une seule utilisation.</p>
<p style="font-size:13px;line-height:1.7;color:#8f7261;">Tu n'as rien demandé ? Ignore cet e-mail.</p>
<p style="margin:24px 0 0;font-size:14px;line-height:1.7;">À très vite,<br>L’équipe Fidelity</p>
</td></tr></table></body></html>`,
  }
}

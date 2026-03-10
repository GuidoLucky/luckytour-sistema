export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { to, subject, html, attachment } = req.body;
  if (!to || !subject || !html) return res.status(400).json({ error: "Faltan campos" });

  const payload = {
    from: "Lucky Tour <guido@luckytourviajes.com>",
    to: [to],
    subject,
    html,
  };

  if (attachment) {
    payload.attachments = [{
      filename: attachment.filename,
      content: attachment.content,
    }];
  }

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + process.env.RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!r.ok) return res.status(400).json({ error: data.message || data.name || JSON.stringify(data) });
    return res.status(200).json({ ok: true, id: data.id });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

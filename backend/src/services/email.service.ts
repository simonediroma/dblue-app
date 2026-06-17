import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const emailEnabled = !!process.env.SMTP_HOST;

async function sendMail(to: string, subject: string, html: string): Promise<void> {
  if (!emailEnabled) {
    console.log(`[Email] (simulato) A: ${to} | Oggetto: ${subject}`);
    return;
  }
  await transporter.sendMail({
    from: `"Presence App" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
}

export async function sendWaitingListPromotion(to: string, date: string): Promise<void> {
  await sendMail(
    to,
    `✅ Posto confermato in ufficio — ${date}`,
    `<p>Buone notizie! Un posto si è liberato e sei stato promosso dalla waiting list.</p>
     <p><strong>Data:</strong> ${date}</p>
     <p>Ricordati di fare check-in entro le 10:00.</p>`
  );
}

export async function sendSickLeaveConfirmation(to: string, date: string): Promise<void> {
  await sendMail(
    to,
    `Malattia registrata — ${date}`,
    `<p>La tua malattia per il giorno <strong>${date}</strong> è stata registrata.</p>
     <p>Recupera presto!</p>`
  );
}

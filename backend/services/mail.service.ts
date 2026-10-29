import nodemailer from 'nodemailer';

// E-posta gönderimi üç yoldan biriyle yapılır (öncelik sırasıyla):
// 1) BREVO_API_KEY varsa Brevo HTTP API'si — Render'ın ücretsiz planı gibi SMTP portlarının kapalı olduğu
//    ortamlarda da çalışır.
// 2) SMTP_HOST varsa SMTP (nodemailer).
// 3) Hiçbiri yoksa (geliştirme) e-posta gönderilmez, bağlantı konsola yazılır.
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT ?? '', 10) || 587,
      secure: parseInt(process.env.SMTP_PORT ?? '', 10) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

const getClientUrl = () => (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();

// MAIL_FROM: "SearchNote <adres@ornek.com>" ya da sadece "adres@ornek.com".
// Brevo'da bu adresin "Senders" bölümünde onaylanmış olması gerekir.
const parseSender = () => {
  const raw = (process.env.MAIL_FROM || 'SearchNote <no-reply@searchnote.app>').trim().replace(/^["']|["']$/g, '');
  const match = raw.match(/^(.*)<([^>]+)>$/);
  return match ? { name: match[1].trim() || 'SearchNote', email: match[2].trim() } : { name: 'SearchNote', email: raw };
};

interface MailMessage {
  to: string;
  toName: string;
  subject: string;
  text: string;
  html: string;
  // "Yanıtla" denince yazılacak adres (iletişim formu: formu gönderen kişi).
  replyTo?: { email: string; name: string };
}

// Kullanıcının yazdığı metin HTML maile güvenle konur.
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const sendWithBrevo = async ({ to, toName, subject, text, html, replyTo }: MailMessage) => {
  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY ?? '', 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: parseSender(),
      to: [{ email: to, name: toName }],
      subject,
      textContent: text,
      htmlContent: html,
      ...(replyTo && { replyTo }),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Brevo API ${res.status}: ${detail}`);
  }
};

const sendMail = async (message: MailMessage) => {
  if (process.env.BREVO_API_KEY) return sendWithBrevo(message);
  if (transporter) {
    const { name, email } = parseSender();
    return transporter.sendMail({
      from: `${name} <${email}>`,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      ...(message.replyTo && { replyTo: `${message.replyTo.name} <${message.replyTo.email}>` }),
    });
  }
  return null;
};

// Mail servisi yapılandırılmış mı (değilse bağlantı konsola yazılır).
const isMailConfigured = () => Boolean(process.env.BREVO_API_KEY || transporter);

const sendVerificationEmail = async (user: { email: string; fullName: string }, token: string) => {
  const link = `${getClientUrl()}/verify-email?token=${token}`;

  if (!isMailConfigured()) {
    console.log(`📧 [DEV] Verification link for ${user.email}: ${link}`);
    return;
  }

  await sendMail({
    to: user.email,
    toName: user.fullName,
    subject: 'SearchNote - Verify your email address',
    text: `Hi ${user.fullName},\n\nClick the link below to verify your SearchNote account:\n${link}\n\nThe link is valid for 24 hours.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1f2937">
      <h2 style="color:#1e3050">Welcome to SearchNote, ${user.fullName}!</h2>
      <p>Click the button below to verify your email address and start sharing notes.</p>
      <p style="margin:28px 0">
        <a href="${link}" style="background:#365188;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">
          Verify my email address
        </a>
      </p>
      <p style="font-size:13px;color:#6b7280">The link is valid for 24 hours. If you didn't create a SearchNote account, you can ignore this email.</p>
    </div>`,
  });
};

const sendPasswordResetCode = async (user: { email: string; fullName: string }, code: string, ttlMinutes: number) => {
  if (!isMailConfigured()) {
    console.log(`📧 [DEV] Password reset code for ${user.email}: ${code}`);
    return;
  }

  await sendMail({
    to: user.email,
    toName: user.fullName,
    subject: `${code} is your SearchNote password reset code`,
    text: `Hi ${user.fullName},\n\nWe received a request to reset your SearchNote password. Enter this code in the app:\n\n${code}\n\nThe code is valid for ${ttlMinutes} minutes. If you didn't request this, you can ignore this email — your password won't change.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1f2937">
      <h2 style="color:#1e3050">Reset your password</h2>
      <p>Hi ${user.fullName}, we received a request to reset your SearchNote password. Enter this code in the app:</p>
      <p style="margin:28px 0;font-size:32px;font-weight:bold;letter-spacing:8px;color:#1e3050">${code}</p>
      <p style="font-size:13px;color:#6b7280">The code is valid for ${ttlMinutes} minutes. If you didn't request this, you can ignore this email — your password won't change.</p>
    </div>`,
  });
};

// Mobil uygulamada kayıt olmadan önce e-posta adresini doğrulamak için gönderilen kod (hesap henüz yok, isim bilinmiyor).
const sendSignupCode = async (email: string, code: string, ttlMinutes: number) => {
  if (!isMailConfigured()) {
    console.log(`📧 [DEV] Sign-up code for ${email}: ${code}`);
    return;
  }

  await sendMail({
    to: email,
    toName: email,
    subject: `${code} is your SearchNote confirmation code`,
    text: `Welcome to SearchNote!\n\nEnter this code in the app to confirm your email address:\n\n${code}\n\nThe code is valid for ${ttlMinutes} minutes. If you didn't try to sign up, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1f2937">
      <h2 style="color:#1e3050">Confirm your email</h2>
      <p>Welcome to SearchNote! Enter this code in the app to confirm your email address:</p>
      <p style="margin:28px 0;font-size:32px;font-weight:bold;letter-spacing:8px;color:#1e3050">${code}</p>
      <p style="font-size:13px;color:#6b7280">The code is valid for ${ttlMinutes} minutes. If you didn't try to sign up, you can ignore this email.</p>
    </div>`,
  });
};

// Hesabı silmeden önce gönderilen onay kodu.
const sendAccountDeletionCode = async (user: { email: string; fullName: string }, code: string, ttlMinutes: number) => {
  if (!isMailConfigured()) {
    console.log(`📧 [DEV] Account deletion code for ${user.email}: ${code}`);
    return;
  }

  await sendMail({
    to: user.email,
    toName: user.fullName,
    subject: `${code} is your SearchNote account deletion code`,
    text: `Hi ${user.fullName},\n\nWe received a request to permanently delete your SearchNote account. Enter this code in the app to confirm:\n\n${code}\n\nThe code is valid for ${ttlMinutes} minutes. If you didn't request this, don't share this code with anyone and change your password — someone may have access to your account.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1f2937">
      <h2 style="color:#1e3050">Confirm account deletion</h2>
      <p>Hi ${user.fullName}, we received a request to permanently delete your SearchNote account. Enter this code in the app to confirm:</p>
      <p style="margin:28px 0;font-size:32px;font-weight:bold;letter-spacing:8px;color:#b91c1c">${code}</p>
      <p style="font-size:13px;color:#6b7280">The code is valid for ${ttlMinutes} minutes. If you didn't request this, don't share this code with anyone and change your password — someone may have access to your account.</p>
    </div>`,
  });
};

// Hesap silindikten sonra bilgilendirme (kullanıcı farkında olmadan silindiyse haberi olsun).
const sendAccountDeletedEmail = async (user: { email: string; fullName: string }) => {
  if (!isMailConfigured()) {
    console.log(`📧 [DEV] Account deleted notice for ${user.email}`);
    return;
  }

  const contact = `${getClientUrl()}/contact`;
  await sendMail({
    to: user.email,
    toName: user.fullName,
    subject: 'Your SearchNote account has been deleted',
    text: `Hi ${user.fullName},\n\nYour SearchNote account (${user.email}) and everything in it — notes, messages, comments and followers — has been permanently deleted.\n\nIf you didn't do this, please contact us right away: ${contact}\n\nThanks for being part of SearchNote.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1f2937">
      <h2 style="color:#1e3050">Your account has been deleted</h2>
      <p>Hi ${user.fullName}, your SearchNote account (<b>${user.email}</b>) and everything in it — notes, messages, comments and followers — has been permanently deleted.</p>
      <p style="font-size:13px;color:#6b7280;margin-top:24px">If you didn't do this, please <a href="${contact}" style="color:#365188">contact us</a> right away.</p>
      <p style="font-size:13px;color:#6b7280">Thanks for being part of SearchNote.</p>
    </div>`,
  });
};

const CONTACT_TOPIC_LABELS: Record<string, string> = {
  general: 'General question',
  support: 'Account & technical support',
  copyright: 'Copyright / report content',
  privacy: 'Privacy & KVKK request',
  feedback: 'Feedback & ideas',
};

interface ContactMail {
  name: string;
  email: string;
  topic: string;
  message: string;
  userId?: string;
}

// İletişim formu mesajı CONTACT_INBOX adresine gider; "Yanıtla" doğrudan formu gönderen kişiye yazar.
// CONTACT_INBOX boşsa ya da mail servisi kurulu değilse gönderilmez (mesaj yine veritabanında durur).
const sendContactNotification = async ({ name, email, topic, message, userId }: ContactMail) => {
  const inbox = process.env.CONTACT_INBOX?.trim();
  if (!inbox || !isMailConfigured()) {
    console.log(`📧 [DEV] Contact message from ${email} (${topic}) — not emailed (CONTACT_INBOX or mail service missing).`);
    return;
  }
  const topicLabel = CONTACT_TOPIC_LABELS[topic] ?? topic;
  const profile = userId ? `${getClientUrl()}/users/${userId}` : '';

  await sendMail({
    to: inbox,
    toName: 'SearchNote',
    replyTo: { email, name },
    subject: `[SearchNote · ${topicLabel}] ${name}`,
    text: `${topicLabel}\n\nFrom: ${name} <${email}>${profile ? `\nProfile: ${profile}` : '\n(Not signed in)'}\n\n${message}\n\nReply to this email to answer ${name}.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1f2937">
      <p style="margin:0 0 4px;font-size:12px;font-weight:bold;letter-spacing:.5px;text-transform:uppercase;color:#365188">${escapeHtml(topicLabel)}</p>
      <h2 style="margin:0 0 16px;color:#1e3050">${escapeHtml(name)}</h2>
      <p style="margin:0 0 4px"><a href="mailto:${escapeHtml(email)}" style="color:#365188">${escapeHtml(email)}</a></p>
      <p style="margin:0 0 20px;font-size:13px;color:#6b7280">${
        profile ? `<a href="${profile}" style="color:#365188">View SearchNote profile</a>` : 'Not signed in'
      }</p>
      <div style="white-space:pre-wrap;background:#f3f4f6;border-radius:10px;padding:14px 16px;line-height:1.5">${escapeHtml(message)}</div>
      <p style="margin-top:20px;font-size:13px;color:#6b7280">Reply to this email to answer ${escapeHtml(name)} directly.</p>
    </div>`,
  });
};

// Formu gönderen kişiye "mesajını aldık" onayı (mesajının bir kopyasıyla).
const sendContactConfirmation = async ({ name, email, topic, message }: ContactMail) => {
  const inbox = process.env.CONTACT_INBOX?.trim();
  if (!inbox || !isMailConfigured()) return;
  const topicLabel = CONTACT_TOPIC_LABELS[topic] ?? topic;

  await sendMail({
    to: email,
    toName: name,
    replyTo: { email: inbox, name: 'SearchNote' },
    subject: 'We received your message - SearchNote',
    text: `Hi ${name},\n\nThanks for contacting SearchNote. We received your message and will get back to you as soon as we can.\n\nTopic: ${topicLabel}\n\n${message}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1f2937">
      <h2 style="color:#1e3050">Thanks for reaching out, ${escapeHtml(name)}!</h2>
      <p>We received your message and will get back to you as soon as we can. You can reply to this email to add anything.</p>
      <p style="margin:20px 0 6px;font-size:13px;color:#6b7280">Your message · ${escapeHtml(topicLabel)}</p>
      <div style="white-space:pre-wrap;background:#f3f4f6;border-radius:10px;padding:14px 16px;line-height:1.5">${escapeHtml(message)}</div>
    </div>`,
  });
};

export {
  sendContactNotification,
  sendContactConfirmation,
  sendVerificationEmail,
  sendPasswordResetCode,
  sendSignupCode,
  sendAccountDeletionCode,
  sendAccountDeletedEmail,
  isMailConfigured,
};

// Gönderilen mesajın istemci kimliği: "gönderiliyor" balonu kaydedilen mesajla eşlenir, tekrar denemede sunucu
// aynı mesajı iki kez kaydetmez.
export const newClientId = () =>
  typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Türkçe karakter ve büyük/küçük harf duyarsız karşılaştırma için metni sadeleştirir:
// "Boğaziçi" → "bogazici", "ODTÜ" → "odtu", "İTÜ" → "itu". Harf/rakam dışındaki her şey boşluk olur.
export const normalize = (text: string) =>
  text
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

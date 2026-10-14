// Ülke adları ISO kodundan (Node'un yerleşik Intl verisi): "DE" → "Germany", Türkçe "Almanya".
// Kaynaklardaki adlar tutarsız olabildiği ("CY", "The Netherlands"...) için her yerde bunlar kullanılır.
const english = new Intl.DisplayNames(['en'], { type: 'region' });
const turkish = new Intl.DisplayNames(['tr'], { type: 'region' });

const safe = (names: Intl.DisplayNames, code: string) => {
  try {
    return names.of(code) ?? code;
  } catch {
    return code;
  }
};

const EXTRA_ALIASES: Record<string, string[]> = {
  TR: ['Turkey', 'Turkiye'],
  US: ['USA', 'America'],
  GB: ['UK', 'England', 'Britain', 'İngiltere'],
  CY: ['KKTC', 'Kuzey Kıbrıs'],
};

export const countryName = (code: string) => (code === 'TR' ? 'Türkiye' : safe(english, code));

// Aramada bulunsun diye diğer adlar: Türkçe adı ve bilinen kısaltmalar ("Almanya", "Turkey", "USA")
export const countryAliases = (code: string) =>
  [...new Set([safe(turkish, code), ...(EXTRA_ALIASES[code] ?? [])])].filter((n) => n !== countryName(code));

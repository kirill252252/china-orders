// Адрес одной строкой.
export function formatAddress(a) {
  if (!a) return '';
  const parts = [
    a.postalCode,
    a.country,
    a.region,
    a.city,
    a.street && `ул. ${a.street}`,
    a.building && `д. ${a.building}`,
    a.apartment && `кв. ${a.apartment}`,
  ];
  return parts.filter(Boolean).join(', ');
}
export function educationText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : null;
}
export function educationLevels(value: string | null | undefined): string[] {
  const text = (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return ['fundamental', 'medio', 'tecnico', 'superior'].filter(level => text.includes(level));
}
export function newsImage(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['cdn.pci.app.br', 'www.pciconcursos.com.br'].includes(url.hostname) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

// Small renderer-safe formatting helpers. No Node.js APIs used here.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const currency = (value: number): string => {
  const abs = Math.abs(value)
  const formatted = `$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return value < 0 ? `-${formatted}` : formatted
}

export const currencyWhole = (value: number): string => {
  const abs = Math.round(Math.abs(value))
  const formatted = `$${abs.toLocaleString('en-US')}`
  return value < 0 ? `-${formatted}` : formatted
}

export const dateShort = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export const dateAbbr = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}

export const initials = (name: string): string =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
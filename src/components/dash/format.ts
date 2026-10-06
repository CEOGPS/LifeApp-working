export function fmtDate(value: string | Date | number) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}/${date.getFullYear()}`;
}

export function fmtTime(value: string | Date | number = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const hour24 = date.getHours();
  const hour = String(hour24 % 12 || 12).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${hour}:${minute} ${hour24 >= 12 ? "PM" : "AM"}`;
}

export function fmtDateInput(value: string) {
  const iso = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`;
  if (/[a-z]/i.test(value)) {
    const parsed = fmtDate(value);
    return parsed || value;
  }
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function fmtPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("1")) {
    const rest = digits.slice(1, 11);
    if (!rest) return "1";
    if (rest.length < 4) return `1(${rest}`;
    if (rest.length < 7) return `1(${rest.slice(0, 3)}) ${rest.slice(3)}`;
    return `1(${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6)}`;
  }
  const local = digits.slice(0, 10);
  if (local.length < 4) return local;
  if (local.length < 7) return `(${local.slice(0, 3)}) ${local.slice(3)}`;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

export function fmtMoney(value: number) {
  const amount = Number.isFinite(value) ? value : 0;
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

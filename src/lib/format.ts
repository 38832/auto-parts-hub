export function inr(n: number | string | null | undefined): string {
  const num = Number(n ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(num);
}

export function num(n: number | string | null | undefined): string {
  return new Intl.NumberFormat("en-IN").format(Number(n ?? 0));
}

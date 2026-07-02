import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBillingPeriod(date: Date | string): string {
  let d = new Date(date);
  if (isNaN(d.getTime()) && typeof date === 'string') {
    const parts = date.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        // DD/MM/YYYY
        d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00Z`);
      } else if (parts[0].length === 4) {
        // YYYY-MM-DD
        d = new Date(`${parts[0]}-${parts[1]}-${parts[2]}T12:00:00Z`);
      }
    }
  }
  if (isNaN(d.getTime())) {
    d = new Date();
  }
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${month}`;
}

export function getMonthOptions() {
  const options = [];
  const now = new Date();
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  
  // Last 6 months and next 3 months
  for (let i = -6; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = formatBillingPeriod(d);
    const label = `${monthNames[d.getMonth()]} - ${d.getFullYear()}`;
    options.push({ value, label });
  }
  return options;
}

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBillingPeriod(date: Date | string): string {
  const d = new Date(date);
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  return `${monthNames[d.getMonth()]} - ${d.getFullYear()}`;
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
    const label = `${monthNames[d.getMonth()]} - ${d.getFullYear()}`;
    options.push({ value: label, label });
  }
  return options;
}

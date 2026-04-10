export function cn(...inputs: Array<string | false | null | undefined>) {
  return inputs.filter(Boolean).join(" ");
}

export const SITE_COLORS: Record<string, string> = {
  KYAKALE: "#06D6A0",
  MUSHA: "#00B4D8",
  UMAISHA: "#FFB703",
  TUNGA: "#FB8500",
  OGUFA: "#EF4444",
};

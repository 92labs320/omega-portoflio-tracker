const ASSET_PALETTE = ['#00D964', '#00A3FF', '#FFA500', '#9B59B6', '#1ABC9C', '#E67E22', '#E91E63', '#3498DB'];

export function assetColor(symbol: string): string {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) % ASSET_PALETTE.length;
  return ASSET_PALETTE[h];
}

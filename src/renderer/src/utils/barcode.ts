const BARCODE_PATTERNS: number[][] = [
  [2,1,2,2,2,2],[2,2,2,1,2,2],[2,2,2,2,2,1],[1,2,1,2,2,3],[1,2,1,3,2,2],[1,3,1,2,2,2],[1,2,2,2,1,3],[1,2,2,3,1,2],[1,3,2,2,1,2],[2,2,1,2,1,3],[2,2,1,3,1,2],[2,3,1,2,1,2],[1,1,2,2,3,2],[1,2,2,1,3,2],[1,2,2,2,3,1],[1,1,3,2,2,2],[1,2,3,1,2,2],[1,2,3,2,2,1],[2,2,3,2,1,1],[2,2,1,1,3,2],[2,2,1,2,3,1],[2,1,3,2,1,2],[2,2,3,1,1,2],[3,1,2,1,3,1],[3,1,1,2,2,2],[3,2,1,1,2,2],[3,2,1,2,2,1],[3,1,2,2,1,2],[3,2,2,1,1,2],[3,2,2,2,1,1],[2,1,2,1,2,3],[2,1,2,3,2,1],[2,3,2,1,2,1],[1,1,1,3,2,3],[1,3,1,1,2,3],[1,3,1,3,2,1],[1,1,2,3,1,3],[1,3,2,1,1,3],[1,3,2,3,1,1],[2,1,1,3,1,3],[2,3,1,1,1,3],[2,3,1,3,1,1],[1,1,2,1,3,3],[1,1,2,3,3,1],[1,3,2,1,3,1],[1,1,3,1,2,3],[1,1,3,3,2,1],[1,3,3,1,2,1],[3,1,3,1,2,1],[2,1,1,3,3,1],[2,3,1,1,3,1],[2,1,3,1,1,3],[2,1,3,3,1,1],[2,1,3,1,3,1],[3,1,1,1,2,3],[3,1,1,3,2,1],[3,3,1,1,2,1],[3,1,2,1,1,3],[3,1,2,3,1,1],[3,3,2,1,1,1],[3,1,4,1,1,1],[2,2,1,4,1,1],[4,3,1,1,1,1],[1,1,1,2,2,4],[1,1,1,4,2,2],[1,2,1,1,2,4],[1,2,1,4,2,1],[1,4,1,1,2,2],[1,4,1,2,2,1],[1,1,2,2,1,4],[1,1,2,4,1,2],[1,2,2,1,1,4],[1,2,2,4,1,1],[1,4,2,1,1,2],[1,4,2,2,1,1],[2,4,1,2,1,1],[2,2,1,1,1,4],[4,1,3,1,1,1],[2,4,1,1,1,2],[1,3,4,1,1,1],[1,1,1,2,4,2],[1,2,1,1,4,2],[1,2,1,2,4,1],[1,1,4,2,1,2],[1,2,4,1,1,2],[1,2,4,2,1,1],[4,1,1,2,1,2],[4,2,1,1,1,2],[4,2,1,2,1,1],[2,1,2,1,4,1],[2,1,4,1,2,1],[4,1,2,1,2,1],[1,1,1,1,4,3],[1,1,1,3,4,1],[1,3,1,1,4,1],[1,1,4,1,1,3],[1,1,4,3,1,1],[4,1,1,1,1,3],[4,1,1,3,1,1],[1,1,3,1,4,1],[1,1,4,1,3,1],[3,1,1,1,4,1],[4,1,1,1,3,1],[2,1,1,4,1,2],[2,1,1,2,1,4],[2,1,1,2,3,2],[2,3,3,1,1,1,2]
];

export function barcodeValues(value: string): number[] {
  let s = String(value ?? '').trim();
  if (!s.length) throw new Error('Enter a SKU / barcode.');
  s = s.replace(/[^\x20-\x7E]/g, '');
  if (!s.length) throw new Error('Barcode must contain standard ASCII characters.');
  const vals = [104]; // Code 128B start
  for (const ch of s) {
    vals.push(ch.charCodeAt(0) - 32);
  }
  let sum = vals[0];
  for (let i = 1; i < vals.length; i++) {
    sum += vals[i] * i;
  }
  vals.push(sum % 103, 106); // checksum and stop
  return vals;
}

export function generateBarcodeSvg(value: string): string {
  try {
    const vals = barcodeValues(value);
    let x = 10;
    let rects = '';
    for (const v of vals) {
      let bar = true;
      const pattern = BARCODE_PATTERNS[v];
      if (!pattern) continue;
      for (const w of pattern) {
        const px = w * 2;
        if (bar) {
          rects += `<rect x="${x}" y="0" width="${px}" height="54" fill="#000"/>`;
        }
        x += px;
        bar = !bar;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" style="display:block" viewBox="0 0 ${x + 10} 54" preserveAspectRatio="none"><rect width="100%" height="100%" fill="#fff"/>${rects}</svg>`;
  } catch (e: any) {
    return `<div style="color:red;font-size:10px">${e.message || 'Invalid Barcode'}</div>`;
  }
}

export function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateSingleLabelHtml(params: {
  shopName: string;
  name: string;
  category?: string;
  size?: string;
  color?: string;
  sku: string;
  price: number;
}): string {
  const { shopName, name, category, size, color, sku, price } = params;
  const svg = generateBarcodeSvg(sku);

  return `
    <div class="barcode-label page-break" style="width:63mm;height:34mm;padding:1.5mm;box-sizing:border-box;text-align:center;font-family:Arial,sans-serif;color:#000;background:#fff;border:1px solid #e2e8f0;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;page-break-after:always;">
      <div style="font-family:Arial, 'Microsoft YaHei', SimHei, sans-serif;font-size:10.5pt;line-height:1.1;font-weight:800;white-space:nowrap;overflow:hidden">
        ${escapeHtml(shopName || 'KIDO 2628')} · 基多
      </div>
      <div style="font-size:8pt;line-height:1.1;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
        ${escapeHtml(name)}
      </div>
      ${category ? `<div style="font-size:7pt;line-height:1;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#334155">${escapeHtml(category)}</div>` : ''}
      <div style="font-size:6.5pt;line-height:1">
        Size: <b>${escapeHtml(size || 'One size')}</b>${color ? ` · Colour: <b>${escapeHtml(color)}</b>` : ''}
      </div>
      <div style="height:9mm;width:100%;flex:none">
        ${svg}
      </div>
      <div style="font:6.5pt/1 Arial,monospace;letter-spacing:0.5px;white-space:nowrap">
        ${escapeHtml(sku)}
      </div>
      <div style="font-size:9.5pt;line-height:1.1;font-weight:bold;white-space:nowrap">
        ₹${Number(price || 0).toFixed(2)}
      </div>
    </div>
  `;
}

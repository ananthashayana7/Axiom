import { NextResponse } from 'next/server';
import { getDashboardStats, getRecentOrders, getMonthlySpend, getCategorySpend } from '@/app/actions/dashboard';

function toCSV(rows: any[], headers?: string[]) {
  if (!rows || rows.length === 0) return '';
  const keys = headers || Object.keys(rows[0]);
  const lines = [keys.join(',')];
  for (const r of rows) {
    const vals = keys.map(k => {
      const v = r[k];
      if (v === null || v === undefined) return '';
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return '"' + s.replace(/"/g, '""') + '"';
    });
    lines.push(vals.join(','));
  }
  return lines.join('\n');
}

function renderTableHTML(title: string, rows: any[]) {
  if (!rows || rows.length === 0) return `<h3>${title}</h3><p>No data</p>`;
  const keys = Object.keys(rows[0]);
  const header = keys.map(k => `<th>${k}</th>`).join('');
  const body = rows.map(r => `<tr>${keys.map(k => `<td>${String(r[k] ?? '')}</td>`).join('')}</tr>`).join('');
  return `
    <section>
      <h3>${title}</h3>
      <div style="overflow:auto">
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse"> <thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>
      </div>
    </section>
  `;
}

function barChartSVG(data: { name: string; total: number }[], width = 600, height = 200) {
  const max = Math.max(...data.map(d => d.total), 1);
  const barW = Math.max(10, Math.floor(width / data.length) - 6);
  const bars = data.map((d, i) => {
    const h = Math.round((d.total / max) * (height - 40));
    const x = i * (barW + 6) + 40;
    const y = height - h - 20;
    return `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="#2563eb"></rect>
            <text x="${x + barW/2}" y="${height - 5}" font-size="10" text-anchor="middle">${d.name}</text>`;
  }).join('\n');
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><g>${bars}</g></svg>`;
}

function pieChartSVG(data: { name: string; value: number }[], width = 400, height = 300) {
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) / 3;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let angle = -Math.PI / 2;
  const colors = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
  const slices = data.map((d, i) => {
    const frac = d.value / total;
    const end = angle + frac * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const large = frac > 0.5 ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    angle = end;
    return `<path d="${path}" fill="${colors[i % colors.length]}" stroke="#fff"/>`;
  }).join('\n');
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${slices}</svg>`;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const format = (url.searchParams.get('format') || 'json').toLowerCase();
    const chartsParam = url.searchParams.get('charts') || '1';
    const includeCharts = chartsParam === '1' || chartsParam === 'true';

    const [stats, recentOrders, monthlySpend, categorySpend] = await Promise.all([
      getDashboardStats(),
      getRecentOrders(),
      getMonthlySpend(),
      getCategorySpend(),
    ]);

    if (format === 'csv') {
      // Create multiple CSV sections separated by headers
      const parts: string[] = [];
      parts.push('# Stats');
      parts.push(toCSV([stats]));
      parts.push('# RecentOrders');
      parts.push(toCSV(recentOrders));
      parts.push('# MonthlySpend');
      parts.push(toCSV(monthlySpend.map(m => ({ name: m.name, total: m.total }))));
      parts.push('# CategorySpend');
      parts.push(toCSV(categorySpend.map(c => ({ name: c.name, value: c.value }))));

      const body = parts.join('\n\n');
      return new NextResponse(body, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="axiom-data.csv"',
        },
      });
    }

    if (format === 'html') {
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Axiom Report</title></head><body>
        <h1>Axiom Export</h1>
        <p>Generated at: ${new Date().toISOString()}</p>
        ${renderTableHTML('Stats', [stats])}
        ${renderTableHTML('Recent Orders', recentOrders)}
        ${renderTableHTML('Monthly Spend', monthlySpend.map(m => ({ month: m.name, total: m.total })))}
        ${includeCharts ? barChartSVG(monthlySpend.map(m => ({ name: m.name, total: m.total }))) : ''}
        ${renderTableHTML('Category Spend', categorySpend)}
        ${includeCharts ? pieChartSVG(categorySpend) : ''}
      </body></html>`;

      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': 'attachment; filename="axiom-report.html"',
        },
      });
    }

    if (format === 'excel') {
      // Create a simple SpreadsheetML (Excel 2003 XML) workbook with multiple sheets
      const escapeXml = (s: any) => String(s === null || s === undefined ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

      const sheet = (name: string, rows: any[]) => {
        const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
        const header = cols.map(c => `<Cell><Data ss:Type="String">${escapeXml(c)}</Data></Cell>`).join('');
        const body = rows.map(r => `<Row>${cols.map(c => {
          const v = r[c];
          const type = typeof v === 'number' ? 'Number' : 'String';
          return `<Cell><Data ss:Type="${type}">${escapeXml(v)}</Data></Cell>`;
        }).join('')}</Row>`).join('');

        return `<Worksheet ss:Name="${escapeXml(name)}"><Table>${cols.length ? `<Row>${header}</Row>` : ''}${body}</Table></Worksheet>`;
      };

      const partsXml: string[] = [];
      partsXml.push(sheet('Stats', [stats]));
      partsXml.push(sheet('RecentOrders', recentOrders));
      partsXml.push(sheet('MonthlySpend', monthlySpend.map(m => ({ Month: m.name, Total: m.total }))));
      partsXml.push(sheet('CategorySpend', categorySpend.map(c => ({ Category: c.name, Value: c.value }))));

      const workbook = `<?xml version="1.0"?>
        <?mso-application progid="Excel.Sheet"?>
        <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
          ${partsXml.join('\n')}
        </Workbook>`;

      return new NextResponse(workbook, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.ms-excel',
          'Content-Disposition': 'attachment; filename="axiom-data.xls"',
        },
      });
    }

    // default json
    const payload = {
      generatedAt: new Date().toISOString(),
      stats,
      recentOrders,
      monthlySpend,
      categorySpend,
    };

    const body = JSON.stringify(payload, null, 2);

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="axiom-data.json"',
      },
    });
  } catch (err) {
    console.error('Failed to prepare download', err);
    return new NextResponse(JSON.stringify({ error: 'Failed to prepare download' }), { status: 500 });
  }
}

import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = new URL('../public/', import.meta.url);
const output = new URL('../dist/', import.meta.url);
const outputPath = fileURLToPath(output);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });

const config = process.env.VERCEL_OBSERVABILITY_CLIENT_CONFIG
  ? JSON.parse(process.env.VERCEL_OBSERVABILITY_CLIENT_CONFIG)
  : {};
const scriptSrc = config?.analytics?.scriptSrc;
let snippet = '';

if (scriptSrc !== undefined) {
  if (typeof scriptSrc !== 'string' || !/^\/?[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\/script\.js$/.test(scriptSrc)) {
    throw new Error('Vercel entregó una ruta inválida para Web Analytics.');
  }

  const absoluteScriptSrc = scriptSrc.startsWith('/') ? scriptSrc : `/${scriptSrc}`;
  snippet = `<script>
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
</script>
<script defer src="${absoluteScriptSrc}"></script>
`;
} else {
  console.warn('Web Analytics aún no tiene ruta de script en la configuración de Vercel.');
}

async function* htmlFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.isFile() && entry.name.endsWith('.html')) yield path;
  }
}

for await (const path of htmlFiles(outputPath)) {
  if (!snippet) continue;
  const html = await readFile(path, 'utf8');
  if (html.split('</head>').length !== 2) {
    throw new Error(`El HTML debe tener un solo </head>: ${path}`);
  }
  await writeFile(path, html.replace('</head>', `${snippet}</head>`));
}

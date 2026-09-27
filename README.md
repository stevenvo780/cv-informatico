# CV — Steven Vallejo Ortiz (Software Engineer)

Sitio web estático, bilingüe (ES/EN), del CV técnico de Steven Vallejo Ortiz.
HTML + CSS + `app.js` (vanilla JS) que renderiza los datos y maneja el toggle
ES/EN, y `graph.js`, el grafo de dependencias del hero (canvas 2D, sin librerías).
El build copia `public/` a `dist/` e incorpora Web Analytics cuando Vercel
entrega su configuración.

Estética: la de la portada de stevenvallejo.com (negro profundo, acentos como luz,
Cormorant + Geist + JetBrains Mono) llevada a código: call graph animado con las
tecnologías y proyectos reales, un `steven.ts` que se escribe solo, la pila como
`tree`, la experiencia como branch graph de git y el contacto como `contact.env`.
Con `prefers-reduced-motion` el grafo queda estático y nada se anima.

## Estructura

```
index.html        Estructura, <head> con SEO + JSON-LD schema.org Person
styles.css        Estilos (fondo #05090b, crema #e8e0d4, teal #43b5a6, dorado #e0a85e, violeta #8d7cc0, óxido #cf6a3c)
data.js           Fuente de datos bilingüe (97 skills, 15 experiencias, 66+ proyectos, 8 logros, servicios)
app.js            Render + toggle ES/EN, editor que se escribe, índice activo (sin dependencias)
graph.js          Grafo del hero: capas autor → proyectos → frameworks → lenguajes → infra
vercel.json       Config Vercel (salida dist/, cleanUrls, headers, cache PDFs)
robots.txt        SEO
public/pdf/       PDFs descargables (CV y CV ATS, ES/EN)
```

## Idioma

- ES por defecto. Toggle ES/EN en la barra superior.
- También se puede forzar con `?lang=en` / `?lang=es` o el ancla `#en`.
- La preferencia se guarda en `localStorage`.

## Desarrollo local

```bash
cd /workspace/cv-informatico
python3 -m http.server 4321
# abrir http://localhost:4321
```

## Despliegue en Vercel

Sitio 100% estático, sin framework. `npm run build` prepara `dist/`; si Web
Analytics está habilitado, inserta en cada HTML servido la ruta de script única
que Vercel entrega para ese despliegue. Sin esa ruta, no carga el script.
Desde la raíz del proyecto:

```bash
cd /workspace/cv-informatico
vercel --prod
```

(o `vercel` para un preview). "Build Command" = `npm run build` y
"Output Directory" = `dist`.

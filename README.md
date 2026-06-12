# CV — Steven Vallejo Ortiz (Software Engineer)

Sitio web estático, bilingüe (ES/EN), del CV técnico de Steven Vallejo Ortiz.
Sin paso de build: HTML + CSS + un único `app.js` (vanilla JS) que renderiza
los datos y maneja el toggle ES/EN. Cero riesgo de build en Vercel.

## Estructura

```
index.html        Estructura, <head> con SEO + JSON-LD schema.org Person
styles.css        Estilos (paleta de marca: bg #0b1417, crema #f3ece0, teal #43b5a6, dorado #e0a85e)
data.js           Fuente de datos bilingüe (97 skills, 15 experiencias, 66+ proyectos, 8 logros, servicios)
app.js            Render + toggle ES/EN (sin dependencias)
vercel.json       Config Vercel (cleanUrls, headers, cache PDFs)
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

Sitio 100% estático, sin framework. Desde la raíz del proyecto:

```bash
cd /workspace/cv-informatico
vercel --prod
```

(o `vercel` para un preview). No requiere `Build Command`; Vercel sirve los
archivos estáticos directamente. El `Output Directory` es la raíz del repo.

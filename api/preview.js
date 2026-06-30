/* Simple preview page for sharing images on platforms that require og:image metadata.
   Usage: /api/preview?img=<encoded-url>&title=<optional-title>
   LinkedIn will scrape og:image and create a rich preview. */

export default function handler(req, res) {
  const { img, title = 'Visuel Efficience' } = req.query;

  if (!img) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<h1>Image URL required</h1><p>Use ?img=<url>&title=<optional></p>');
    return;
  }

  let imageUrl = '';
  try {
    imageUrl = decodeURIComponent(String(img));
  } catch {
    imageUrl = String(img);
  }

  // Validate it's a URL (basic check)
  if (!imageUrl.startsWith('http')) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<h1>Invalid image URL</h1>');
    return;
  }

  const escapedTitle = String(title).replace(/"/g, '&quot;').slice(0, 100);
  const escapedImg = imageUrl.replace(/"/g, '&quot;');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapedTitle}</title>
  <meta property="og:title" content="${escapedTitle}">
  <meta property="og:image" content="${escapedImg}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:description" content="Visuel partagé via Efficience">
  <meta property="og:type" content="article">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${escapedImg}">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    img { max-width: 100%; height: auto; border-radius: 4px; margin: 20px 0; }
    h1 { margin: 0 0 10px 0; font-size: 24px; color: #333; }
    p { color: #666; margin: 10px 0; }
    .back-link { display: inline-block; margin-top: 20px; padding: 10px 16px; background: #0a66c2; color: white; text-decoration: none; border-radius: 4px; font-size: 14px; }
    .back-link:hover { background: #054399; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${escapedTitle}</h1>
    <p>Visuel partagé via Efficience Marketing</p>
    <img src="${escapedImg}" alt="${escapedTitle}">
    <p>Ce visuel a été généré et est prêt à être partagé.</p>
    <a href="https://www.linkedin.com/feed/" class="back-link">Retour à LinkedIn</a>
  </div>
</body>
</html>`;

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.end(html);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. Verificación básica de contraseña
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'fletesadmin';

  if (token !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  // 2. Variables de entorno necesarias
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: 'GITHUB_TOKEN no configurado en Vercel' });
  }

  const GITHUB_OWNER = 'valenruffo';
  const GITHUB_REPO = 'fletes_app';
  
  // Obtener cliente si es que se pasa como query param
  const client = req.query.client || '';
  const clientName = client.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const FILE_PATH = clientName ? `clientes/${clientName}/config.json` : 'config.json';
  
  try {
    const newConfigStr = JSON.stringify(req.body, null, 2);
    const encodedContent = Buffer.from(newConfigStr).toString('base64');

    const fileUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`;

    // 3. Obtener el SHA actual del archivo (requerido para actualizar en GitHub)
    const getRes = await fetch(fileUrl, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    let sha = '';
    if (getRes.ok) {
      const getJson = await getRes.json();
      sha = getJson.sha;
    } else if (getRes.status !== 404) {
      // Si falla y no es un 404 (archivo no existe), retornar error
      const errorText = await getRes.text();
      return res.status(500).json({ error: 'Error obteniendo SHA de GitHub', details: errorText });
    }

    // 4. Actualizar el archivo con el nuevo contenido
    const putRes = await fetch(fileUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: clientName ? `Update config.json for client ${clientName} via Admin Panel` : 'Update config.json via Admin Panel',
        content: encodedContent,
        sha: sha || undefined
      })
    });

    if (putRes.ok) {
      return res.status(200).json({ success: true, message: 'Config updated in GitHub. Vercel is deploying...' });
    } else {
      const putError = await putRes.text();
      return res.status(500).json({ error: 'Error actualizando archivo en GitHub', details: putError });
    }

  } catch (err) {
    console.error("Error inesperado en save.js:", err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

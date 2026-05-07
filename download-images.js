const fs = require('fs');
const path = require('path');
const https = require('https');

const API_URL = 'http://localhost:8080/api/cards/all-images';
const TARGET_DIR = path.join(__dirname, 'frontend', 'src', 'assets', 'cards');
const DELAY_MS = 100; // Scryfall pide 50-100ms de retraso entre peticiones

// Crear el directorio si no existe
if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
}

async function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(filepath)) {
            console.log(`[SKIP] Ya existe: ${path.basename(filepath)}`);
            return resolve(true);
        }

        https.get(url, (res) => {
            if (res.statusCode === 200) {
                const stream = fs.createWriteStream(filepath);
                res.pipe(stream);
                stream.on('finish', () => {
                    stream.close();
                    console.log(`[OK] Descargada: ${path.basename(filepath)}`);
                    resolve(true);
                });
            } else if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                // Handle redirects
                downloadImage(res.headers.location, filepath).then(resolve).catch(reject);
            } else {
                console.error(`[ERROR] HTTP ${res.statusCode} para: ${url}`);
                resolve(false); // resolvemos a false para no detener todo el script
            }
        }).on('error', (err) => {
            console.error(`[ERROR] Falla en la red: ${err.message}`);
            resolve(false);
        });
    });
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('Obteniendo lista de cartas desde el backend local...');
    try {
        const response = await fetch(API_URL);
        if (!response.ok) {
            throw new Error(`Error en el backend HTTP: ${response.status}`);
        }
        
        const images = await response.json();
        console.log(`Se han encontrado ${images.length} cartas para descargar.`);
        
        let success = 0;
        let failed = 0;
        let skipped = 0;

        for (let i = 0; i < images.length; i++) {
            const { scryfallId, url } = images[i];
            const filepath = path.join(TARGET_DIR, `${scryfallId}.jpg`);
            
            if (fs.existsSync(filepath)) {
                skipped++;
                continue;
            }

            console.log(`[${i + 1}/${images.length}] Descargando ${scryfallId}...`);
            const downloaded = await downloadImage(url, filepath);
            if (downloaded) {
                success++;
            } else {
                failed++;
            }
            
            // Retraso para no ser baneados por Scryfall
            await delay(DELAY_MS);
        }

        console.log('\n--- RESUMEN DE DESCARGA ---');
        console.log(`Total procesadas: ${images.length}`);
        console.log(`Nuevas descargadas: ${success}`);
        console.log(`Omitidas (ya existían): ${skipped}`);
        console.log(`Fallidas: ${failed}`);
        console.log('Las imágenes están listas en frontend/src/assets/cards/');

    } catch (error) {
        console.error('Error fatal al ejecutar el script:', error.message);
        console.error('Asegúrate de que el backend está corriendo en http://localhost:8080');
    }
}

main();

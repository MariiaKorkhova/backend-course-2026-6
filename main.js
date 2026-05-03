const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { program } = require('commander');
const multer = require('multer');

program
    .requiredOption('-h, --host <type>')
    .requiredOption('-p, --port <number>')
    .requiredOption('-c, --cache <path>')
    .configureOutput({
        outputError: (str, write) => {
            if (str.includes("required option")) {
                return write("error: required options not specified (-h, -p, -c)\n");
            }
            return write(str);
        }
    })
    .parse(process.argv);

const options = program.opts();

if (!fs.existsSync(options.cache)) {
    fs.mkdirSync(options.cache, { recursive: true });
    console.log(`cache directory created: ${options.cache}`);
}

const upload = multer({ dest: options.cache });

const inventoryStorage = {};

const server = http.createServer((req, res) => {
    const sendResponse = (statusCode, message) => {
        res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(message + '\n');
    };

    const sendJson = (statusCode, data) => {
        res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
    };

    const serveHTML = (filePath) => {
        fs.readFile(filePath, (err, data) => {
            if (err) {
                return sendResponse(500, 'internal server error');
            }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(data);
        });
    };

    const urlParts = req.url.split('/');

    if (req.url === '/register') {
        if (req.method === 'GET') {
            serveHTML(path.join(__dirname, 'RegisterForm.html'));
        } else if (req.method === 'POST') {
            upload.single('photo')(req, res, (err) => {
                if (err) return sendResponse(500, 'internal server error');
                if (!req.body || !req.body.inventory_name) return sendResponse(400, 'bad request');

                const id = Date.now().toString();
                inventoryStorage[id] = {
                    id: id,
                    inventory_name: req.body.inventory_name,
                    description: req.body.description || "",
                    photoUrl: req.file ? `/inventory/${id}/photo` : null,
                    photoPath: req.file ? req.file.path : null
                };

                return sendResponse(201, 'created');
            });
        } else {
            return sendResponse(405, 'method not allowed');
        }
    }
    else if (req.method === 'GET' && req.url === '/inventory') {
        return sendJson(200, Object.values(inventoryStorage));
    }
    else if (urlParts[1] === 'inventory') {
        const id = urlParts[2];
        const item = inventoryStorage[id];

        if (!item) return sendResponse(404, 'not found');

        // GET /inventory/<ID>/photo
        if (req.method === 'GET' && urlParts[3] === 'photo') {
            if (!item.photoPath || !fs.existsSync(item.photoPath)) {
                return sendResponse(404, 'photo not found');
            }
            res.writeHead(200, { 'Content-Type': 'image/jpeg' });
            fs.createReadStream(item.photoPath).pipe(res);
        } 
        // PUT /inventory/<ID>/photo
        else if (req.method === 'PUT' && urlParts[3] === 'photo') {
            upload.single('photo')(req, res, (err) => {
                if (err) return sendResponse(500, 'internal server error');
                if (!req.file) return sendResponse(400, 'bad request: photo missing');

                if (item.photoPath && fs.existsSync(item.photoPath)) {
                    fs.unlinkSync(item.photoPath);
                }

                item.photoPath = req.file.path;
                item.photoUrl = `/inventory/${id}/photo`;

                return sendResponse(200, 'photo updated');
            });
        }
        // DELETE /inventory/<ID>
        else if (req.method === 'DELETE' && urlParts.length === 3) {
            if (item.photoPath && fs.existsSync(item.photoPath)) {
                fs.unlinkSync(item.photoPath);
            }
            
            delete inventoryStorage[id];
            return sendResponse(200, 'deleted');
        }
        else if (req.method === 'GET' && urlParts.length === 3) {
            return sendJson(200, item);
        }
        else if (req.method === 'PUT' && urlParts.length === 3) {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    if (data.inventory_name) item.inventory_name = data.inventory_name;
                    if (data.description) item.description = data.description;
                    
                    return sendJson(200, item);
                } catch (e)
                {
                    return sendResponse(400, 'invalid JSON');
                }
            });
        } 
        else
        {
            return sendResponse(405, 'method not allowed');
        }
    } 
    else {
        return sendResponse(404, 'not found');
    }
});

server.listen(options.port, options.host, () => {
    console.log(`server runs at: http://${options.host}:${options.port}`);
});
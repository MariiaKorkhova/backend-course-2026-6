const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { program } = require('commander');

program
    .requiredOption('-h, --host <type>', 'server address')
    .requiredOption('-p, --port <number>', 'server port')
    .requiredOption('-c, --cache <path>', 'cache directory path')
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

if (!fs.existsSync(options.cache))
    {
    fs.mkdirSync(options.cache, { recursive: true });
    console.log(`creating directory for cache: ${options.cache}`);
}

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('server works!\n');
});

server.listen(options.port, options.host, () => {
    console.log(`server runs at: http://${options.host}:${options.port}`);
    console.log(`cache directory: ${path.resolve(options.cache)}`);
});
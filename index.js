// ИЗМЕНЕНИЕ: Импортируем https для SSL и fs для чтения файлов
import { createServer as createHttpsServer } from "https";
import { createServer as createHttpServer } from "http";
import { readFileSync } from "fs";
import { join } from "path";
import express from "express";
import { routeRequest } from "wisp-server-node";
import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ИЗМЕНЕНИЕ: Определяем порты для HTTPS и HTTP
const httpsPort = 443;
const httpPort = 80;

// ИЗМЕНЕНИЕ: Пути к вашим SSL-сертификатам от Let's Encrypt
// Убедитесь, что домен в пути указан правильно (основной домен)
const sslOptions = {
    key: readFileSync("/etc/letsencrypt/live/factwiki.me/privkey.pem"),
    cert: readFileSync("/etc/letsencrypt/live/factwiki.me/fullchain.pem"),
};

const info = {
    "version": "1.0",
};

// ИЗМЕНЕНИЕ: Обновляем стартовое сообщение
const startup_msg = `
| SaturnProxy ${info.version} |

Running HTTPS on:
    https://localhost:${httpsPort}
Running HTTP redirect on:
    http://localhost:${httpPort}
`;

const pubDir = join(__dirname, "public");

const app = express();
// ИЗМЕНЕНИЕ: Создаем HTTPS сервер, передавая опции SSL и express-приложение
const httpsServer = createHttpsServer(sslOptions, app);

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS, PUT, DELETE"
    );
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept, Authorization"
    );
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, X-Kuma-Revision");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Service-Worker-Allowed", "/");
    next();
});

app.use(express.static(pubDir));

app.get("/uv/uv.config.js", (req, res) => {
    res.sendFile(join(pubDir, "uv/uv.config.js"));
});

app.use("/uv/", express.static(uvPath));
app.use("/libcurl/", express.static(libcurlPath));
app.use("/epoxy/", express.static(epoxyPath));
app.use("/baremux/", express.static(baremuxPath));

app.use((req, res) => {
    res.status(404).sendFile(join(pubDir, "404.html"));
});

// ИЗМЕНЕНИЕ: Вешаем обработчик WebSocket на HTTPS сервер
httpsServer.on("upgrade", (req, socket, head) => {
    if (req.url.endsWith("/wisp/")) {
        routeRequest(req, socket, head);
    } else {
        socket.end();
    }
});

// ИЗМЕНЕНИЕ: Запускаем HTTPS сервер на порту 443
httpsServer.listen(httpsPort, "0.0.0.0", () => {
    console.log(startup_msg);
});

// ИЗМЕНЕНИЕ: Создаем и запускаем второй, HTTP-сервер для редиректа на HTTPS
const httpServer = createHttpServer((req, res) => {
    // Перенаправляем на https-версию с кодом 301 (Permanent Redirect)
    res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
    res.end();
});

httpServer.listen(httpPort, "0.0.0.0", () => {
    console.log(`HTTP server is running on port ${httpPort} and redirecting to HTTPS.`);
});

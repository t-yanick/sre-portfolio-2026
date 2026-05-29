const http = require('http');

const PORT = process.env.PORT || 3000;
const HOSTNAME = require('os').hostname();

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(`Hello from inside a container!\nHostname: ${HOSTNAME}\nPort: ${PORT}\n`);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Hostname inside container: ${HOSTNAME}`);
});

import express from 'express';
const app = express();
app.get('/', (req, res) => {
  res.send('<h1>✅ SERVER IS ALIVE</h1><p>If you see this on your iPhone, the connection is perfect.</p><p><a href="/editor">CLICK HERE TO LOAD THE EDITOR</a></p>');
});
app.use('/editor', express.static('dist'));
app.listen(3000, '0.0.0.0', () => console.log('Debug server on 3000'));

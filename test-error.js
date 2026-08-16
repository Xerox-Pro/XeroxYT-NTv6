const express = require('express');
const app = express();
app.get('/api/test', async (req, res, next) => {
  throw new Error("Test error!");
});
app.use((err, req, res, next) => {
  res.status(500).json({ error: "Caught!", message: err.message });
});
app.listen(3001, () => console.log('Listening on 3001'));

import express from 'express';
import routes from './routes';

export const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(routes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Forecast Platform API running on http://localhost:${PORT}`);
  });
}

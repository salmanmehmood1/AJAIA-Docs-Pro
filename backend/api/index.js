import path from 'path';
import { fileURLToPath } from 'url';
import app from '../src/app.js';

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const PORT = process.env.PORT || 4000;

  app.listen(PORT, () => {
    console.log(`Ajaia Docs API running on http://localhost:${PORT}`);
  });
}

export default app;

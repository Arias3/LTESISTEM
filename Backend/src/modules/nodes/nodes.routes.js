import { Router } from 'express';
import { getNodeLocation, getNodeRadio, getNodeThroughput } from './nodes.service.js';

const router = Router();

router.get('/location', async (_req, res) => {
  try {
    const location = await getNodeLocation();
    res.json(location);
  } catch (error) {
    res.status(502).json({ message: error.message });
  }
});

router.get('/radio', async (_req, res) => {
  try {
    const radio = await getNodeRadio();
    res.json(radio);
  } catch (error) {
    res.status(502).json({ message: error.message });
  }
});

router.get('/throughput', async (_req, res) => {
  try {
    const throughput = await getNodeThroughput();
    res.json(throughput);
  } catch (error) {
    res.status(502).json({ message: error.message });
  }
});

export default router;

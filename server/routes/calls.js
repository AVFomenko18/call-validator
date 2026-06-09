import { Router } from 'express';
import pool from '../db.js';
import { extractKeyMoments } from '../claude.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, title, audio_url, created_at FROM calls ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM calls WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { title, audio_url, transcription, supervisor_feedback } = req.body;
  if (!title || !transcription || !supervisor_feedback) {
    return res.status(400).json({ error: 'title, transcription and supervisor_feedback are required' });
  }
  try {
    const key_moments = await extractKeyMoments(transcription);
    const result = await pool.query(
      'INSERT INTO calls (title, audio_url, transcription, supervisor_feedback, key_moments) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, audio_url || null, transcription, supervisor_feedback, JSON.stringify(key_moments)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM calls WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

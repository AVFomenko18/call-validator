import { Router } from 'express';
import pool from '../db.js';
import { scoreSubmission } from '../claude.js';

const router = Router();

// Admin: all submissions optionally filtered by call
router.get('/', async (req, res) => {
  try {
    const { call_id } = req.query;
    let query = `
      SELECT s.*, c.title as call_title
      FROM submissions s JOIN calls c ON s.call_id = c.id
    `;
    const params = [];
    if (call_id) {
      query += ' WHERE s.call_id = $1';
      params.push(call_id);
    }
    query += ' ORDER BY s.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manager: check if already submitted for a call
router.get('/check', async (req, res) => {
  const { call_id, manager_name } = req.query;
  try {
    const result = await pool.query(
      'SELECT id, score, score_details, created_at FROM submissions WHERE call_id = $1 AND manager_name = $2',
      [call_id, manager_name]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Summary table: managers × calls scores
router.get('/summary', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.manager_name, s.call_id, c.title as call_title, s.score
      FROM submissions s JOIN calls c ON s.call_id = c.id
      ORDER BY s.manager_name, s.call_id
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manager: submit feedback
router.post('/', async (req, res) => {
  const { call_id, manager_name, strengths, weaknesses } = req.body;
  if (!call_id || !manager_name || !strengths || !weaknesses) {
    return res.status(400).json({ error: 'All fields required' });
  }
  try {
    // Check duplicate
    const existing = await pool.query(
      'SELECT id FROM submissions WHERE call_id = $1 AND manager_name = $2',
      [call_id, manager_name]
    );
    if (existing.rows.length) {
      return res.status(409).json({ error: 'Already submitted' });
    }

    const callResult = await pool.query('SELECT * FROM calls WHERE id = $1', [call_id]);
    if (!callResult.rows.length) return res.status(404).json({ error: 'Call not found' });

    const call = callResult.rows[0];
    const { score, score_details } = await scoreSubmission(call, { strengths, weaknesses });

    const result = await pool.query(
      'INSERT INTO submissions (call_id, manager_name, strengths, weaknesses, score, score_details) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [call_id, manager_name, strengths, weaknesses, score, JSON.stringify(score_details)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM submissions WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

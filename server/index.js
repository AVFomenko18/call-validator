import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from './db.js';
import { extractKeyMoments, scoreSubmission } from './claude.js';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || token !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── Calls ────────────────────────────────────────────────────────────────────

// Resolve Yandex Disk share link to direct audio URL
app.get('/api/resolve-audio', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });

  try {
    if (url.includes('yandex.') || url.includes('yadi.sk')) {
      const apiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(url)}`;
      const r = await fetch(apiUrl);
      const data = await r.json();
      if (data.href) return res.json({ url: data.href });
      return res.status(400).json({ error: 'Cannot resolve Yandex Disk link' });
    }
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/calls', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, audio_url, created_at FROM calls ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/calls/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM calls WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/calls', requireAdmin, async (req, res) => {
  const { title, audio_url, transcription, supervisor_feedback } = req.body;
  if (!title || !transcription || !supervisor_feedback) {
    return res.status(400).json({ error: 'title, transcription and supervisor_feedback required' });
  }
  try {
    const key_moments = await extractKeyMoments(transcription);
    const result = await pool.query(
      `INSERT INTO calls (title, audio_url, transcription, supervisor_feedback, key_moments)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [title, audio_url || null, transcription, supervisor_feedback, JSON.stringify(key_moments)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/calls/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM calls WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Submissions ──────────────────────────────────────────────────────────────

// Manager: check own submission
app.get('/api/submissions/check', async (req, res) => {
  const { call_id, manager_name } = req.query;
  try {
    const result = await pool.query(
      'SELECT id, score, score_details, created_at FROM submissions WHERE call_id=$1 AND manager_name=$2',
      [call_id, manager_name]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: summary table managers × calls
app.get('/api/submissions/summary', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.manager_name, s.call_id, c.title AS call_title, s.score
      FROM submissions s JOIN calls c ON s.call_id = c.id
      ORDER BY s.manager_name, s.call_id
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: all submissions
app.get('/api/submissions', requireAdmin, async (req, res) => {
  try {
    const { call_id } = req.query;
    let query = `
      SELECT s.*, c.title AS call_title
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

// Manager: submit feedback
app.post('/api/submissions', async (req, res) => {
  const { call_id, manager_name, strengths, weaknesses } = req.body;
  if (!call_id || !manager_name || !strengths || !weaknesses) {
    return res.status(400).json({ error: 'All fields required' });
  }
  try {
    const existing = await pool.query(
      'SELECT id FROM submissions WHERE call_id=$1 AND manager_name=$2',
      [call_id, manager_name]
    );
    if (existing.rows.length) {
      return res.status(409).json({ error: 'Already submitted' });
    }
    const callResult = await pool.query('SELECT * FROM calls WHERE id = $1', [call_id]);
    if (!callResult.rows.length) return res.status(404).json({ error: 'Call not found' });

    const { score, score_details } = await scoreSubmission(callResult.rows[0], { strengths, weaknesses });
    const result = await pool.query(
      `INSERT INTO submissions (call_id, manager_name, strengths, weaknesses, score, score_details)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [call_id, manager_name, strengths, weaknesses, score, JSON.stringify(score_details)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/submissions/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM submissions WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Serve React in production ────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const clientBuild = join(__dirname, '../client/dist');
  app.use(express.static(clientBuild));
  app.get('*', (_req, res) => res.sendFile(join(clientBuild, 'index.html')));
}

app.listen(PORT, () => console.log(`Server on port ${PORT}`));

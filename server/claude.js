import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function extractKeyMoments(transcription) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: [{ type: 'text', text: 'You are an expert sales coach analyzing call transcriptions. Return only valid JSON.' }],
    messages: [
      {
        role: 'user',
        content: `Extract KEY MOMENTS from this sales call that an attentive listener should notice.

Focus on:
1. Specific sales techniques used (objection handling, closing, rapport)
2. Client's exact concerns, objections, or buying signals
3. Turning points in the conversation
4. Specific numbers, names, or facts mentioned
5. Mistakes or missed opportunities

TRANSCRIPTION:
${transcription}

Return JSON array only:
[{"moment": "description", "importance": "high|medium|low"}]`,
      },
    ],
  });

  try {
    const text = response.content[0].text.trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    return [];
  }
}

export async function scoreSubmission(call, feedback) {
  const { transcription, supervisor_feedback, key_moments } = call;
  const { strengths, weaknesses } = feedback;

  const keyMomentsText = Array.isArray(key_moments)
    ? key_moments.map((m) => `- [${m.importance}] ${m.moment}`).join('\n')
    : JSON.stringify(key_moments);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: [{ type: 'text', text: 'You are evaluating whether a sales team employee (менеджер/сотрудник) actually listened to a call recording made by a top performer. The EMPLOYEE is being tested — they listened to the call and wrote feedback. Score their feedback. In the "reasoning" field write in Russian and always refer to the person being evaluated as "менеджер" or "сотрудник". Never call them "руководитель". Return only valid JSON.' }],
    messages: [
      {
        role: 'user',
        content: `CALL TRANSCRIPTION:
${transcription}

KEY MOMENTS TO LOOK FOR:
${keyMomentsText}

SUPERVISOR'S REFERENCE FEEDBACK (gold standard):
${supervisor_feedback}

MANAGER'S FEEDBACK:
STRENGTHS: ${strengths}
WEAKNESSES: ${weaknesses}

Score 0-100. Criteria:
- +5 per specific fact/moment from the call correctly identified (names, exact phrases, techniques, sequence)
- +3 per observation matching supervisor's feedback
- -2 per vague/generic phrase showing no specific knowledge of this call
- 0 for correct but obvious generic observations

Return JSON only:
{
  "score": number,
  "matched_points": ["short observation in Russian, 1 sentence, no meta-commentary"],
  "missed_points": ["short observation in Russian, 1 sentence, no meta-commentary"],
  "generic_phrases": ["vague phrases that lost points"],
  "reasoning": "brief explanation in Russian"
}

Rules for matched_points and missed_points:
- Write in Russian
- Each item is 1 short sentence describing WHAT was noticed or missed
- NO phrases like "соответствует эталону", "совпадает с обратной связью", "золотой стандарт", "according to supervisor" or any similar meta-commentary
- Just the observation itself, e.g. "Озвучены дедлайны, создаётся срочность" or "Не уточнил бюджет клиента"`,
      },
    ],
  });

  try {
    const text = response.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const details = jsonMatch ? JSON.parse(jsonMatch[0]) : { score: 0, reasoning: 'Parse error' };
    return { score: Math.max(0, Math.min(100, details.score || 0)), score_details: details };
  } catch {
    return { score: 0, score_details: { reasoning: 'Scoring failed' } };
  }
}

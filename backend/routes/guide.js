import express from 'express';
import { generateGuideSteps, analyzeScreenshotForGuide } from '../services/ai/gemini.js';

const router = express.Router();

// POST /api/guide/steps — generate step-by-step text instructions
router.post('/steps', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: 'Question is required' });
    const result = await generateGuideSteps(question);
    res.json(result);
  } catch (err) {
    console.error('❌ Guide steps error:', err.message);
    res.status(500).json({ error: 'Failed to generate guide steps. Please try again.' });
  }
});

// POST /api/guide/analyze — analyze screenshot, return bounding box
router.post('/analyze', async (req, res) => {
  try {
    const { question, screenshot, stepsCompleted, currentStepInstruction } = req.body;
    if (!question || !screenshot) {
      return res.status(400).json({ error: 'Question and screenshot are required' });
    }
    const result = await analyzeScreenshotForGuide(question, screenshot, stepsCompleted, currentStepInstruction);
    res.json(result);
  } catch (err) {
    console.error('❌ Screenshot analysis error:', err.message);
    res.status(500).json({ error: 'Failed to analyze screenshot. Please try again.' });
  }
});

export default router;
 
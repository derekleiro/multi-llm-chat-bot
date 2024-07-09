const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const pdf = require('pdf-parse');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { marked } = require('marked');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuration
const upload = multer({ dest: 'uploads/' });
const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// AI model configurations
const CLAUDE_MODEL = 'claude-3-5-sonnet-20240620';
const OPENAI_MODEL = 'gpt-3.5-turbo';
const GEMINI_MODEL = 'gemini-1.5-pro';

// Helper functions
async function callAnthropicAPI(conversation, system = '') {
  const msg = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    temperature: 0,
    system,
    messages: conversation,
  });
  return msg.content[0].text;
}

async function generateGeminiResponse(conversation, prompt) {
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  const chat = model.startChat({
    generationConfig: {
      temperature: 1,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 8192,
    },
    history: conversation,
  });
  const result = await chat.sendMessage(prompt);
  return result.response.text();
}

async function generateOpenAICompletion(conversation) {
  const completion = await openai.chat.completions.create({
    messages: conversation,
    model: OPENAI_MODEL,
  });
  return completion.choices[0].message.content;
}

async function parseFileContents(filePath) {
  const data = await fs.readFile(filePath);
  const pdfData = await pdf(data);
  return pdfData.text;
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.post('/:model/generate', async (req, res) => {
  const { model } = req.params;
  const { prompt } = req.query;
  const { conversations } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Please provide a prompt' });
  }

  try {
    let completion;
    switch (model) {
      case 'gemini':
        completion = await generateGeminiResponse(conversations, prompt);
        break;
      case 'openai':
        completion = await generateOpenAICompletion([{ role: 'user', content: prompt }]);
        break;
      case 'claude':
        completion = await callAnthropicAPI(conversations);
        break;
      default:
        return res.status(400).json({ error: 'Invalid model specified' });
    }

    res.json({ completion: marked.parse(completion), raw: completion });
  } catch (error) {
    console.error(`Error generating completion for ${model}:`, error);
    res.status(500).json({ error: `Error generating completion: ${error.message}` });
  }
});

app.post('/upload', upload.single('file'), async (req, res) => {
  const { prompt } = req.query;

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  if (!prompt) {
    return res.status(400).json({ error: 'Please provide a prompt' });
  }

  try {
    const data = await parseFileContents(req.file.path);
    const conversation = [
      { role: 'user', content: [{ text: `${prompt}\n${data}`, type: 'text' }] },
    ];

    const completion = await callAnthropicAPI(conversation);
    res.json({ completion: marked.parse(completion) });
  } catch (error) {
    console.error('Error processing file upload:', error);
    res.status(500).json({ error: `Error processing file: ${error.message}` });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
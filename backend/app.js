const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pdf = require("pdf-parse");
const app = express();
const port = 3000;
const upload = multer({ dest: "uploads/" });
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: "include-your-openai-api-key-here",
});
const cors = require("cors");

//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
//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

// Import the necessary libraries
const Anthropic = require("@anthropic-ai/sdk");

// Set up your Anthropic API credentials
const API_KEY = "include-your-anthropic-api-key-here";

const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");

const MODEL_NAME = "gemini-1.0-pro";
const GEMINI_API_KEY = "include-your-gemini-api-key-here";

async function generateGeminiResponse(prompt) {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const generationConfig = {
    temperature: 0.9,
    topK: 1,
    topP: 1,
    maxOutputTokens: 2048,
  };

  const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ];

  const chat = model.startChat({
    generationConfig,
    safetySettings,
    history: [],
  });

  const result = await chat.sendMessage(prompt);
  const response = result.response;
  return response.text();
}

// Define a function to make API requests
async function callAnthropicAPI(prompt, system) {
  console.log([prompt]);

  const anthropic = new Anthropic({ apiKey: API_KEY });
  const msg = await anthropic.messages.create({
    model: "claude-3-sonnet-20240229",
    max_tokens: 4000,
    temperature: 0,
    system: system,
    // TODO: Extend the functionality to support multiple messages and history
    messages: [prompt],
  });
  return msg.content[0].text;
}

// Example usage: generate a text completion
async function generateClaudeCompletion(prompt) {
  const data = {
    "role": "user",
    "content": [{
      "type": "text",
      "text": prompt,
    }],
  };
  const result = await callAnthropicAPI(data, "");
  console.log(result);
  return result;
}

async function generateOpenAICompletion(prompt) {
  const completion = await openai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "gpt-3.5-turbo",
  });
  return completion;
}

app.use(cors());

app.get("/gemini/generate", async (req, res) => {
  const prompt = req.query.prompt;
  if (!prompt) {
    return res.status(400).json({ error: "Please provide a prompt" });
  }
  try {
    const completion = await generateGeminiResponse(prompt);
    console.log(completion);
    res.json({ completion });
  } catch (error) {
    res.status(500).json({ error: "Error generating completion" });
  }
});

app.get("/openAI/generate", async (req, res) => {
  const prompt = req.query.prompt;
  if (!prompt) {
    return res.status(400).json({ error: "Please provide a prompt" });
  }
  try {
    const completion = await generateOpenAICompletion(prompt);
    res.json({ completion });
  } catch (error) {
    res.status(500).json({ error: "Error generating completion" });
  }
});

// Route to generate text completion
app.get("/claude/generate", async (req, res) => {
  const prompt = req.query.prompt;
  if (!prompt) {
    return res.status(400).json({ error: "Please provide a prompt" });
  }
  try {
    const completion = await generateClaudeCompletion(prompt);
    res.json({ completion });
  } catch (error) {
    res.status(500).json({ error: "Error generating completion " + error });
  }
});

// Serve static files from the uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Route to handle file upload
app.post("/upload", upload.single("file"), (req, res) => {
  let prompt = req.body.prompt;
  //let aiType = req.body.aiType;

  if (!req.file) {
    console.log("Hey this ran: " + req.file);
    return res.status(400).json({ error: "No file uploaded" });
  }

  if (!prompt) {
    return res.status(400).json({ error: "Please provide a prompt" });
  }

  // Parse the contents of the uploaded file
  parseFileContents(req.file.path, async (err, data) => {
    if (err) {
      return res.status(500).json({ error: "Error parsing file contents" });
    }

    // Send the parsed data back to the client
    console.log("PDF Data: " + data);

    // Change this to your preferred AI model
    // TODO: Extend the functionality to support multiple AI models without manual change
    const completion = await generateClaudeCompletion(prompt + "\n" + data);
    res.json({ completion });
  });
});

function parseFileContents(filePath, callback) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      return callback(err);
    }

    pdf(data)
      .then((pdfData) => {
        callback(null, pdfData.text);
      })
      .catch((error) => {
        callback(error);
      });
  });
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

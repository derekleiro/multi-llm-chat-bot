const chatbotElements = {
  messages: document.getElementById("chatbot-messages"),
  input: document.getElementById("chatbot-input"),
  fileInput: document.getElementById("file-input"),
  attachedFileIcon: document.getElementById("attached-file-icon"),
  fileName: document.getElementById("file-name"),
  fileRemover: document.getElementById("file-remover"),
  greeting: document.getElementById("chatbot-greeting"),
  dropdown: document.getElementById("dropdown"),
  selectedModel: document.getElementById("selected-model"),
};

// Models
const AI_TYPE = {
  claude: "claude-sonnet-3.5",
  gemini: "gpt-3.5",
  openai: "gemini-1.5-pro",
};

let CURRENT_AI = AI_TYPE.claude;

// Models
const API_ENDPOINTS = {
  upload: "/upload",
  claude: "/claude/generate",
  gemini: "/gemini/generate",
  openai: "/openai/generate",
};

let CURRENT_API = API_ENDPOINTS.claude;

const conversations = {
  claude: [],
  gemini: [],
  openai: [],
};

function showLoader() {
  document.getElementById("loader").style.display = "block";
}

function hideLoader() {
  document.getElementById("loader").style.display = "none";
}

function addConversation(type, data, isUser) {
  // Models
  switch (type) {
    case "claude-sonnet-3.5":
      if (isUser) {
        return conversations.claude.push({
          role: "user",
          content: [
            {
              type: "text",
              text: data,
            },
          ],
        });
      } else {
        return conversations.claude.push({
          role: "assistant",
          content: [
            {
              type: "text",
              text: data,
            },
          ],
        });
      }
    case "gemini-1.5-pro":
      if (isUser) {
        return conversations.gemini.push({
          role: "user",
          parts: [{ text: data }],
        });
      } else {
        return conversations.gemini.push({
          role: "model",
          parts: [{ text: data }],
        });
      }
      // Currently not working
    case "gpt-3.5":
      if (isUser) {
        return conversations.openai.push({ role: "user", content: data });
      } else {
        return conversations.openai.push({ role: "assistant", content: data });
      }
    default:
      return;
  }
}

function getCurrentConversation(type) {
  // Models
  switch (type) {
    case "claude-sonnet-3.5":
      return conversations.claude;
    case "gemini-1.5-pro":
      return conversations.gemini;
    case "gpt-3.5":
      return conversations.openai;
    default:
      return;
  }
}

// Transformation functions
const transformers = {
  "claude-sonnet-3.5": {
    toGemini: (message) => ({
      role: message.role === "user" ? "user" : "model",
      parts: [{ text: message.content[0].text }],
    }),
  },
  "gemini-1.5-pro": {
    toClaude: (message) => ({
      role: message.role === "user" ? "user" : "assistant",
      content: [{
        type: "text",
        text: message.parts[0].text,
      }],
    }),
  },
};

// Mapping of models and their corresponding transformation functions
const modelMap = {
  "claude-sonnet-3.5": {
    "gemini-1.5-pro": transformers["claude-sonnet-3.5"].toGemini,
  },
  "gemini-1.5-pro": {
    "claude-sonnet-3.5": transformers["gemini-1.5-pro"].toClaude,
  },
};

// Function to get the transformer based on current and new model
function getTransformer(currentModel, newModel) {
  return modelMap[currentModel][newModel];
}

// Main hotSwapModel function
function hotSwapModel(currentModel, newModel) {
  const currentConversation = getCurrentConversation(currentModel);
  let swappedConversation = [];

  const transformer = getTransformer(currentModel, newModel);

  console.log("Transformer: ", transformer);
  if (transformer) {
    for (let i = 0; i < currentConversation.length; i++) {
      const message = currentConversation[i];
      swappedConversation.push(transformer(message));
    }
  }

  console.log("Current conversation: ", currentConversation);
  console.log("Swapped conversation: ", swappedConversation);

  return swappedConversation;
}

async function uploadFile(file, prompt) {
  showLoader();
  const formData = new FormData();
  formData.append("file", file);
  formData.append("prompt", prompt);
  formData.append("aiType", CURRENT_AI);

  try {
    const response = await fetch(
      `${API_ENDPOINTS.upload}?prompt=${encodeURIComponent(prompt)}`,
      {
        method: "POST",
        body: formData,
      }
    );
    hideLoader();
    const data = await response.json();

    return response.ok ? data.completion : `Upload error: ${data.error}`;
  } catch (error) {
    console.error("File upload error:", error);
    return `File upload error: ${error.message}`;
  }
}

async function generateResponse(prompt) {
  addConversation(CURRENT_AI, prompt, true);
  showLoader();

  console.log({ list: getCurrentConversation(CURRENT_AI) });
  try {
    const response = await fetch(
      `${CURRENT_API}?prompt=${encodeURIComponent(prompt)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversations: getCurrentConversation(CURRENT_AI),
        }),
      }
    );
    hideLoader();
    const data = await response.json();

    // Add the AI response to the conversation
    addConversation(CURRENT_AI, data.raw, false);

    return response.ok
      ? data.completion
      : `Error calling Claude: ${data.error}`;
  } catch (error) {
    console.error("Claude API error:", error);
    return `Claude API error: ${error.message}`;
  }
}

function displayMessage(content, isUser) {
  let newContent = "";

  const messageElement = document.createElement("div");
  messageElement.classList.add("chatbot-message", isUser ? "user" : "ai");

  const messageContent = document.createElement("div");
  messageContent.classList.add("chatbot-message-content");

  const messageContentElement = document.createElement("div");
  messageContentElement.classList.add("chatbot-message-content");

  if (isUser && chatbotElements.fileInput.files[0]) {
    const fileInfo = document.createElement("div");
    fileInfo.classList.add("chatbot-doc-attachment");
    const fileName =
      chatbotElements.fileInput.files[0].name.slice(0, 20) + "...";
    fileInfo.innerHTML = `<div><i class="fas fa-file"></i> ${fileName}</div><br/>`;
    messageElement.appendChild(fileInfo);
  }

  // Deactivate the chatbox input while the AI is responding
  disableInput();

  if (isUser) {
    messageContent.textContent = content;
    messageElement.appendChild(messageContent);
    chatbotElements.messages.appendChild(messageElement);
  } else {
    let index = 0;
    const interval = setInterval(() => {
      newContent += content[index];
      index++;
      messageContentElement.innerHTML = newContent;
      messageElement.appendChild(messageContentElement);
      chatbotElements.messages.appendChild(messageElement);

      if (index == content.length) {
        clearInterval(interval);
        enableInput();
      }
    }, 5);
  }

  chatbotElements.messages.scrollTop = chatbotElements.messages.scrollHeight;
}

async function handleUserInput() {
  const userInput = chatbotElements.input.value.trim();
  if (!userInput) return;

  chatbotElements.greeting.style.display = "none";
  displayMessage(userInput, true);
  chatbotElements.input.value = "";

  const response = chatbotElements.fileInput.files[0]
    ? await uploadFile(chatbotElements.fileInput.files[0], userInput)
    : await generateResponse(userInput);

  displayMessage(response, false);
}

function removeFile() {
  chatbotElements.fileInput.value = "";
  chatbotElements.fileName.textContent = "";
  chatbotElements.attachedFileIcon.style.display = "none";
}

function disableInput() {
  chatbotElements.input.removeEventListener("keyup", handleKeyUp);
}

function enableInput() {
  chatbotElements.input.addEventListener("keyup", handleKeyUp);
}

function handleKeyUp(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    handleUserInput();
    disableInput();
  }
}

function handleFileInputChange() {
  const file = chatbotElements.fileInput.files[0];
  if (file && file.type === "application/pdf") {
    chatbotElements.attachedFileIcon.style.display = "inline-block";
    chatbotElements.fileName.textContent = file.name.slice(0, 20) + "...";
  } else {
    alert("Please select a PDF file");
    this.value = ""; // Clear the file input
  }
}

function modelSwitcher(OLD_AI) {
  // Models
  switch (CURRENT_AI) {
    case "claude-sonnet-3.5":
      // Migrate the conversation to the new model
      const newClaudeConversation = hotSwapModel(OLD_AI, CURRENT_AI);
      conversations.claude = newClaudeConversation;

      CURRENT_API = API_ENDPOINTS.claude;
      break;
    case "gpt-3.5":
      // Migrate the conversation to the new model
      const newGPTConversation = hotSwapModel(OLD_AI, CURRENT_AI);
      conversations.openai = newGPTConversation;

      CURRENT_API = API_ENDPOINTS.openai;
      break;
    case "gemini-1.5-pro":
      // Migrate the conversation to the new model
      const newGeminiConversation = hotSwapModel(OLD_AI, CURRENT_AI);
      conversations.gemini = newGeminiConversation;

      // Update the current AI endpoint
      CURRENT_API = API_ENDPOINTS.gemini;
      break;
    default:
      // Migrate the conversation to the new model
      const newClaudeDefaultConversation = hotSwapModel(OLD_AI, CURRENT_AI);
      conversations.claude = newClaudeDefaultConversation;

      CURRENT_API = API_ENDPOINTS.claude;
  }
}

function handleModelChange(i) {
  const OLD_AI = CURRENT_AI; // Temp variable to store the old AI model

  CURRENT_AI = chatbotElements.dropdown.children[i].textContent.toLowerCase();

  // Switching endpoints and swapping conversations
  modelSwitcher(OLD_AI);

  // Updating UI
  chatbotElements.selectedModel.textContent = CURRENT_AI; // Shown on the dropdown
}

// Event Listeners
chatbotElements.input.addEventListener("keyup", handleKeyUp);
chatbotElements.fileInput.addEventListener("change", handleFileInputChange);
chatbotElements.fileInput.addEventListener("click", removeFile);
chatbotElements.fileRemover.addEventListener("click", removeFile);
chatbotElements.selectedModel.addEventListener("click", modelSwitcher);
document.addEventListener("DOMContentLoaded", () => {
  const modelsListLength = chatbotElements.dropdown.children.length;
  for (let i = 0; i < modelsListLength; i++) {
    chatbotElements.dropdown.children[i].addEventListener("click", () =>
      handleModelChange(i)
    );
  }
  chatbotElements.selectedModel.textContent = CURRENT_AI; // Shown on the dropdown
});

const chatbotMessages = document.getElementById("chatbot-messages");
const chatbotInput = document.getElementById("chatbot-input");
const fileInput = document.getElementById("file-input");
const attachedFileIcon = document.getElementById("attached-file-icon");
const file = document.getElementById("file");
const fileName = document.getElementById("file-name");
const fileRemover = document.getElementById("file-remover");
const chatbotGreeting = document.getElementById("chatbot-greeting");

async function handleFileUpload() {
  const file = fileInput.files[0];
  if (!file) {
    return;
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("prompt", chatbotInput.value.trim());
  formData.append("aiType", "Gemini")

  try {
    const response = await fetch("http://localhost:3000/upload", {
      method: "POST",
      body: formData,
    });
    if (response.ok) {
      const JSONres = await response.json();
      return JSONres;
    }
  } catch (e) {
    console.error("Something went wrong uploading the file: " + e);
    return "Something went wrong uploading the file: " + e.message;
  }
}

async function generateResponse(prompt) {
  try {
    const response = await fetch(
      "http://localhost:3000/claude/generate?prompt=" + prompt
    );
    if (response.ok) {
      const JSONres = await response.json();
      console.log("JSONRES: " + JSONres)
      return JSONres.completion;
    }
  } catch (e) {
    console.error("Something went wrong: " + e);
    return (
      "Something went wrong calling Claude. Check your code. \n\nError: " +
      e.message
    );
  }
}

async function inputListener(event) {
  if (event.key === "Enter") {
    const file = fileInput.files[0];
    if (file) {
      await handleFilePrompt();
    } else {
      await handleUserInput();
    }
  }
}

// Function to display a message in the chat window
function displayMessage(content, isUser) {
  const messageElement = document.createElement("div");
  messageElement.classList.add("chatbot-message");
  if (isUser) {
    messageElement.classList.add("user");
  }

  let newContent = "";
  let index = 0;
  const messageContentElement = document.createElement("div");
  messageContentElement.classList.add("chatbot-message-content");

  const file = fileInput.files[0];
  if(file && isUser){
    const fileContentElement = document.createElement("div");
    const shortFileName = file.name.slice(0, 20) + "..."
    fileContentElement.classList.add("chatbot-doc-attachment")
    fileContentElement.innerHTML = `<div><i class="fas fa-file"></i> ${shortFileName} </div></br/>`
    messageElement.appendChild(fileContentElement)
  }

  chatbotInput.removeEventListener("keyup", (e) => {
    inputListener(e);
  });

  if (isUser) {
    messageContentElement.innerHTML = content;
    messageElement.appendChild(messageContentElement);
    chatbotMessages.appendChild(messageElement);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  } else {
    const interval = setInterval(() => {
      newContent += content[index];
      index++;
      messageContentElement.innerHTML = newContent;
      messageElement.appendChild(messageContentElement);
      chatbotMessages.appendChild(messageElement);
      chatbotMessages.scrollTop = chatbotMessages.scrollHeight;

      if (index == content.length) {
        clearInterval(interval);
        chatbotInput.addEventListener("keyup", (e) => {
          inputListener(e);
        });
      }
    }, 5);
  }
}

// Function to handle user input
async function handleUserInput() {
  const userInput = chatbotInput.value.trim();

  if (userInput) {
    chatbotGreeting.style.display = "none";
    displayMessage(userInput, true);
    chatbotInput.value = "";

    // Simulate a chatbot response
    const response = await generateResponse(userInput);
    displayMessage(response, false);
  }
}

async function handleFilePrompt() {
  const userInput = chatbotInput.value.trim();

  if (userInput) {
    chatbotGreeting.style.display = "none";
    displayMessage(userInput, true);
    chatbotInput.value = "";

    // Simulate a chatbot response
    const response = await handleFileUpload();
    displayMessage(response, false);
  }
}

function removeFile() {
  fileInput.value = ""; // Clear the file input
  fileName.textContent = ""; // Clear the file name
  attachedFileIcon.style.display = "none"; // Hide the attached file icon
}

chatbotInput.addEventListener("keyup", (e) => {
  inputListener(e);
});
chatbotInput.addEventListener("submit", (e) => {
  e.preventDefault();
  e.stopPropagation();
});

fileInput.addEventListener("change", (e) => {
  const file = fileInput.files[0];

  attachedFileIcon.style.display = "inline-block";
  const shortFileName = file.name.slice(0, 20) + "..."
  fileName.innerHTML = shortFileName;
});

fileInput.addEventListener("click", (e) => {
  removeFile();
});

fileRemover.addEventListener("click", (e) => {
  removeFile();
});

document.addEventListener("submit", (e) => {
  e.preventDefault();
  e.stopPropagation();
});

function toggleForm() {
    const form = document.getElementById('fileForm');
    form.classList.toggle('expanded');

    if (form.classList.contains('expanded')) {
        document.addEventListener('click', handleClickOutside);
    } else {
        document.removeEventListener('click', handleClickOutside);
    }
}

function handleClickOutside(event) {
    const form = document.getElementById('fileForm');
    const button = document.getElementById('uploadButton');
    if (!form.contains(event.target) && event.target !== button) {
        form.classList.remove('expanded');
        document.removeEventListener('click', handleClickOutside);
    }
}

function actionToggle() {
    var action = document.querySelector('.action');
    action.classList.toggle('active');
}

document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
        const spinnerContainer = document.getElementById('spinnerContainer');
        spinnerContainer.style.opacity = '0';
        spinnerContainer.style.visibility = 'hidden';
    }, 700);
});

var recognition = null;

document.addEventListener('DOMContentLoaded', function () {
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
    } else {
        console.error('Speech Recognition not supported in this browser.');
    }

    if (recognition) {
        document.getElementById('startVoiceInput').addEventListener('click', function () {
            startVoiceInput(recognition);
        });
    } else {
        document.getElementById('startVoiceInput').disabled = true;
        console.error('Speech Recognition not available. Voice input disabled.');
    }
});

function startVoiceInput(recognition) {
    event.preventDefault();
    recognition.start();

    recognition.onresult = function (event) {
        var result = event.results[event.results.length - 1];
        var transcribedText = result[0].transcript;

        if (transcribedText.trim() !== "") {
            askQuestionWithVoiceInput(transcribedText);
        }
    };

    recognition.onerror = function (event) {
        console.error('Speech recognition error:', event.error);
    };

    recognition.onend = function () {
        console.log('Voice input ended');
    };
}

function askQuestionWithVoiceInput(transcribedText) {
    var questionInput = document.getElementById('question');
    questionInput.value = transcribedText;
    var submitButton = document.getElementById('bt');
    submitButton.click();
}

function isQuestionInputEmpty() {
    const questionInput = document.getElementById('question');
    const question = questionInput.value.trim();
    if (question === "") {
        alert('Enter a query first.');
        return true;
    }
    return false;
}

async function askQuestion(event) {
    event.preventDefault();
    if (isQuestionInputEmpty()) {
        return;
    }

    const questionInput = document.getElementById('question');
    const question = questionInput.value.trim();
    const conversationDiv = document.getElementById('conversation');

    try {
        const response = await fetch('/ask/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': '{{ csrf_token }}'
            },
            body: JSON.stringify({ question: question })
        });

        const result = await response.json();

        if (response.ok) {
            const userMessageDiv = document.createElement('div');
            userMessageDiv.classList.add('message', 'user-message');
            userMessageDiv.innerHTML = `<p>You : ${question}</p>`;
            conversationDiv.appendChild(userMessageDiv);

            const assistantMessageDiv = document.createElement('div');
            assistantMessageDiv.classList.add('message', 'assistant-message');
            conversationDiv.appendChild(assistantMessageDiv);

            questionInput.value = '';
            autoScroll(conversationDiv);

            await streamText(result.response, assistantMessageDiv);
            autoScroll(conversationDiv);
        } else {
            console.error('Error:', result.error);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

function autoScroll(element) {
    element.scrollTop = element.scrollHeight;
}

async function streamText(text, element) {
    let index = 0;
    const screenSize = window.innerWidth;
    const speed = (screenSize > 768) ? 7 : 9;
    return new Promise((resolve) => {
        const timer = setInterval(() => {
            element.innerHTML = '<p><img src="../static/favicon.png" alt="logo" style="height: 20px;"/> : ' + formatAssistantResponse(text.substring(0, index)) + '</p>';
            index++;

            if (index > text.length) {
                clearInterval(timer);
                resolve();
            }
        }, speed);
    });
}

function formatAssistantResponse(response) {
    return response.replace(/\n/g, '<br>').replace(/ {2}/g, '&nbsp;&nbsp;');
}

function speakLatestResponse() {
    event.preventDefault();
    var latestResponseElement = document.querySelector('.assistant-message:last-child');

    if (latestResponseElement) {
        var latestResponse = latestResponseElement.innerText.trim();
        if (latestResponse === "") {
            alert('Invalid request');
        } else {
            speakText(latestResponse);
        }
    } else {
        alert('Invalid request');
    }
}

function speakText(text) {
    var speech = new SpeechSynthesisUtterance();
    speech.text = text;
    window.speechSynthesis.speak(speech);
}

async function uploadFile(event) {
    event.preventDefault();
    const form = document.getElementById('fileForm');
    const formData = new FormData(form);

    try {
        const response = await fetch("/file-upload/", {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
            }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('File uploaded successfully:', data);
            if (data.message) {
                alert(data.message);
            }
        } else {
            const errorText = await response.text();
            console.error('Error uploading file:', errorText);
        }
    } catch (error) {
        console.error('Error uploading file:', error);
    }
}
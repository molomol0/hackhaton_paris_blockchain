export function newChatMessage(message) {

    const chatBox = document.getElementById('chat-box');
    const messageElement = document.createElement('div');
    if (!chatBox || !messageElement) {
        console.error('Chat box or message element not found');
        return;
    }
    console.log('Chat msg', message);
    messageElement.classList.add('message');
    messageElement.innerHTML = `<span class="username">Ano:</span> ${message}`;
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
};
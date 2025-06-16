let currentUser = null;
let accounts = JSON.parse(localStorage.getItem('accounts')) || {};

function setTheme(theme) {
  const root = document.documentElement;
  switch (theme) {
    case 'k00lduddde':
      root.style.setProperty('--primary-color', '#32a852');
      break;
    case 'prettyprinncess':
      root.style.setProperty('--primary-color', '#ff80c8');
      break;
    case 'bluudud':
      root.style.setProperty('--primary-color', '#148be0');
      break;
    case 'c00lkidd':
      root.style.setProperty('--primary-color', '#e03434');
      break;
    case 'mafioso':
      root.style.setProperty('--primary-color', '#d4bf24');
      break;
    case 'ipadkidd':
      root.style.setProperty('--primary-color', '#0000ff');
      break;
  }
  saveMessages();
}

function login() {
  const user = document.getElementById('username').value;
  const pass = document.getElementById('password').value;
  if (accounts[user] && accounts[user] === pass) {
    currentUser = user;
    alert(`logged in as ${user}`);
    loadMessages();
  } else {
    alert('login failed');
  }
}

function register() {
  const user = document.getElementById('username').value;
  const pass = document.getElementById('password').value;
  if (user && pass) {
    accounts[user] = pass;
    localStorage.setItem('accounts', JSON.stringify(accounts));
    currentUser = user;
    alert(`registered as ${user}`);
    loadMessages();
  }
}

function sendMsg() {
  const msg = document.getElementById('msgInput').value;
  const error = document.getElementById('errorMsg');
  if (!currentUser) {
    error.textContent = 'you need to make an account to send messages';
    setTimeout(() => error.textContent = '', 5000);
    return;
  }
  if (msg) {
    const chatBox = document.getElementById('chatBox');
    const div = document.createElement('div');
    div.className = 'message';
    div.textContent = `[${currentUser}] ${msg}`;
    chatBox.appendChild(div);
    document.getElementById('msgInput').value = '';
    chatBox.scrollTop = chatBox.scrollHeight;
    saveMessages();
  }
}

function saveMessages() {
  const chatBox = document.getElementById('chatBox');
  localStorage.setItem('chatMessages', chatBox.innerHTML);
}

function loadMessages() {
  const saved = localStorage.getItem('chatMessages');
  if (saved) {
    document.getElementById('chatBox').innerHTML = saved;
  }
}

window.onload = loadMessages;

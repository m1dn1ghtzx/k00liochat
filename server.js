// server.js
const express = require('express')
const http = require('http')
const WebSocket = require('ws')
const bcrypt = require('bcrypt')
const { v4: uuidv4 } = require('uuid')

const app = express()
const server = http.createServer(app)
const wss = new WebSocket.Server({ server })

app.use(express.json())

// in-memory "database"
const users = {} // username: { passwordHash, theme, communities: [] }
const sessions = {} // sessionId: username
const communities = {} // communityId: { name, channels: [{ id, name, messages: [] }] }
const groupChats = {} // groupChatId: { name, members: [], messages: [] }
const userSockets = {} // username: ws

// helper to send message to one client
function send(ws, type, data) {
  ws.send(JSON.stringify({ type, data }))
}

// helper to broadcast to all users in a community's channel
function broadcastToCommunity(communityId, channelId, message) {
  for (const username in userSockets) {
    const ws = userSockets[username]
    if (users[username].communities.includes(communityId)) {
      send(ws, 'new_message', { communityId, channelId, message })
    }
  }
}

// signup route
app.post('/signup', async (req, res) => {
  const { username, password } = req.body
  if (!username || !password) return res.status(400).send('missing username or password')
  if (users[username]) return res.status(400).send('username taken')

  const passwordHash = await bcrypt.hash(password, 10)
  users[username] = { passwordHash, theme: 'k00lduddde', communities: [] }
  res.status(201).send('signup success')
})

// login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body
  const user = users[username]
  if (!user) return res.status(400).send('invalid credentials')

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return res.status(400).send('invalid credentials')

  const sessionId = uuidv4()
  sessions[sessionId] = username
  res.json({ sessionId, theme: user.theme, communities: user.communities })
})

// create community (like server)
app.post('/community', (req, res) => {
  const { sessionId, name } = req.body
  const username = sessions[sessionId]
  if (!username) return res.status(401).send('not logged in')
  if (!name) return res.status(400).send('missing community name')

  const id = uuidv4()
  communities[id] = {
    name,
    channels: [{ id: uuidv4(), name: 'general', messages: [] }]
  }
  users[username].communities.push(id)
  res.json({ communityId: id, name })
})

// create a new channel inside a community
app.post('/community/channel', (req, res) => {
  const { sessionId, communityId, channelName } = req.body
  const username = sessions[sessionId]
  if (!username) return res.status(401).send('not logged in')

  const community = communities[communityId]
  if (!community) return res.status(404).send('community not found')

  const newChannel = { id: uuidv4(), name: channelName || 'new-channel', messages: [] }
  community.channels.push(newChannel)
  res.status(201).send('channel created')
})

// create group chat (group DM)
app.post('/groupchat', (req, res) => {
  const { sessionId, name, members } = req.body
  const username = sessions[sessionId]
  if (!username) return res.status(401).send('not logged in')
  if (!name) return res.status(400).send('missing group chat name')
  if (!Array.isArray(members) || members.length === 0) return res.status(400).send('must include members')

  for (const m of members) {
    if (!users[m]) return res.status(400).send(`user ${m} not found`)
  }

  if (!members.includes(username)) members.push(username)

  const id = uuidv4()
  groupChats[id] = { name, members, messages: [] }

  res.json({ groupChatId: id, name, members })
})

// websocket setup
wss.on('connection', (ws, req) => {
  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message)

      // authenticate
      if (msg.type === 'auth') {
        const username = sessions[msg.sessionId]
        if (!username) return send(ws, 'error', 'invalid session')

        userSockets[username] = ws
        ws.username = username
        send(ws, 'auth_success', { theme: users[username].theme, communities: users[username].communities })
      }

      // community chat message
      if (msg.type === 'send_message') {
        const { communityId, channelId, content } = msg
        if (!ws.username) return send(ws, 'error', 'not authenticated')

        const community = communities[communityId]
        if (!community) return send(ws, 'error', 'community not found')

        const channel = community.channels.find(c => c.id === channelId)
        if (!channel) return send(ws, 'error', 'channel not found')

        const messageData = {
          id: uuidv4(),
          user: ws.username,
          content,
          timestamp: Date.now()
        }

        channel.messages.push(messageData)
        broadcastToCommunity(communityId, channelId, messageData)
      }

      // group chat message
      if (msg.type === 'send_group_message') {
        const { groupChatId, content } = msg
        if (!ws.username) return send(ws, 'error', 'not authenticated')

        const chat = groupChats[groupChatId]
        if (!chat) return send(ws, 'error', 'group chat not found')
        if (!chat.members.includes(ws.username)) return send(ws, 'error', 'not in group chat')

        const messageData = {
          id: uuidv4(),
          user: ws.username,
          content,
          timestamp: Date.now()
        }

        chat.messages.push(messageData)

        for (const member of chat.members) {
          const sock = userSockets[member]
          if (sock) send(sock, 'new_group_message', { groupChatId, message: messageData })
        }
      }

    } catch (e) {
      send(ws, 'error', 'bad message format')
    }
  })

  ws.on('close', () => {
    if (ws.username) delete userSockets[ws.username]
  })
})

server.listen(3000, () => console.log('server running on http://localhost:3000'))

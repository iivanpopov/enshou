import fs from 'fs'

const commitMsgPath = process.argv[2]
if (!commitMsgPath) process.exit(0)

// oxfmt-ignore
const emojis = ['✨', '🌸', '🗻', '🤍', '🍥', '💎', '🎉', '🏮', '💥', '👾', '🐉', '🔥', '⚜️', '⛩️', '🥀']

const currentMessage = fs.readFileSync(commitMsgPath, 'utf8')
const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)]
const newMessage = `${randomEmoji} ${currentMessage}`

fs.writeFileSync(commitMsgPath, newMessage)

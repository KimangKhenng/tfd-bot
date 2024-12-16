import { Telegraf } from 'telegraf'
import crypto from 'crypto'
import axios from 'axios'
import { faker } from '@faker-js/faker';
import 'dotenv/config'


// Log the bot start
console.log('Starting bot...')

const bot = new Telegraf(process.env.BOT_TOKEN)
console.log('Bot initialized')
// Track user state
const userStates = {}
// Store bot messages to delete later
const userMessageHistory = {}
// Save messages to user history
function saveMessage(chatId, messageId) {
    if (!userMessageHistory[chatId]) {
        userMessageHistory[chatId] = []
    }
    userMessageHistory[chatId].push(messageId)
}


// Handle the /link command
bot.command('generate_link', async (ctx) => {
    await ctx.reply('Please enter the amount of USDT:')
    userStates[ctx.chat.id] = { awaitingUSDT: true }
})

// Handle the /clear command
bot.command('clear', async (ctx) => {
    console.log(`Received /clear command from user ${ctx.from.id} (${ctx.from.username || 'unknown'})`)

    const chatId = ctx.chat.id
    const messageHistory = userMessageHistory[chatId] || []

    if (messageHistory.length > 0) {
        for (const messageId of messageHistory) {
            try {
                await bot.telegram.deleteMessage(chatId, messageId)
                console.log(`Deleted message ${messageId} in chat ${chatId}`)
            } catch (error) {
                console.error(`Failed to delete message ${messageId} in chat ${chatId}:`, error)
            }
        }
        userMessageHistory[chatId] = [] // Clear history after deletion
        await ctx.reply('Chat cleared!')
    } else {
        await ctx.reply('No messages to clear.')
    }
})

// Handle user messages
bot.on('text', async (ctx) => {
    const state = userStates[ctx.chat.id]

    if (state && state.awaitingUSDT) {
        const usdtAmount = parseFloat(ctx.message.text)

        if (isNaN(usdtAmount) || usdtAmount <= 0) {
            await ctx.reply('Invalid amount. Please enter a valid positive number:')
        } else {
            const data = {
                amount: usdtAmount.toString(),
                currency: 'USD',
                to_currency: 'USDT',
                network: 'SOL',
                order_id: faker.number.octal({ min: 0, max: 65535 }).toString(),
                url_callback: "https://payment.tfdevs.com/callback"
            }
            const sign = crypto.createHash('md5')
                .update(Buffer.from(JSON.stringify(data)).toString('base64') + process.env.CRPYTOMUS_API_KEY)
                .digest('hex')
            const response = await axios.post('https://api.cryptomus.com/v1/payment',
                data,
                {
                    headers: {
                        merchant: process.env.CRYPTOMUS_MERCHANT_ID,
                        sign: sign
                    }
                }
            )
            await ctx.reply(`Payment link: ${response.data.result.url}`)
            userStates[ctx.chat.id] = {} // Reset state
        }
    }
})

bot.launch()

// Enable graceful stop with logs
process.once('SIGINT', () => {
    console.log('Stopping bot gracefully (SIGINT)...')
    bot.stop('SIGINT')
})
process.once('SIGTERM', () => {
    console.log('Stopping bot gracefully (SIGTERM)...')
    bot.stop('SIGTERM')
})

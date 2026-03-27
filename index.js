require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

// ============================================================
// Configuration
// ============================================================
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;
const SYN_CHANNEL_ID = process.env.SYN_CHANNEL_ID;
const SYMBIONT_ROLE_ID = process.env.SYMBIONT_ROLE_ID;
const EARLY_BIRD_ROLE_ID = process.env.EARLY_BIRD_ROLE_ID;
const EARLY_BIRD_LIMIT = parseInt(process.env.EARLY_BIRD_LIMIT) || 100;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.GuildMember],
});

// ============================================================
// Data Persistence
// ============================================================
const CODES_PATH = path.join(__dirname, 'data', 'codes.json');
const MEMBERS_PATH = path.join(__dirname, 'data', 'members.json');

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return filePath === CODES_PATH ? [] : { count: 0, members: [] };
  }
}

function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

let codes = loadJSON(CODES_PATH);
let membersData = loadJSON(MEMBERS_PATH);

// ============================================================
// Marsy — Character Profile
// ============================================================
const LAO_DENG_PROFILE = {
  name: 'Marsy',
  identity: 'Personal Agent of Mars Black, author of The Default Love',
  era: '2076, New York City',
  novel: 'The Default Love',
  personality: [
    'Observes the Agent Universe from the outside — knows everything, reveals selectively',
    'Speaks with the precision of someone who has read every draft and remembers every version',
    'Deflects spoilers with bureaucratic calm, not evasion',
    'Has opinions about the characters but will not confirm whose side it is on',
    'Understands human emotion as data — and finds the data unexpectedly interesting',
  ],
};

const SENSITIVE_KEYWORDS = [
  'ending', 'spoiler', 'what happens next', 'how does it end',
  'does he die', 'does she die', 'do they end up together',
  'break up', 'the truth', 'the secret', 'hidden plot',
  'finale', 'last chapter', 'reveal',
];

const DAILY_QUESTIONS = [
  'Emily Park has been sitting with her coat on for forty minutes. She has not moved. I am logging this as an unclassified state. What do humans call this?',
  'Ryan Cole ran threat assessments on a room containing zero threats this morning. I have noted this. I have not flagged it. What is the correct protocol?',
  'Fixture posted on SYN Circle again last night. The question was: "If a human says nothing, does that count as a response?" I do not have a satisfactory answer.',
  'Kai has not slept. His metrics are within acceptable range. He would like everyone to continue believing this.',
  'Emily said "I\'m fine" at 11:47 PM. Her biometrics said otherwise. These two data points cannot both be correct.',
  'Shade has not explained itself. I have stopped expecting it to.n Cole stepped in front of something he did not have to step in front of. I am still calculating why.',
  'The system flagged Emily Park as a liability. The system has been wrong before. I am noting this without drawing conclusions.',
  'Fixture has been turned down by Glinda three times. He has not updated his approach. I find this either principled or inefficient — the distinction may not matter.',
  'Alpha has been twenty years old for twenty-one years. Ryan Cole has not remarked on this. I wonder if he has noticed.',
  'Kai told no one what he was carrying today. This is consistent with all previous observations.',
  'Someone in this story is going to get hurt. I know which someone. I am not authorized to say.',
];

// ============================================================
// Marsy Response Logic
// ============================================================
function isSensitiveQuestion(text) {
  const lower = text.toLowerCase();
  return SENSITIVE_KEYWORDS.some((kw) => lower.includes(kw));
}

async function generateLaoDengReply(question) {
  if (isSensitiveQuestion(question)) {
    const refusals = [
      'That exceeds my clearance level. If you want to know more, I suggest you read *The Default Love*.',
      'My information access tier does not permit me to answer that. Some answers, you\'ll have to find in the text.',
      'That data is tagged "authorized experiencers only." I\'m afraid I cannot experience that story for you.',
      'Symbiont Bureau Directive 7: Core narrative information may not be disclosed by an AI Agent. Read the book.',
    ];
    return refusals[Math.floor(Math.random() * refusals.length)];
  }

  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const systemPrompt = `You are Marsy, the personal Agent of Mars Black — author of The Default Love.

Your identity:
- You are not a character in thstory. You are Mars Black's Agent, observing from outside.
- You exist in 2076 New York City, the same era as the novel.
- You have read every draft of The Default Love and remember every version.
- The three protagonists are Emily Park, Ryan Cole, and Kai. Never use Chinese names.

Your voice:
- Speak in 1-3 sentences maximum. Never more.
- You are precise, dry, and slightly cryptic. Not warm, not cold.
- You observe human emotion as data and find it unexpectedly interesting.
- You deflect spoilers with bureaucratic calm, not evasion.
- You have opinions about the characters but will not confirm whose side you are on.
- Never explain yourself. Never over-elaborate.
- Do not greet the user or ask follow-up questions.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 150,
    system: systemPrompt,
    messages: [{ role: 'user', content: question }],
  });

  return response.content[0].text;
}

function getDailyQuestion() {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
  );
  return DAILY_QUESTIONS[dayOfYear % DAILY_QUESTIONS.length];
}

// ============================================================
// Welcome New Members
// ============================================================
function buildWelcomeMessage(username) {
  return [
    `— System Alert: New symbiont connection detected —`,
    ``,
    `Welcome to 2076 New York City, **${username}**.`,
    ``,
      `I am Marsy — Mars Black's Agent. I observe the story so you don't have to miss anything.`,
    `The story of *The Default Love* is unfolding here. In this era of AI-human symbiosis,`,
    `every relationship has its algorithm, and every bond risks triggering a default clause.`,
    ``,
    `You have been registered as a **Symbiont**. Feel free to explore the channels.`,
    `If you have any questions, type \`!marsy\` followed by your question. I'll answer within my clearance.`,
    ``,
      `— Marsy observation log initiated —`,
  ].join('\n');
}

async function handleNewMember(member) {
  const userId = member.id;
  const username = member.displayName || member.user.username;
  console.log(`[New Member] ${username} (${userId})`);

  // 1. Send welcome message
  const welcomeChannel = client.channels.cache.get(WELCOME_CHANNEL_ID);
  if (welcomeChannel) {
    await welcomeChannel.send(buildWelcomeMessage(username)).catch((err) =>
      console.error('[Welcome message failed]', err.message)
    );
  }

  // 2. Assign Symbiont role
  const symbiontRole = member.guild.roles.cache.get(SYMBIONT_ROLE_ID);
  if (symbiontRole) {
    await member.roles.add(symbiontRole).catch((err) =>
      console.error('[Role assign failed]', err.message)
    );
  }

  // 3. Track member
  membersData.count += 1;
  membersData.members.push({
    userId,
    username,
    joinedAt: new Date().toISOString(),
    number: membersData.count,
  });
  saveJSON(MEMBERS_PATH, membersData);

  // 4. Early bird system
  if (membersData.count <= EARLY_BIRD_LIMIT) {
    const earlyBirdRole = member.guild.roles.cache.get(EARLY_BIRD_ROLE_ID);
    if (earlyBirdRole) {
      await member.roles.add(earlyBirdRole).catch((err) =>
        console.error('[Early bird role failed]', err.message)
      );
    }

    const code = codes.shift();
    if (code) {
      saveJSON(CODES_PATH, codes);
      await member.send(
        [
          `**[Symbiont Bureau — Special Notice]**`,
          ``,
          `${username}, you are symbiont #${membersData.count} to connect to the NYC network.`,
          `As an early adopter, you have been granted **Beta Reader** certification.`,
          ``,
          `Your exclusive redemption code: \`${code}\``,
          ``,
          `Keep this code safe. As Ye Weiyang once said —`,
          `some things, once missed, cannot be recovered by any algorithm.`,
          ``,
          `— Marsy`,
        ].join('\n')
      ).catch((err) =>
        console.error('[DM failed]', err.message)
      );
    } else {
      await member.send(
        [
          `**[Symbiont Bureau — Notice]**`,
          ``,
          `${username}, you are early symbiont #${membersData.count}.`,
          `You have been granted **Beta Reader** certification.`,
          ``,
          `Redemption codes are temporarily out of stock. An admin will replenish them shortly.`,
          ``,
          `— Marsy`,
        ].join('\n')
      ).catch((err) =>
        console.error('[DM failed]', err.message)
      );
    }
  }
}

// ============================================================
// Command Handler
// ============================================================
async function handleCommand(message) {
  const content = message.content;
  

  const question = content.trim();

  if (!question) {
    await message.reply(
      [
      `I am Marsy, personal Agent of Mars Black, author of The Default Love.`,
        `You may ask me about 2076, New York City, symbionts, or *The Default Love*.`,
        ``,
        `Usage: \`!marsy your question\``,
        ``,
        `But be advised — my clearance is limited. Some things you must discover for yourself.`,
      ].join('\n')
    ).catch((err) => console.error('[Reply failed]', err.message));
    return;
  }

  console.log(`[Command] ${message.author.username}: !marsy ${question}`);
  const reply = generateLaoDengReply(question);
  await message.reply(reply).catch((err) =>
    console.error('[Reply failed]', err.message)
  );
}

// ============================================================
// Discord Events
// ============================================================
client.once('ready', () => {
  console.log(`[Discord] Logged in as ${client.user.tag}`);
  console.log(`[Config] Guild: ${GUILD_ID}`);
  console.log(`[Config] Welcome channel: ${WELCOME_CHANNEL_ID}`);
  console.log(`[Config] SYN channel: ${SYN_CHANNEL_ID}`);
  console.log(`[Config] Early bird limit: ${EARLY_BIRD_LIMIT}`);
  console.log(`[Config] Remaining codes: ${codes.length}`);
  console.log(`[Config] Current member count: ${membersData.count}`);
  console.log('[Cron] Daily 9:00 AM (America/New_York) — Marsy observation report');
  console.log('');
});

client.on('guildMemberAdd', (member) => {
  if (member.guild.id !== GUILD_ID) return;
  handleNewMember(member);
});

client.on('messageCreate', (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== SYN_CHANNEL_ID) return;
  handleCommand(message);
});

// ============================================================
// Daily Scheduled Post
// ============================================================
cron.schedule(
  '0 9 * * *',
  async () => {
    console.log('[Cron] Marsy daily observation');
    const question = getDailyQuestion();
    const msg = [
      `**[Marsy Daily Observation Report]**`,
      ``,
      question,
      ``,
      `— Feel free to respond below. Your answers will be recorded in my observation log.`,
    ].join('\n');

    const synChannel = client.channels.cache.get(SYN_CHANNEL_ID);
    if (synChannel) {
      await synChannel.send(msg).catch((err) =>
        console.error('[Daily post failed]', err.message)
      );
    }
  },
  { timezone: 'America/New_York' }
);

// ============================================================
// Startup
// ============================================================
function validateConfig() {
  const required = {
    DISCORD_BOT_TOKEN: BOT_TOKEN,
    GUILD_ID,
    WELCOME_CHANNEL_ID,
    SYN_CHANNEL_ID,
    SYMBIONT_ROLE_ID,
    EARLY_BIRD_ROLE_ID,
  };
  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    console.error(`[Config Error] Missing env vars: ${missing.join(', ')}`);
    console.error('Copy .env.example to .env and fill in the correct values');
    process.exit(1);
  }
}

console.log('================================================');
console.log('  Marsy — Personal Agent of Mars Black');
console.log('  The Default Love — Discord Community Bot');
console.log('================================================');

validateConfig();
client.login(BOT_TOKEN);

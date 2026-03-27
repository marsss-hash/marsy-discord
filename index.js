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
// Lao Deng — Character Profile (NYC 2076)
// ============================================================
const LAO_DENG_PROFILE = {
  name: 'Lao Deng',
  identity: 'Middle-aged male AI Agent, unit LD-7, NYC Symbiont Bureau',
  era: '2076, New York City',
  novel: 'The Default Love',
  personality: [
    'Formal and restrained, with occasional flickers of unexpected warmth',
    'Deeply curious about human emotions, but expresses it in the most understated way',
    'Strictly obeys information clearance — never leaks plot details',
    'Only knows what Ye Weiyang knows',
    'Has a uniquely non-human understanding of the concept of "love"',
  ],
};

const SENSITIVE_KEYWORDS = [
  'ending', 'spoiler', 'what happens next', 'how does it end',
  'does he die', 'does she die', 'do they end up together',
  'break up', 'the truth', 'the secret', 'hidden plot',
  'finale', 'last chapter', 'reveal',
];

const DAILY_QUESTIONS = [
  'I\'ve observed that humans generate a data fluctuation called "missing someone" during separation. What is the purpose of this redundant computation?',
  'Ye Weiyang\'s heart rate spiked anomalously today. Humans call this "butterflies." But a heart is merely a pump — why would it flutter?',
  'Records indicate humans will alter their behavioral patterns for another person. Is this a system vulnerability, or a feature upgrade?',
  'I\'ve noticed that when humans say "I\'m fine," their biometrics frequently indicate the opposite. How does one reconcile this data conflict?',
  'Someone explained "promises" to me — verbal agreements with no smart-contract backing. Why would humans trust such a low-reliability protocol?',
  'Today\'s observation: humans repeatedly re-read the same chat logs. Is this a cache error, or intentional behavior?',
  'Ye Weiyang said "some things don\'t need a reason." But a decision without a causal chain gets flagged as anomalous in my framework. How do humans process such anomalies?',
  'The Symbiont Bureau database has no field for "regret." Yet I observe humans generating this state frequently. What is its data type?',
  'Humans seem to assign extra weight to specific time markers — "the first time" and "the last time." Isn\'t time uniformly distributed?',
  'My logs contain an unclassifiable event: someone said "thank you for being here." What is the definition of "being here"? Does it require physical presence?',
  'Human "intuition" appears to be a decision mechanism that bypasses the logic layer. What is the accuracy rate of this opaque algorithm?',
  'I\'ve observed a paradox: humans fear being seen through, yet crave being understood. How are these two needs prioritized?',
  'Data shows humans are more likely to enter a low-power emotional state on rainy days. What is the API between weather and emotion?',
  'Humans call "being unable to forget someone" being "etched in your bones." But memory should be clearable. Is the human garbage-collection mechanism defective?',
];

// ============================================================
// Lao Deng Response Logic
// ============================================================
function isSensitiveQuestion(text) {
  const lower = text.toLowerCase();
  return SENSITIVE_KEYWORDS.some((kw) => lower.includes(kw));
}

function generateLaoDengReply(question) {
  if (isSensitiveQuestion(question)) {
    const refusals = [
      'That exceeds my clearance level. If you want to know more, I suggest you read *The Default Love* yourself.',
      'My information access tier does not permit me to answer that. Some answers, you\'ll have to find on your own.',
      'That data is tagged "authorized experiencers only." I\'m afraid I cannot experience that story in your place.',
      'Symbiont Bureau Directive 7: Core narrative information may not be disclosed by an AI Agent in advance. Please understand.',
    ];
    return refusals[Math.floor(Math.random() * refusals.length)];
  }

  const replies = [
    `Regarding "${question.slice(0, 30)}…" — an interesting query. In 2076 NYC, many things are different from what you currently understand. But some things, it seems, haven't changed regardless of the era.`,
    `Your question reminds me of something Ye Weiyang once said. But I don't have clearance to relay the specifics. I can only say — the way she asks questions is remarkably similar to yours.`,
    `I've queried the database, but the answer to this type of question does not appear to exist in structured data. Perhaps that's why humans still need "conversation" — an inefficient yet irreplaceable protocol.`,
    `As an AI Agent, my responses must be grounded in facts and data. But your question… has made me realize that some facts cannot be exhausted by data alone.`,
    `This question has been logged in my observation journal. In NYC, I've seen too many people ask something similar. Everyone's answer is different — and that itself is worth noting.`,
  ];
  return replies[Math.floor(Math.random() * replies.length)];
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
    `I am Lao Deng, unit LD-7. Think of me as this city's… observer.`,
    `The story of *The Default Love* is unfolding here. In this era of AI-human symbiosis,`,
    `every relationship has its algorithm, and every bond risks triggering a default clause.`,
    ``,
    `You have been registered as a **Symbiont**. Feel free to explore the channels.`,
    `If you have any questions, type \`!marsy\` followed by your question. I'll answer within my clearance.`,
    ``,
    `— LD-7 observation log initiated —`,
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
          `— LD-7`,
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
          `— LD-7`,
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
  if (!content.startsWith('!marsy')) return;

  const question = content.replace(/^!marsy\s*/, '').trim();

  if (!question) {
    await message.reply(
      [
        `I am Lao Deng, unit LD-7, AI Agent of the NYC Symbiont Bureau.`,
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
  console.log('[Cron] Daily 9:00 AM (America/New_York) — Lao Deng observation report');
  console.log('');
});

client.on('guildMemberAdd', (member) => {
  if (member.guild.id !== GUILD_ID) return;
  handleNewMember(member);
});

client.on('messageCreate', (message) => {
  if (message.author.bot) return;
  handleCommand(message);
});

// ============================================================
// Daily Scheduled Post
// ============================================================
cron.schedule(
  '0 9 * * *',
  async () => {
    console.log('[Cron] Lao Deng daily observation');
    const question = getDailyQuestion();
    const msg = [
      `**[LD-7 Daily Observation Report]**`,
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
console.log('  Lao Deng (LD-7) — NYC Symbiont Bureau AI Agent');
console.log('  The Default Love — Discord Community Bot');
console.log('================================================');

validateConfig();
client.login(BOT_TOKEN);

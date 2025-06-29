require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ThreadAutoArchiveDuration } = require('discord.js');
const { SlashCommandBuilder, Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { randomUUID } = require('crypto');

// Debug token loading
console.log('Bot starting...');
if (!process.env.DISCORD_TOKEN) {
    console.error('ERROR: No token found in environment variables!');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

const config = {
    suggestionChannel: null,
    logChannel: null,
    suggestions: new Map()
};

// Slash Commands
const commands = [
    new SlashCommandBuilder()
        .setName('suggest')
        .setDescription('Submit a new suggestion')
        .addStringOption(option =>
            option.setName('suggestion')
                .setDescription('Your suggestion')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('set-channel')
        .setDescription('Set the suggestion channel')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to set as suggestions channel')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('set-log')
        .setDescription('Set the log channel for staff')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to set as log channel')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('approve')
        .setDescription('Approve a suggestion')
        .addStringOption(option =>
            option.setName('id')
                .setDescription('The suggestion ID to approve')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('deny')
        .setDescription('Deny a suggestion')
        .addStringOption(option =>
            option.setName('id')
                .setDescription('The suggestion ID to deny')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('config')
        .setDescription('View current bot configuration'),
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show the help menu'),
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check bot latency')
].map(command => command.toJSON());

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('Commands registered successfully!');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
});

// Interaction Handlers
client.on('interactionCreate', async interaction => {
    if (interaction.isCommand()) {
        const { commandName, options, member } = interaction;

        try {
            switch (commandName) {
                case 'suggest':
                    await handleSuggest(interaction, options, member);
                    break;
                case 'set-channel':
                    await handleSetChannel(interaction, options, member);
                    break;
                case 'set-log':
                    await handleSetLog(interaction, options, member);
                    break;
                case 'approve':
                    await handleApprove(interaction, options, member);
                    break;
                case 'deny':
                    await handleDeny(interaction, options, member);
                    break;
                case 'config':
                    await handleConfig(interaction);
                    break;
                case 'help':
                    await handleHelp(interaction);
                    break;
                case 'ping':
                    await handlePing(interaction);
                    break;
            }
        } catch (error) {
            console.error(`Error handling ${commandName}:`, error);
            await interaction.reply({ content: 'An error occurred!', ephemeral: true });
        }
    }
    else if (interaction.isButton()) {
        const [action, suggestionId] = interaction.customId.split('_');
        const suggestion = config.suggestions.get(suggestionId);

        if (!suggestion) {
            await interaction.reply({ content: 'Suggestion not found!', ephemeral: true });
            return;
        }

        // Voting logic: track user votes
        if (!suggestion.voters) suggestion.voters = {};
        const userId = interaction.user.id;
        const userVote = suggestion.voters[userId];

        if (userVote) {
            await interaction.reply({ content: 'You have already voted!', ephemeral: true });
            return;
        }

        if (action === 'upvote') {
            suggestion.upvotes += 1;
            suggestion.voters[userId] = 'upvote';
        } else if (action === 'downvote') {
            suggestion.downvotes += 1;
            suggestion.voters[userId] = 'downvote';
        }

        // ...existing code for fetching channel/message/embed...
        const channel = await client.channels.fetch(interaction.channelId);
        const message = await channel.messages.fetch(suggestion.messageId);
        const embed = message.embeds[0];

        const newEmbed = EmbedBuilder.from(embed)
            .spliceFields(0, 2,
                { name: '👍 Upvotes', value: suggestion.upvotes.toString(), inline: true },
                { name: '👎 Downvotes', value: suggestion.downvotes.toString(), inline: true }
            );

        await message.edit({ embeds: [newEmbed] });
        await interaction.reply({ content: `Vote recorded!`, ephemeral: true });
    }
});

// Message Handler
client.on('messageCreate', async message => {
    if (message.author.bot || message.channel.id !== config.suggestionChannel) return;

    try {
        await message.delete();
        const suggestionId = randomUUID().substring(0, 8);

        const embed = new EmbedBuilder()
            .setTitle(`New Suggestion [Pending] (ID: ${suggestionId})`)
            .setDescription(message.content)
            .addFields(
                { name: '👍 Upvotes', value: '0', inline: true },
                { name: '👎 Downvotes', value: '0', inline: true }
            )
            .setFooter({ text: `ID: ${suggestionId} | Author: ${message.author.tag}` })
            .setColor(0xFFFF00);

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`upvote_${suggestionId}`)
                    .setLabel('👍 Upvote')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`downvote_${suggestionId}`)
                    .setLabel('👎 Downvote')
                    .setStyle(ButtonStyle.Danger)
            );

        const suggestionMessage = await message.channel.send({
            embeds: [embed],
            components: [row]
        });

        config.suggestions.set(suggestionId, {
            id: suggestionId,
            authorId: message.author.id,
            messageId: suggestionMessage.id,
            status: 'pending',
            upvotes: 0,
            downvotes: 0,
            voters: {} // Track user votes
        });

        // Thread name is suggestionId
        const thread = await suggestionMessage.startThread({
            name: suggestionId,
            autoArchiveDuration: ThreadAutoArchiveDuration.OneDay
        });
        await thread.send(`Discuss this suggestion here <@${message.author.id}>!`);

        if (config.logChannel) {
            const logChannel = await client.channels.fetch(config.logChannel);
            await logChannel.send({
                embeds: [new EmbedBuilder()
                    .setTitle('New Suggestion')
                    .setDescription(`ID: ${suggestionId}\nAuthor: ${message.author.tag}`)
                    .setColor(0x00FF00)
                ]
            });
        }
    } catch (error) {
        console.error('Error handling suggestion:', error);
    }
});

// Command Functions
async function handleSuggest(interaction, options, member) {
    if (!config.suggestionChannel) {
        return interaction.reply({ content: 'Suggestion channel not set!', ephemeral: true });
    }

    const suggestion = options.getString('suggestion');
    const suggestionId = randomUUID().substring(0, 8);
    const channel = await client.channels.fetch(config.suggestionChannel);

    const embed = new EmbedBuilder()
        .setTitle(`New Suggestion [Pending] (ID: ${suggestionId})`)
        .setDescription(suggestion)
        .addFields(
            { name: '👍 Upvotes', value: '0', inline: true },
            { name: '👎 Downvotes', value: '0', inline: true }
        )
        .setFooter({ text: `ID: ${suggestionId} | Author: ${member.user.tag}` })
        .setColor(0xFFFF00);

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`upvote_${suggestionId}`)
                .setLabel('👍 Upvote')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`downvote_${suggestionId}`)
                .setLabel('👎 Downvote')
                .setStyle(ButtonStyle.Danger)
        );

    const suggestionMessage = await channel.send({ embeds: [embed], components: [row] });

    config.suggestions.set(suggestionId, {
        id: suggestionId,
        authorId: member.user.id,
        messageId: suggestionMessage.id,
        status: 'pending',
        upvotes: 0,
        downvotes: 0,
        voters: {} // Track user votes
    });

    // Thread name is suggestionId
    const thread = await suggestionMessage.startThread({
        name: suggestionId,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneDay
    });
    await thread.send(`Discuss this suggestion here <@${member.user.id}>!`);

    if (config.logChannel) {
        const logChannel = await client.channels.fetch(config.logChannel);
        await logChannel.send({
            embeds: [new EmbedBuilder()
                .setTitle('New Suggestion')
                .setDescription(`ID: ${suggestionId}\nAuthor: ${member.user.tag}`)
                .setColor(0x00FF00)
            ]
        });
    }
    
    await interaction.reply({ 
        content: `Suggestion posted! [View it here](${suggestionMessage.url})`, 
        ephemeral: true 
    });
}

async function handleSetChannel(interaction, options, member) {
    if (!member.permissions.has('ADMINISTRATOR')) {
        return interaction.reply({ content: 'Admin only!', ephemeral: true });
    }
    
    config.suggestionChannel = options.getChannel('channel').id;
    await interaction.reply({ content: 'Suggestion channel set!', ephemeral: true });
    
    if (config.logChannel) {
        const logChannel = await client.channels.fetch(config.logChannel);
        await logChannel.send({
            embeds: [new EmbedBuilder()
                .setTitle('Config Updated')
                .setDescription(`Suggestion channel set by ${member.user.tag}`)
                .setColor(0x0000FF)
            ]
        });
    }
}

async function handleSetLog(interaction, options, member) {
    if (!member.permissions.has('ADMINISTRATOR')) {
        return interaction.reply({ content: 'Admin only!', ephemeral: true });
    }
    
    config.logChannel = options.getChannel('channel').id;
    await interaction.reply({ content: 'Log channel set!', ephemeral: true });
    
    const logChannel = await client.channels.fetch(config.logChannel);
    await logChannel.send({
        embeds: [new EmbedBuilder()
            .setTitle('Logging Enabled')
            .setDescription(`Log channel set by ${member.user.tag}`)
            .setColor(0x0000FF)
        ]
    });
}

async function handleApprove(interaction, options, member) {
    if (!member.permissions.has('ADMINISTRATOR')) {
        return interaction.reply({ content: 'Admin only!', ephemeral: true });
    }
    
    const suggestionId = options.getString('id');
    const suggestion = config.suggestions.get(suggestionId);
    
    if (!suggestion) {
        return interaction.reply({ content: 'Invalid ID!', ephemeral: true });
    }
    
    const channel = await client.channels.fetch(interaction.channelId);
    const message = await channel.messages.fetch(suggestion.messageId);
    const embed = message.embeds[0];
    
    const newEmbed = EmbedBuilder.from(embed)
        .setTitle(embed.title.replace('[Pending]', '[Approved]'))
        .setColor(0x00FF00);
    
    await message.edit({ embeds: [newEmbed] });
    suggestion.status = 'approved';
    config.suggestions.set(suggestionId, suggestion);
    
    await interaction.reply({ content: 'Suggestion approved!', ephemeral: true });
    
    if (config.logChannel) {
        const logChannel = await client.channels.fetch(config.logChannel);
        await logChannel.send({
            embeds: [new EmbedBuilder()
                .setTitle('Suggestion Approved')
                .setDescription(`ID: ${suggestionId}\nBy: ${member.user.tag}`)
                .setColor(0x00FF00)
            ]
        });
    }
}

async function handleDeny(interaction, options, member) {
    if (!member.permissions.has('ADMINISTRATOR')) {
        return interaction.reply({ content: 'Admin only!', ephemeral: true });
    }
    
    const suggestionId = options.getString('id');
    const suggestion = config.suggestions.get(suggestionId);
    
    if (!suggestion) {
        return interaction.reply({ content: 'Invalid ID!', ephemeral: true });
    }
    
    const channel = await client.channels.fetch(interaction.channelId);
    const message = await channel.messages.fetch(suggestion.messageId);
    const embed = message.embeds[0];
    
    const newEmbed = EmbedBuilder.from(embed)
        .setTitle(embed.title.replace('[Pending]', '[Denied]'))
        .setColor(0xFF0000);
    
    await message.edit({ embeds: [newEmbed] });
    suggestion.status = 'denied';
    config.suggestions.set(suggestionId, suggestion);
    
    await interaction.reply({ content: 'Suggestion denied!', ephemeral: true });
    
    if (config.logChannel) {
        const logChannel = await client.channels.fetch(config.logChannel);
        await logChannel.send({
            embeds: [new EmbedBuilder()
                .setTitle('Suggestion Denied')
                .setDescription(`ID: ${suggestionId}\nBy: ${member.user.tag}`)
                .setColor(0xFF0000)
            ]
        });
    }
}

async function handleConfig(interaction) {
    await interaction.reply({
        embeds: [new EmbedBuilder()
            .setTitle('Bot Config')
            .addFields(
                { name: 'Suggestion Channel', value: config.suggestionChannel ? `<#${config.suggestionChannel}>` : 'Not set' },
                { name: 'Log Channel', value: config.logChannel ? `<#${config.logChannel}>` : 'Not set' }
            )
            .setColor(0x7289DA)
        ],
        ephemeral: true
    });
}

async function handleHelp(interaction) {
    await interaction.reply({
        embeds: [new EmbedBuilder()
            .setTitle('Segvento Help')
            .setDescription('Bot for managing server suggestions')
            .addFields(
                { name: '/suggest', value: 'Submit a suggestion' },
                { name: '/approve', value: 'Approve a suggestion (Admin)' },
                { name: '/deny', value: 'Deny a suggestion (Admin)' }
            )
            .setFooter({ text: 'Developer: Athernix00' })
            .setColor(0x7289DA)
        ],
        ephemeral: true
    });
}

async function handlePing(interaction) {
    const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true, ephemeral: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    await interaction.editReply(`Pong! ${latency}ms`);
}

client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error('Login failed:', err);
    process.exit(1);
});
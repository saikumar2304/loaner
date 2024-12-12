const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Path for credit limit data
const creditLimitDataPath = path.join(__dirname, 'credit_limits.json');

// Load credit limit data from the JSON file
function loadCreditLimitData() {
    if (!fs.existsSync(creditLimitDataPath)) {
        fs.writeFileSync(creditLimitDataPath, JSON.stringify({}));
        return {};
    }
    const data = fs.readFileSync(creditLimitDataPath, 'utf-8');
    return data ? JSON.parse(data) : {};
}

// Save credit limit data to the JSON file
function saveCreditLimitData(data) {
    fs.writeFileSync(creditLimitDataPath, JSON.stringify(data, null, 2));
}

// Function to generate the credit usage progress bar using emojis
function generateProgressBar(percentage) {
    const fullBlocks = Math.floor(percentage / 10);
    const emptyBlocks = 10 - fullBlocks;
    return '█'.repeat(fullBlocks) + '░'.repeat(emptyBlocks);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('creditlimit')
        .setDescription('Check your assigned credit limit'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const creditLimitData = loadCreditLimitData();

        // Check if user has a credit limit
        if (creditLimitData[userId]) {
            // If the user data is a number (legacy format), treat it as the totalLimit and set usedLimit to 0
            let totalLimit, usedLimit;
            if (typeof creditLimitData[userId] === 'number') {
                totalLimit = creditLimitData[userId];
                usedLimit = 0; // Default to 0 if not specified
                // Update the data format to store both totalLimit and usedLimit
                creditLimitData[userId] = { totalLimit, usedLimit };
                saveCreditLimitData(creditLimitData); // Save the updated structure
            } else {
                // For newer data format, extract totalLimit and usedLimit
                totalLimit = creditLimitData[userId].totalLimit || 0;
                usedLimit = creditLimitData[userId].usedLimit || 0;
            }

            const remainingLimit = totalLimit - usedLimit;

            // Avoid division by zero
            const usagePercentage = totalLimit > 0 ? Math.floor((usedLimit / totalLimit) * 100) : 0;
            const progressBar = generateProgressBar(usagePercentage);

            // Check if the interaction has a guild and set the icon URL only if the guild exists
            const guildIcon = interaction.guild ? interaction.guild.iconURL() : null;

            // Create a compact embed with the user's credit usage details (no extra space between lines)
            const embed = new EmbedBuilder()
                .setColor('#1E90FF') // Use a credit card style color
                .setTitle('💳 **Credit Limit Overview**')
                .setDescription(
                    `💼 **Total Credit Limit** - ${totalLimit.toLocaleString()} coins\n` +
                    `💸 **Used Credit** - ${usedLimit.toLocaleString()} coins\n` +
                    `💰 **Remaining Credit** - ${remainingLimit.toLocaleString()} coins\n` +
                    `📊 **Usage** - ${usagePercentage}%\n${progressBar}`
                )
                .setFooter({ text: 'Loan System • Your trusted credit manager', iconURL: guildIcon })
                .setTimestamp();

            // Send the message as a regular public message (not ephemeral)
            await interaction.reply({ embeds: [embed] });
        } else {
            await interaction.reply({ content: 'You do not have a credit limit assigned yet. Please run a Dank Memer profile command to generate one.' });
        }
    }
};

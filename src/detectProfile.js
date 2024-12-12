const { EmbedBuilder } = require('discord.js');
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

// Define credit limit based on level
function getCreditLimit(level) {
    if (level >= 21) return 50000;
    if (level >= 11) return 10000;
    if (level >= 6) return 5000;
    return 1000; // Default for levels 0-5
}

// Detect Dank Memer profile command and generate credit limit
module.exports = {
    detectProfileCommand(client) {
        const creditLimitData = loadCreditLimitData();

        client.on('messageCreate', async (message) => {
            // Debugging: Log every message detected to check if Dank Memer messages are seen
            console.log(`Received message: "${message.content}" from ${message.author.tag} (ID: ${message.author.id})`);

            // Check if the message is from Dank Memer by comparing the bot's ID
            if (message.author.id === '270904126974590976') {
                console.log('Message detected from Dank Memer'); // Log detection of Dank Memer message

                if (message.embeds.length) {
                    console.log('Embed detected in Dank Memer message');

                    const embed = message.embeds[0];
                    console.log(`Embed Title: ${embed.title || 'No title'}`); // Log the title of the embed

                    // Check if it's the correct embed by looking for specific fields (like "Level")
                    const levelField = embed.fields.find(field => field.name.includes('Level'));

                    if (levelField) {
                        console.log('Level field found in the embed'); // Log detection of level field
                        console.log(`Raw Level Data: ${levelField.value}`); // Log raw level data

                        // Extract the level and the user ID
                        const level = parseInt(levelField.value.match(/\d+/)[0]); // Extract level number
                        const userId = message.interaction?.user?.id || message.mentions.users.first()?.id || message.author.id;

                        console.log(`Parsed Level: ${level}, User ID: ${userId}`); // Log parsed level and user ID

                        // Check if user already has a credit limit
                        if (creditLimitData[userId]) {
                            console.log(`User ${userId} already has a credit limit of ${creditLimitData[userId]}`);
                            return;
                        }

                        // Assign credit limit based on level
                        const creditLimit = getCreditLimit(level);
                        creditLimitData[userId] = creditLimit;
                        saveCreditLimitData(creditLimitData);

                        console.log(`Credit limit of ${creditLimit} assigned to user ${userId}`); // Log the assigned credit limit

                        const embedReply = new EmbedBuilder()
                            .setColor('#00FF00')
                            .setTitle('Credit Limit Generated')
                            .setDescription(`A credit limit of **${creditLimit} coins** has been generated based on your level **${level}**.`)
                            .setFooter({ text: 'Loan System', iconURL: message.guild.iconURL() });

                        message.channel.send({ embeds: [embedReply] });
                    } else {
                        console.log('Level field not found in the embed'); // Log if the level field isn't found
                    }
                } else {
                    console.log('No embed found in Dank Memer message'); // Log if there is no embed in the message
                }
            } else {
                console.log('Message not from Dank Memer or it does not contain an embed'); // Log if the message isn't from Dank Memer or no embed exists
            }
        });
    }
};

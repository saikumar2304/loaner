const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Paths for loan and credit limit data
const loanDataPath = path.join(__dirname, 'data.json');
const creditLimitDataPath = path.join(__dirname, 'credit_limits.json');
const configPath = path.join(__dirname, 'config.json');

// Load loan data
function loadLoanData() {
    if (!fs.existsSync(loanDataPath)) {
        fs.writeFileSync(loanDataPath, JSON.stringify({}));
        return {};
    }
    const data = fs.readFileSync(loanDataPath, 'utf-8');
    return data ? JSON.parse(data) : {};
}

// Save loan data
function saveLoanData(data) {
    fs.writeFileSync(loanDataPath, JSON.stringify(data, null, 2));
}

// Load credit limit data
function loadCreditLimitData() {
    if (!fs.existsSync(creditLimitDataPath)) {
        fs.writeFileSync(creditLimitDataPath, JSON.stringify({}));
        return {};
    }
    const data = fs.readFileSync(creditLimitDataPath, 'utf-8');
    return data ? JSON.parse(data) : {};
}

// Save credit limit data
function saveCreditLimitData(data) {
    fs.writeFileSync(creditLimitDataPath, JSON.stringify(data, null, 2));
}

// Load config settings from config.json for a specific server
function loadConfig(guildId) {
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify({}));
        return {};
    }
    const data = fs.readFileSync(configPath, 'utf-8');
    const configs = data ? JSON.parse(data) : {};
    return configs[guildId] || {};
}

// Save config settings to config.json for a specific server
function saveConfig(guildId, config) {
    const configs = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf-8')) : {};
    configs[guildId] = config;
    fs.writeFileSync(configPath, JSON.stringify(configs, null, 2));
}

// Function to calculate EMI based on loan amount, interest rate, and duration
function calculateEMI(amount, interestRate, durationMonths) {
    const monthlyInterest = interestRate / (12 * 100);
    const emi = (amount * monthlyInterest * Math.pow(1 + monthlyInterest, durationMonths)) /
        (Math.pow(1 + monthlyInterest, durationMonths) - 1);
    return emi.toFixed(2); // Return EMI rounded to two decimal points
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loan')
        .setDescription('Request a loan with EMI options, repay, check status, and configure loan settings')
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Set up loan system for this server (admin only)'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('request')
                .setDescription('Request a loan with EMI options')
                .addIntegerOption(option =>
                    option.setName('amount')
                    .setDescription('The loan amount')
                    .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('duration')
                    .setDescription('Loan repayment duration in months')
                    .setRequired(true))
                .addStringOption(option =>
                    option.setName('plan')
                    .setDescription('Repayment plan (weekly/monthly)')
                    .setRequired(true)
                    .addChoices(
                        { name: 'weekly', value: 'weekly' },
                        { name: 'monthly', value: 'monthly' }
                    )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check your loan status'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('repay')
                .setDescription('Repay a portion of your loan')
                .addIntegerOption(option =>
                    option.setName('amount')
                    .setDescription('Amount to repay')
                    .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('config')
                .setDescription('Configure loan settings for this server')
                .addIntegerOption(option =>
                    option.setName('interest_rate')
                    .setDescription('Set interest rate (percentage)')
                    .setRequired(false))
                .addStringOption(option =>
                    option.setName('payout_channel')
                    .setDescription('Set payout channel ID')
                    .setRequired(false))
                .addStringOption(option =>
                    option.setName('paying_channel')
                    .setDescription('Set paying channel ID')
                    .setRequired(false))
                .addStringOption(option =>
                    option.setName('credit_check_channel')
                    .setDescription('Set the channel ID for credit limit checks'))),

    async execute(interaction) {
        const guildId = interaction.guild ? interaction.guild.id : null;
        const config = loadConfig(guildId);
        const loanData = loadLoanData();
        const creditLimitData = loadCreditLimitData();
        const userId = interaction.user.id;

        // Block access if setup is incomplete
        if (interaction.options.getSubcommand() !== 'setup' &&
            (!config.interest_rate || !config.payout_channel_id || !config.paying_channel_id)) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Loan System Not Set Up')
                .setDescription('The loan system has not been set up yet. Please ask an admin to use `/loan setup` to configure the system.')
                .setFooter({ text: 'Loan System', iconURL: interaction.guild ? interaction.guild.iconURL() : null });
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }

        // Handle the `/loan setup` command
        if (interaction.options.getSubcommand() === 'setup') {
            const isOwner = interaction.guild.ownerId === interaction.user.id;
            const isAdmin = interaction.member.permissions.has('ADMINISTRATOR');

            if (!isAdmin && !isOwner) {
                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('Insufficient Permissions')
                    .setDescription('You need to be an admin or the server owner to set up the loan system.')
                    .setFooter({ text: 'Loan System', iconURL: interaction.guild ? interaction.guild.iconURL() : null });
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }

            await interaction.reply('Let\'s set up the loan system. Please provide the interest rate (percentage).');
            const filter = response => response.author.id === interaction.user.id;
            const collector = interaction.channel ? interaction.channel.createMessageCollector({ filter, max: 3, time: 60000 }) : null;

            let step = 0;
            let interestRate, payoutChannel, payingChannel, creditCheckChannel;

            if (collector) {
                collector.on('collect', async (message) => {
                    if (step === 0) {
                        interestRate = parseFloat(message.content);
                        if (isNaN(interestRate)) {
                            await message.reply('Invalid interest rate. Please provide a valid number.');
                        } else {
                            await message.reply('Please provide the payout channel ID:');
                            step++;
                        }
                    } else if (step === 1) {
                        payoutChannel = message.content;
                        await message.reply('Please provide the paying channel ID:');
                        step++;
                    } else if (step === 2) {
                        payingChannel = message.content;
                        await message.reply('Please provide the credit check channel ID:');
                        step++;
                    } else if (step === 3) {
                        creditCheckChannel = message.content;

                        // Save the configuration
                        config.interest_rate = interestRate;
                        config.payout_channel_id = payoutChannel;
                        config.paying_channel_id = payingChannel;
                        config.credit_check_channel_id = creditCheckChannel;
                        saveConfig(guildId, config);

                        const embed = new EmbedBuilder()
                            .setColor('#00FF00')
                            .setTitle('Loan System Setup Completed')
                            .setDescription('The loan system is now ready to use with the following configuration:')
                            .addFields(
                                { name: 'Interest Rate', value: `${interestRate}%`, inline: true },
                                { name: 'Payout Channel', value: `<#${payoutChannel}>`, inline: true },
                                { name: 'Paying Channel', value: `<#${payingChannel}>`, inline: true },
                                { name: 'Credit Check Channel', value: `<#${creditCheckChannel}>`, inline: true }
                            )
                            .setFooter({ text: 'Loan System', iconURL: interaction.guild ? interaction.guild.iconURL() : null });
                        await message.reply({ embeds: [embed] });
                        collector.stop();
                    }
                });

                collector.on('end', collected => {
                    if (collected.size < 3) {
                        const embed = new EmbedBuilder()
                            .setColor('#FF0000')
                            .setTitle('Setup Timed Out')
                            .setDescription('Setup timed out. Please try again.')
                            .setFooter({ text: 'Loan System', iconURL: interaction.guild ? interaction.guild.iconURL() : null });
                        interaction.followUp({ embeds: [embed], ephemeral: true });
                    }
                });
            }
        }

        // Handle the `/loan request` command
        else if (interaction.options.getSubcommand() === 'request') {
            const amount = interaction.options.getInteger('amount');
            const duration = interaction.options.getInteger('duration');
            const plan = interaction.options.getString('plan');
            const interestRate = config.interest_rate;

            if (loanData[userId]) {
                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('Outstanding Loan Detected')
                    .setDescription('You already have an outstanding loan. Please repay it before requesting a new one.')
                    .setFooter({ text: 'Loan System', iconURL: interaction.guild ? interaction.guild.iconURL() : null });
                await interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
                // Check if user has a credit limit
                if (!creditLimitData[userId]) {
                    const embed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('No Credit Limit Found')
                        .setDescription('You do not have a credit limit assigned yet. Please run a Dank Memer profile command to generate one.')
                        .setFooter({ text: 'Loan System', iconURL: interaction.guild ? interaction.guild.iconURL() : null });
                    await interaction.reply({ embeds: [embed], ephemeral: true });
                    return;
                }

                const userCreditLimit = creditLimitData[userId].totalLimit;
                const userUsedCredit = creditLimitData[userId].usedLimit;
                const remainingCredit = userCreditLimit - userUsedCredit;

                // Check if the requested loan amount exceeds the remaining credit limit
                if (amount > remainingCredit) {
                    const embed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('Loan Request Exceeds Credit Limit')
                        .setDescription(`Your requested loan amount of ${amount} coins exceeds your remaining credit limit of ${remainingCredit} coins. Please request a smaller amount.`)
                        .setFooter({ text: 'Loan System', iconURL: interaction.guild ? interaction.guild.iconURL() : null });
                    await interaction.reply({ embeds: [embed], ephemeral: true });
                    return;
                }

                // Calculate EMI
                const emi = calculateEMI(amount, interestRate, duration);

                // Update loan data
                loanData[userId] = {
                    loan_amount: amount,
                    emi: emi,
                    interest_rate: interestRate,
                    duration_months: duration,
                    repayment_plan: plan,
                    due_date: new Date(Date.now() + (plan === 'monthly' ? 30 : 7) * 24 * 60 * 60 * 1000)
                };
                saveLoanData(loanData);

                // Update used credit
                creditLimitData[userId].usedLimit += amount;
                saveCreditLimitData(creditLimitData);

                // Send confirmation
                const embed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('Loan Approved')
                    .setDescription('Your loan has been approved with the following details:')
                    .addFields(
                        { name: 'Loan Amount', value: `${amount} coins`, inline: true },
                        { name: 'EMI', value: `${emi} coins per ${plan}`, inline: true },
                        { name: 'Duration', value: `${duration} months`, inline: true }
                    )
                    .setFooter({ text: 'Loan System', iconURL: interaction.guild ? interaction.guild.iconURL() : null });
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }

        // Handle the `/loan repay` command
        else if (interaction.options.getSubcommand() === 'repay') {
            const amount = interaction.options.getInteger('amount');

            if (!loanData[userId]) {
                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('No Outstanding Loan')
                    .setDescription('You do not have any outstanding loans.')
                    .setFooter({ text: 'Loan System', iconURL: interaction.guild ? interaction.guild.iconURL() : null });
                await interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
                const remainingLoan = loanData[userId].loan_amount - amount;

                if (remainingLoan <= 0) {
                    delete loanData[userId]; // Loan fully repaid
                    saveLoanData(loanData);
                    const embed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('Loan Fully Repaid')
                        .setDescription('You have fully repaid your loan.')
                        .setFooter({ text: 'Loan System', iconURL: interaction.guild ? interaction.guild.iconURL() : null });
                    await interaction.reply({ embeds: [embed], ephemeral: true });
                } else {
                    loanData[userId].loan_amount = remainingLoan;
                    saveLoanData(loanData);
                    const embed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('Loan Repayment Successful')
                        .setDescription(`You have repaid ${amount} coins. Remaining loan amount: ${remainingLoan} coins.`)
                        .setFooter({ text: 'Loan System', iconURL: interaction.guild ? interaction.guild.iconURL() : null });
                    await interaction.reply({ embeds: [embed], ephemeral: true });
                }
            }
        }

        // Handle the `/loan status` command
        else if (interaction.options.getSubcommand() === 'status') {
            if (!loanData[userId]) {
                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('No Outstanding Loan')
                    .setDescription('You do not have any outstanding loans.')
                    .setFooter({ text: 'Loan System', iconURL: interaction.guild ? interaction.guild.iconURL() : null });
                await interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
                const loan = loanData[userId];
                const embed = new EmbedBuilder()
                    .setColor('#0099FF')
                    .setTitle('Loan Status')
                    .setDescription('Here is the status of your current loan:')
                    .addFields(
                        { name: 'Loan Amount', value: `${loan.loan_amount} coins`, inline: true },
                        { name: 'EMI', value: `${loan.emi} coins per ${loan.repayment_plan}`, inline: true },
                        { name: 'Remaining Duration', value: `${loan.duration_months} months`, inline: true },
                        { name: 'Due Date', value: new Date(loan.due_date).toLocaleDateString(), inline: true }
                    )
                    .setFooter({ text: 'Loan System', iconURL: interaction.guild ? interaction.guild.iconURL() : null });
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }

        // Handle the `/loan config` command
        else if (interaction.options.getSubcommand() === 'config') {
            const newInterestRate = interaction.options.getInteger('interest_rate');
            const payoutChannelId = interaction.options.getString('payout_channel');
            const payingChannelId = interaction.options.getString('paying_channel');
            const creditCheckChannelId = interaction.options.getString('credit_check_channel');

            if (newInterestRate !== null) config.interest_rate = newInterestRate;
            if (payoutChannelId !== null) config.payout_channel_id = payoutChannelId;
            if (payingChannelId !== null) config.paying_channel_id = payingChannelId;
            if (creditCheckChannelId !== null) config.credit_check_channel_id = creditCheckChannelId;

            saveConfig(guildId, config);

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('Loan Configuration Updated')
                .setDescription('The loan system configuration has been updated with the following values:')
                .addFields(
                    { name: 'Interest Rate', value: `${config.interest_rate}%`, inline: true },
                    { name: 'Payout Channel', value: `<#${config.payout_channel_id}>`, inline: true },
                    { name: 'Paying Channel', value: `<#${config.paying_channel_id}>`, inline: true },
                    { name: 'Credit Check Channel', value: `<#${config.credit_check_channel_id}>`, inline: true }
                )
                .setFooter({ text: 'Loan System', iconURL: interaction.guild ? interaction.guild.iconURL() : null });
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};

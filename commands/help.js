const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    SlashCommandBuilder
} = require('discord.js');

// Slash komut verisi
const slashCommandData = new SlashCommandBuilder()
    .setName('help')
    .setDescription('Botun komutlarını gösterir.');

// Ana komut modülü.
module.exports = {
    name: 'help', // Bu, prefixli komutlar için gerekli
    aliases: ['yardim', 'komutlar'], // Bu, prefixli komutlar için takma adları belirler
    data: slashCommandData, // Bu, slash komutları için gerekli

    async execute(interactionOrMessage) {
        // Objenin türünü kontrol edin
        const isSlashCommand = interactionOrMessage.isChatInputCommand && interactionOrMessage.isChatInputCommand();
        const user = isSlashCommand ? interactionOrMessage.user : interactionOrMessage.author;

        const client = interactionOrMessage.client;
        // Hem prefix hem de slash komutlarını tek bir yerde topla
        const allCommands = new Map([...client.slashCommands, ...client.commands]);
        
        // Sadece geçerli komutları filtrele
        const validCommands = Array.from(allCommands.values()).filter(cmd => (cmd.data && cmd.data.description) || cmd.name);

        const commandOptions = validCommands.map(command => {
            const commandName = command.data ? command.data.name : command.name;
            const commandDescription = command.data ? command.data.description : 'Açıklama yok.';
            return {
                label: commandName,
                description: commandDescription,
                value: commandName,
            };
        });

        if (commandOptions.length === 0) {
            return interactionOrMessage.reply({
                content: 'Yardım menüsü için komut bulunamadı.',
                ephemeral: true
            });
        }

        const embed = {
            title: 'Yardım Menüsü',
            description: 'Başvuru botu olduğumdan dolayı sadece başvurularla ilgileniyorum ama komutlarımı görmek istersen aşağıdaki seçenekler bölümünden komutları seçebilirsin ☺️',
            color: 65280, // Hex'ten ondalığa dönüştürüldü
            timestamp: new Date()
        };

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                .setCustomId('select_commands')
                .setPlaceholder('Komutları seçin')
                .addOptions(commandOptions)
            );

        try {
            if (isSlashCommand) {
                 await interactionOrMessage.reply({ embeds: [embed], components: [row] });
            } else {
                 await interactionOrMessage.reply({ embeds: [embed], components: [row] });
            }
        } catch (error) {
            console.error('Yanıt gönderilirken hata oluştu:', error);
            return;
        }

        const filter = interaction => interaction.customId === 'select_commands' && interaction.user.id === user.id;

        try {
            const collector = interactionOrMessage.channel.createMessageComponentCollector({
                filter,
                time: 60000
            });

            collector.on('collect', async interaction => {
                const value = interaction.values[0];
                const selectedCommand = allCommands.get(value);

                if (!selectedCommand || (!selectedCommand.data && !selectedCommand.name)) {
                    return interaction.reply({
                        content: 'Seçilen komut bulunamadı.',
                        ephemeral: true
                    });
                }

                const commandsEmbed = {
                    title: 'Komut Bilgisi',
                    description: `**Komut:** ${selectedCommand.data ? selectedCommand.data.name : selectedCommand.name}\n**Açıklama:** ${selectedCommand.data ? selectedCommand.data.description : 'Açıklama yok.'}`,
                    color: 65280, // Hex'ten ondalığa dönüştürüldü
                    timestamp: new Date()
                };

                await interaction.reply({
                    embeds: [commandsEmbed],
                    ephemeral: true
                });
            });

            collector.on('end', collected => {
                console.log(`Toplam ${collected.size} etkileşim toplandı.`);
            });

        } catch (error) {
            console.error('Koleksiyoncu (Collector) oluşturulurken veya kullanılırken hata oluştu:', error);
        }
    },
};

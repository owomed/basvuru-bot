const {
    MessageEmbed,
    MessageActionRow,
    MessageSelectMenu,
    SlashCommandBuilder
} = require('discord.js');

// Slash komutu için gerekli olan veriyi oluşturur.
const slashCommandData = new SlashCommandBuilder()
    .setName('help')
    .setDescription('Botun komutlarını gösterir.');

// Ana komut modülü.
module.exports = {
    // execute fonksiyonu artık yalnızca interaction nesnesini alacak.
    async execute(interactionOrMessage) {
        const isSlashCommand = interactionOrMessage.isChatInputCommand(); // isChatInputCommand() kullanarak daha güvenli kontrol
        const user = isSlashCommand ? interactionOrMessage.user : interactionOrMessage.author;
        const replyTarget = isSlashCommand ? interactionOrMessage : interactionOrMessage;

        // Komut listesini client objesi üzerinden al
        const client = interactionOrMessage.client;
        const allCommands = new Map([...client.slashCommands, ...client.commands]);

        // Komutları filtreleyerek sadece geçerli olanları al
        const validCommands = Array.from(allCommands.values()).filter(cmd => cmd.data && cmd.data.description);

        // Komutlar için seçenekleri oluştur
        const commandOptions = validCommands.map(command => {
            return {
                label: command.data.name,
                description: command.data.description,
                value: command.data.name,
            };
        });

        // Eğer komut seçeneği yoksa hata mesajı gönder
        if (commandOptions.length === 0) {
            return replyTarget.reply({
                content: 'Yardım menüsü için komut bulunamadı.',
                ephemeral: true
            });
        }

        const embed = {
            title: 'Yardım Menüsü',
            description: 'Başvuru botu olduğumdan dolayı sadece başvurularla ilgileniyorum ama komutlarımı görmek istersen aşağıdaki seçenekler bölümünden komutları seçebilirsin ☺️',
            color: '#00ff00',
            timestamp: new Date()
        };

        const row = new MessageActionRow()
            .addComponents(
                new MessageSelectMenu()
                .setCustomId('select_commands')
                .setPlaceholder('Komutları seçin')
                .addOptions(commandOptions) // Dinamik olarak oluşturulan seçenekleri ekle
            );

        await replyTarget.reply({
            embeds: [embed],
            components: [row]
        });

        const filter = interaction => interaction.customId === 'select_commands' && interaction.user.id === user.id;

        try {
            const collector = replyTarget.channel.createMessageComponentCollector({
                filter,
                time: 60000
            });

            collector.on('collect', async interaction => {
                const value = interaction.values[0];
                const selectedCommand = allCommands.get(value); // Seçilen komutu bul

                if (!selectedCommand || !selectedCommand.data) {
                    return interaction.reply({
                        content: 'Seçilen komut bulunamadı.',
                        ephemeral: true
                    });
                }

                const commandsEmbed = {
                    title: 'Komut Bilgisi',
                    description: `**Komut:** ${selectedCommand.data.name}\n**Açıklama:** ${selectedCommand.data.description}`,
                    color: '#00ff00',
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
            console.error(error);
            if (isSlashCommand) {
                await replyTarget.editReply({
                    content: 'Komutu çalıştırırken bir hata oluştu!'
                });
            } else {
                await replyTarget.channel.send({
                    content: 'Komutu çalıştırırken bir hata oluştu!'
                });
            }
        }
    },

    // Slash komut verisi
    data: slashCommandData
};

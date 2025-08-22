    const {
    MessageEmbed,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    SlashCommandBuilder
} = require('discord.js');

// Hem slash hem de prefix komutları için gerekli olan veriyi tanımla
// Bu komut, hem +help hem de /help olarak çalışır.
const slashCommandData = new SlashCommandBuilder()
    .setName('help')
    .setDescription('Botun komutlarını gösterir.');

// Ana komut modülü.
module.exports = {
    name: 'help', // Bu, prefixli komutlar için gerekli
    aliases: ['yardim', 'komutlar'], // Bu, prefixli komutlar için takma adları belirler
    data: slashCommandData, // Bu, slash komutları için gerekli

    // execute fonksiyonu artık yalnızca interaction veya message nesnesini alacak.
    async execute(interactionOrMessage) {
        // Gelen komutun slash komutu mu yoksa prefix komutu mu olduğunu kontrol et
        const isSlashCommand = interactionOrMessage.isChatInputCommand();
        const user = isSlashCommand ? interactionOrMessage.user : interactionOrMessage.author;
        const replyTarget = isSlashCommand ? interactionOrMessage : interactionOrMessage;

        // Komut listesini client objesi üzerinden al
        const client = interactionOrMessage.client;
        const allCommands = new Map([...client.slashCommands, ...client.commands]);

        // Komutları filtreleyerek sadece geçerli olanları al
        const validCommands = Array.from(allCommands.values()).filter(cmd => (cmd.data && cmd.data.description) || cmd.name);

        // Komutlar için seçenekleri oluştur
        const commandOptions = validCommands.map(command => {
            const commandName = command.data ? command.data.name : command.name;
            const commandDescription = command.data ? command.data.description : 'Açıklama yok.';
            return {
                label: commandName,
                description: commandDescription,
                value: commandName,
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

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
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

                if (!selectedCommand || (!selectedCommand.data && !selectedCommand.name)) {
                    return interaction.reply({
                        content: 'Seçilen komut bulunamadı.',
                        ephemeral: true
                    });
                }

                const commandsEmbed = {
                    title: 'Komut Bilgisi',
                    description: `**Komut:** ${selectedCommand.data ? selectedCommand.data.name : selectedCommand.name}\n**Açıklama:** ${selectedCommand.data ? selectedCommand.data.description : 'Açıklama yok.'}`,
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
};

const { MessageEmbed, MessageActionRow, MessageSelectMenu } = require('discord.js');

module.exports = {
    name: 'help',
    description: 'Botun komutlarını gösterir',
    async execute(client, message, args) {
        const embed = new MessageEmbed()
            .setTitle('Yardım Menüsü')
            .setDescription('Başvuru botu olduğumdan dolayı sadece başvurularla ilgileniyorum ama komutlarımı görmek istersen aşağıdaki seçenekler bölümünden komutları seçebilirsin ☺️')
            .setColor('#00ff00')
            .setTimestamp();

        const row = new MessageActionRow()
            .addComponents(
                new MessageSelectMenu()
                    .setCustomId('select_commands')
                    .setPlaceholder('Komutları seçin')
                    .addOptions([
                        {
                            label: 'Ping',
                            description: 'Botun gecikmesini hesaplar.',
                            value: 'ping',
                        },
                        {
                            label: 'Help',
                            description: 'Botun yardım menüsünü gösterir.',
                            value: 'help',
                        }
                        // Buraya eklemek istediğiniz diğer komutları ekleyebilirsiniz.
                    ])
            );

        const helpMessage = await message.reply({ embeds: [embed], components: [row] });

        const filter = interaction => interaction.customId === 'select_commands' && interaction.user.id === message.author.id;
        const collector = helpMessage.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async interaction => {
            await interaction.deferUpdate();
            const value = interaction.values[0];

            let commandDescription = '';
            if (value === 'ping') {
                commandDescription = 'Botun gecikmesini hesaplar.';
            } else if (value === 'help') {
                commandDescription = 'Botun yardım menüsünü gösterir.';
            }
            // Buraya eklemek istediğiniz diğer komut açıklamalarını ekleyebilirsiniz.

            const commandsEmbed = new MessageEmbed()
                .setTitle('Komut Bilgisi')
                .setDescription(`**Komut:** ${value}\n**Açıklama:** ${commandDescription}`)
                .setColor('#00ff00')
                .setTimestamp();

            await interaction.followUp({ embeds: [commandsEmbed], ephemeral: true });
        });

        collector.on('end', collected => {
            console.log(`Toplam ${collected.size} etkileşim toplandı.`);
        });
    }
};

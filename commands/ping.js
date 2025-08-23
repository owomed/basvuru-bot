const {
    SlashCommandBuilder,
    MessageEmbed
} = require('discord.js');

// Slash komutu için gerekli olan veriyi oluşturur.
const slashCommandData = new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Botun gecikmesini hesaplar.');

module.exports = {
    name: 'ping', // Ön ekli (prefix) komutlar için ad
    aliases: ['p'], // Ön ekli (prefix) komutlar için takma adlar
    data: slashCommandData, // Slash komut verisi

    // Komutun hem slash hem de prefix komutlarında ortak olarak çalışacak olan işlevi.
    async execute(interactionOrMessage) {
        // Objenin türünü kontrol edin
        const isSlashCommand = interactionOrMessage.isChatInputCommand ? interactionOrMessage.isChatInputCommand() : false;
        const replyTarget = interactionOrMessage;

        // Ping hesaplama mesajını gönder
        let sentMessage;
        if (isSlashCommand) {
            await replyTarget.deferReply({
                ephemeral: false
            });
            sentMessage = await replyTarget.editReply({
                content: '`Ping hesaplanıyor...`'
            });
        } else {
            sentMessage = await replyTarget.reply({
                content: '`Ping hesaplanıyor...`'
            });
        }

        const ping = sentMessage.createdTimestamp - interactionOrMessage.createdTimestamp;
        const apiPing = Math.round(interactionOrMessage.client.ws.ping);

        // Mesajı düzenle ve gecikme bilgisini gönder
        const embed = new MessageEmbed()
            .setTitle('Gecikme')
            .setDescription(`Bot: **${ping}ms**\nAPI: **${apiPing}ms**`)
            .setColor('#00ff00')
            .setTimestamp();

        await sentMessage.edit({
            content: '`Ping hesaplandı:`',
            embeds: [embed]
        });
    },
};

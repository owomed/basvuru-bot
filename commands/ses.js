const {
    joinVoiceChannel
} = require('@discordjs/voice');
const {
    SlashCommandBuilder,
    ChannelType
} = require('discord.js');

// Slash komutu için gerekli olan veriyi oluşturur.
const slashCommandData = new SlashCommandBuilder()
    .setName('basvuruses')
    .setDescription('Botun belirli bir ses kanalına katılmasını sağlar.')
    .addChannelOption(option =>
        option.setName('kanal')
        .setDescription('Botun katılacağı ses kanalı.')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildVoice)
    );

module.exports = {
    name: 'basvuruses', // Ön ekli (prefix) komutlar için ad
    aliases: ['basvur', 'ses'], // Ön ekli (prefix) komutlar için takma adlar
    data: slashCommandData, // Slash komut verisi

    // Komutun hem slash hem de prefix komutlarında ortak olarak çalışacak olan işlevi.
    async execute(interactionOrMessage) {
        // Objenin türünü kontrol edin
        const isSlashCommand = interactionOrMessage.isChatInputCommand ? interactionOrMessage.isChatInputCommand() : false;
        const replyTarget = interactionOrMessage;

        let channelId;

        if (isSlashCommand) {
            // Eğer slash komutuysa, `interaction.options.getChannel()` ile kanalı alıyoruz.
            channelId = interactionOrMessage.options.getChannel('kanal').id;
        } else {
            // Ön ekli komutlar için varsayılan bir kanal ID'si kullanılıyor
            channelId = '1243483710670635079'; // Ses kanalının ID'sini buraya ekleyin
        }

        const voiceChannel = interactionOrMessage.guild.channels.cache.get(channelId);

        if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
            return replyTarget.reply({
                content: 'Belirtilen ses kanalı bulunamadı veya geçerli bir ses kanalı değil.',
                ephemeral: true
            });
        }

        try {
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            });

            // Bağlantı başarılıysa mesaj gönder
            await replyTarget.reply({
                content: `\`Bot ${voiceChannel.name} adlı ses kanalına katıldı.\``
            });

        } catch (error) {
            console.error('Ses kanalına katılma hatası:', error);
            await replyTarget.reply({
                content: 'Ses kanalına katılırken bir hata oluştu. Lütfen yetkileri kontrol edin.',
                ephemeral: true
            });
        }
    },
};

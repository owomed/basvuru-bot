const { joinVoiceChannel } = require('@discordjs/voice');

module.exports = {
    name: 'basvuruses',
    description: 'Botun belirli bir ses kanalına katılmasını sağlar.',
    async execute(client, message, args) {
        const channelId = '1243483710670635079'; // Ses kanalının ID'sini buraya ekleyin
        const voiceChannel = message.guild.channels.cache.get(channelId);

        if (!voiceChannel || voiceChannel.type !== 'GUILD_VOICE') {
            return message.reply('Belirtilen ses kanalı bulunamadı veya geçerli bir ses kanalı değil.');
        }

        try {
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            });
            message.reply('`Bot ses kanalına katıldı.`');
        } catch (error) {
            console.error('Ses kanalına katılma hatası:', error);
            message.reply('Ses kanalına katılırken bir hata oluştu.');
        }
    },
};

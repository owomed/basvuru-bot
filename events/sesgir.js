 const { joinVoiceChannel } = require('@discordjs/voice');

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState) {
        const channelId = '1243483710670635079'; // Ses kanalının ID'sini buraya ekleyin

        // Bot belirtilen ses kanalına bağlı değilse bağlan
        const voiceChannel = newState.guild.channels.cache.get(channelId);
        if (voiceChannel && !voiceChannel.members.has(newState.client.user.id)) {
            try {
                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: voiceChannel.guild.id,
                    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                });
                console.log('Ses kanalına katıldı.');
            } catch (error) {
                console.error('Ses kanalına katılma hatası:', error);
            }
        }
    },
};

const { joinVoiceChannel } = require('@discordjs/voice');
const { Events, ChannelType } = require('discord.js');

module.exports = {
    // Event dosyasının adını belirtiyoruz.
    name: Events.VoiceStateUpdate,
    // Event'in bir kez değil, her tetiklendiğinde çalışmasını sağlıyoruz.
    once: false,
    
    async execute(oldState, newState) {
        // Botun katılmasını istediğimiz ses kanalının ID'si
        const targetChannelId = '1243483710670635079'; 

        // Eğer yeni durum (newState) bir kanala girişi temsil etmiyorsa veya bot zaten bu kanaldaysa, işlemi durdur.
        if (!newState.channelId || newState.channelId !== targetChannelId) {
            return;
        }

        const voiceChannel = newState.guild.channels.cache.get(targetChannelId);

        // Hedef kanal geçerli bir ses kanalı mı ve bot zaten o kanalda mı kontrol et
        if (voiceChannel && voiceChannel.type === ChannelType.GuildVoice && !voiceChannel.members.has(newState.client.user.id)) {
            try {
                // joinVoiceChannel fonksiyonu async olduğu için await kullanıyoruz
                await joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: voiceChannel.guild.id,
                    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                });

                console.log(`Bot, ${voiceChannel.name} adlı ses kanalına otomatik olarak katıldı.`);
            } catch (error) {
                console.error('Ses kanalına katılma hatası:', error);
            }
        }
    },
};

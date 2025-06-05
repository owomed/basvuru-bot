const Discord = require('discord.js');

module.exports = {
    name: 'ping',
    description: 'Botun gecikmesini hesaplar',
    execute(client, message, args) {
        message.reply('`Ping hesaplanıyor...`').then(sentMessage => {
            const ping = sentMessage.createdTimestamp - message.createdTimestamp;
            const apiPing = Math.round(client.ws.ping);

            const embed = new Discord.MessageEmbed()
                .setTitle('Gecikme')
                .setDescription(`Bot: **${ping}ms**\nAPI: **${apiPing}ms**`)
                .setColor('#00ff00')
                .setTimestamp();

            // İlk olarak boş bir mesaj içeriği vermeniz gerekiyor
            sentMessage.edit({ content: '`Ping hesaplandı:`', embeds: [embed] });
        });
    }
};

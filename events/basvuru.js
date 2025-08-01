// Bu dosya `./events/` klasörüne taşınmalıdır.
// Örneğin: `./events/basvuru.js`

const { MessageEmbed, Permissions } = require('discord.js');

// dotenv'i burada çağırmaya gerek yok, app.js zaten çağırdı.
// require('dotenv').config();

// config.json'ı çağırmaya gerek yok, ID'leri .env'den alacağız.
// const appConfig = require('../Settings/config.json');

module.exports = {
    // Bu olayın adı "interactionCreate" olacak, çünkü bu bir interaction (buton) olayıdır.
    name: 'interactionCreate',
    
    // Olay çalıştığında çağrılacak fonksiyon.
    // interaction objesi Discord.js tarafından otomatik olarak sağlanır.
    // client objesini interaction.client olarak alıyoruz, bu sayede tek bir bot instance'ı kullanıyoruz.
    async execute(interaction) {
        // Sadece buton etkileşimlerini dinle
        if (!interaction.isButton()) return;

        let replied = false;
        try {
            // Yanıt verme süresi dolmadan deferReply ile yanıtı ertele
            await interaction.deferReply({ ephemeral: true });
            replied = true;
        } catch (err) {
            console.error('Interaction yanıtlanamadı, zaman aşımına uğramış olabilir.', err);
            return;
        }

        const { user, customId, guild, client } = interaction; // client objesini interaction'dan alıyoruz
        const categoryId = '1268509251911811175'; // Başvuru kanallarının oluşturulacağı kategori ID'si (Sabit kalabilir)

        // Başvuru türüne göre yapılandırma
        const basvuruConfig = {
            yetkiliBaşvuru: {
                name: `yetkili-${user.username.toLowerCase()}`,
                questions: [
                    'İsim ve yaşınız nedir?',
                    'Neden bu pozisyona başvuruyorsunuz?',
                    'Bir deneyiminiz var mı? Varsa anlatın.',
                    'Sunucuda ne kadar aktif olabilirsiniz?',
                    'Neden sizi seçmeliyiz?',
                ],
                // Sonuç kanalı ID'sini .env'den çek
                resultChannelId: process.env.RESULT_CHANNEL_ID_YETKILI, // Yeni ENV değişkeni adı
            },
            helperBaşvuru: {
                name: `helper-${user.username.toLowerCase()}`,
                questions: [
                    'İsim ve yaşınız nedir?',
                    'Helper deneyiminiz var mı? Varsa anlatın.',
                    'Sunucuda ne kadar aktif olabilirsiniz?',
                    'OwO bot bilginiz nasıl?',
                    'Takım metaları bilginiz nedir?',
                ],
                // Sonuç kanalı ID'sini .env'den çek
                resultChannelId: process.env.RESULT_CHANNEL_ID_HELPER, // Yeni ENV değişkeni adı
            },
        };

        const config = basvuruConfig[customId];
        if (!config) {
            return replied && interaction.editReply({ content: 'Geçersiz buton etkileşimi.' });
        }

        const existingChannel = guild.channels.cache.find((c) => c.name === config.name);
        if (existingChannel) {
            return replied && interaction.editReply({ content: `Zaten bir başvuru kanalınız var: <#${existingChannel.id}>` });
        }

        try {
            const newChannel = await guild.channels.create(config.name, {
                type: 'GUILD_TEXT',
                parent: categoryId,
                permissionOverwrites: [
                    { id: guild.roles.everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
                    { id: user.id, allow: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES] },
                ],
            });

            await newChannel.send(`Merhaba ${user}! Başvuru formunu buradan doldurabilirsiniz.\n**Lütfen cevapları sırayla teker teker yazınız.**`);
            for (const q of config.questions) {
                await newChannel.send(`**${q}**`);
            }
            await newChannel.send('Kanal 3 dakika boyunca bir mesaj gönderilmezse kapatılacaktır.');

            if (replied) {
                await interaction.editReply({ content: `Başvuru kanalınız oluşturuldu: ${newChannel}` });
            }

            const filter = (m) => m.author.id === user.id;
            const collector = newChannel.createMessageCollector({ filter, time: 180000 }); // 3 dakika = 180000 ms
            const responses = [];

            collector.on('collect', (m) => responses.push(m.content));

            collector.on('end', async () => {
                if (responses.length === 0) {
                    try {
                        await user.send('Başvuru formunuzu doldurmadığınız için başvuru kanalınız kapatılacaktır.');
                    } catch (e) {
                        console.error(`DM gönderilemedi: ${e.message}`);
                    }
                    await newChannel.send('Kanal 3 dakika içinde yanıt alınmadığı için kapatılmıştır.');
                    setTimeout(() => newChannel.delete().catch(() => {}), 30000); // 30 saniye sonra sil
                    return;
                }

                const embed = new MessageEmbed()
                    .setTitle(customId === 'yetkiliBaşvuru' ? 'Yetkili Başvuru' : 'Helper Başvuru')
                    .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
                    .setDescription(`**Başvuru yapan:** ${user}`)
                    .addFields(
                        config.questions.map((q, i) => ({
                            name: `❓ ${q}`,
                            value: responses[i] || 'Cevap verilmedi',
                            inline: false,
                        }))
                    )
                    .setColor('#0099ff')
                    .setFooter({ text: guild.name, iconURL: guild.iconURL() })
                    .setThumbnail(user.displayAvatarURL())
                    .setTimestamp();

                const resultChannel = client.channels.cache.get(config.resultChannelId);
                if (!resultChannel) {
                    console.error(`Sonuç kanalı bulunamadı: ${config.resultChannelId}. Lütfen .env dosyasını kontrol edin.`);
                    await newChannel.send('Hata: Başvuru sonucu gönderilecek kanal bulunamadı. Lütfen bot sahibine bildirin.');
                    return;
                }

                const sentMessage = await resultChannel.send({ content: '<@&1243478734078742579>', embeds: [embed] }); // Yetkili rol ID'si

                // Onay ve red emojilerini ekle
                await sentMessage.react('<:med_onaylandi:1284130169417764907>');
                await sentMessage.react('<:med_reddedildi:1284130046902145095>');

                const reactionFilter = (reaction, reactor) =>
                    ['1284130169417764907', '1284130046902145095'].includes(reaction.emoji.id) &&
                    guild.members.cache.get(reactor.id)?.roles.cache.hasAny(
                        '1243478734078742579', // Yetkili rolü ID'si
                        '1216094391060529393', // Başka bir yetkili rolü ID'si
                        '1188389290292551740'  // Başka bir yetkili rolü ID'si
                    );

                const reactionCollector = sentMessage.createReactionCollector({ filter: reactionFilter, max: 1, time: 600000 }); // 10 dakika süre

                reactionCollector.on('collect', async (reaction, reactor) => {
                    const onay = reaction.emoji.id === '1284130169417764907';
                    const başvuruTürü = customId === 'yetkiliBaşvuru' ? 'Yetkili' : 'Helper';

                    const sonuçEmbed = new MessageEmbed()
                        .setTitle('Başvurunuz sonuçlandı')
                        .setAuthor('MED Başvuru')
                        .setDescription(
                            `\`Başvuru yapan:\` \n${user}\n` +
                            `${başvuruTürü} başvurunuz <@${reactor.id}> kişisi tarafından ${onay ? 'onaylandı <:med_onaylandi:1284130169417764907>' : 'reddedildi <:med_reddedildi:1284130046902145095>'}`
                        )
                        .setColor(onay ? '#00ff00' : '#ff0000')
                        .setFooter({ text: `${guild.name} 🤍 | ${başvuruTürü} Başvurusu`, iconURL: guild.iconURL() });

                    // Sonuç kanalını .env'den al
                    const complaintChannelId = process.env.COMPLAINT_CHANNEL_ID;
                    const sonuçKanalı = client.channels.cache.get(complaintChannelId);
                    if (sonuçKanalı) {
                        await sonuçKanalı.send({ embeds: [sonuçEmbed] });
                    } else {
                        console.error(`Sonuç kanalı (COMPLAINT_CHANNEL_ID) bulunamadı: ${complaintChannelId}. Lütfen .env dosyasını kontrol edin.`);
                    }

                    try {
                        await sentMessage.reactions.removeAll();
                    } catch (error) {
                        console.error('Mesajdaki emojiler kaldırılamadı:', error);
                    }
                });

                reactionCollector.on('end', (collected, reason) => {
                    if (reason === 'time' && collected.size === 0) {
                        console.log('Başvuru mesajına yetkili tarafından tepki verilmediği için zaman aşımına uğradı.');
                    }
                });

                await newChannel.send('Başvurunuz alınmıştır. Kanal 5 saniye içinde siliniyor.');
                setTimeout(() => newChannel.delete().catch(() => {}), 5000);
            });
        } catch (error) {
            console.error('Başvuru kanalı oluşturulurken veya işlenirken hata oluştu:', error);
            if (replied) {
                await interaction.editReply({ content: 'Başvuru kanalınız oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin.' });
            } else {
                try {
                    await interaction.followUp({ content: 'Başvuru kanalınız oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin.', ephemeral: true });
                } catch (followUpError) {
                    console.error('Follow-up yanıtı da gönderilemedi:', followUpError);
                }
            }
        }
    },
};
